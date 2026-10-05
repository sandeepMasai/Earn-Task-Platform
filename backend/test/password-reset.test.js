const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');

// Isolate test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-password-reset-jwt-secret-32-chars';
process.env.JWT_REFRESH_SECRET = 'isolated-test-password-reset-refresh-secret-32-chars';
process.env.RESEND_API_KEY = 're_test_key_for_unit_tests';
process.env.PASSWORD_RESET_FROM = 'Earn Task <noreply@smartlibdesk.in>';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'earn-pwd-test-'));
process.env.UPLOAD_DIR = path.join(directory, 'uploads');

const User = require('../src/models/User');
const RateLimitBucket = require('../src/models/RateLimitBucket');
const mail = require('../src/services/passwordResetEmail');
const { hashCode, hashToken, genericMessage } = require('../src/controllers/passwordResetController');

let mongo, server, base;
let interceptedEmails = [];

async function request(method, route, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, body: data, headers: response.headers };
}

async function createTestAccount(name, email = `${name}@example.com`, password = 'TestPass123!') {
  const user = await User.create({
    name,
    username: name.toLowerCase(),
    email: email.toLowerCase(),
    password,
    isActive: true,
  });
  return user;
}

before(async () => {
  const instance = await require('./support/mongo').startMongo(directory);
  mongo = instance.child;
  await mongoose.connect(instance.uri, { serverSelectionTimeoutMS: 15000 });
  const app = require('../src/server');
  for (const model of Object.values(mongoose.models)) await model.init();
  server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;

  // Mock mail delivery
  mail.sendResetCode = async (toEmail, code) => {
    interceptedEmails.push({ toEmail, code });
  };
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await require('./support/mongo').stopMongo(mongo);
  fs.rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  interceptedEmails = [];
  await RateLimitBucket.deleteMany({});
});

test('1. forgot password request returns generic message and triggers email for active account', async () => {
  await createTestAccount('reqtest', 'reqtest@example.com');
  const res = await request('POST', '/api/auth/forgot-password', null, { email: 'reqtest@example.com' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, genericMessage);
  assert.equal(interceptedEmails.length, 1);
  assert.equal(interceptedEmails[0].toEmail, 'reqtest@example.com');
});

test('2. OTP generation produces cryptographically random 6-digit codes', async () => {
  const codes = new Set();
  for (let i = 0; i < 5; i++) {
    const username = `otptest${i}`;
    const email = `${username}@example.com`;
    await createTestAccount(username, email);
    await request('POST', '/api/auth/forgot-password', null, { email });
    const last = interceptedEmails[interceptedEmails.length - 1];
    assert.ok(last, 'Email should be dispatched');
    assert.equal(typeof last.code, 'string');
    assert.equal(last.code.length, 6);
    assert.match(last.code, /^\d{6}$/);
    codes.add(last.code);
  }
  // With 6-digit random codes, 5 samples should not be identical
  assert.ok(codes.size >= 4, 'Generated OTPs must be random and distinct');
});

test('3. OTP hashing stores HMAC hash in MongoDB and never stores plaintext OTP', async () => {
  const email = 'hashtest@example.com';
  await createTestAccount('hashtest', email);
  await request('POST', '/api/auth/forgot-password', null, { email });

  const lastEmail = interceptedEmails[interceptedEmails.length - 1];
  const plainOtp = lastEmail.code;

  // Retrieve raw document from MongoDB
  const user = await User.findOne({ email }).select('+resetCodeHash +resetCodeExpiresAt +password');
  assert.ok(user.resetCodeHash, 'resetCodeHash must be stored');
  assert.equal(user.resetCodeHash.length, 64, 'HMAC-SHA256 hash must be 64 hex characters');
  assert.equal(user.resetCodeHash, hashCode(email, plainOtp));

  // Verify plaintext OTP is not stored anywhere in document
  const rawDocJson = JSON.stringify(user.toObject());
  assert.equal(rawDocJson.includes(plainOtp), false, 'Plaintext OTP must NEVER be stored in MongoDB');
});

test('4. OTP verification succeeds with valid code and returns single-use resetToken', async () => {
  const email = 'verifytest@example.com';
  await createTestAccount('verifytest', email);
  await request('POST', '/api/auth/forgot-password', null, { email });

  const code = interceptedEmails[interceptedEmails.length - 1].code;
  const res = await request('POST', '/api/auth/verify-otp', null, { email, code });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.resetToken, 'Response must contain resetToken');
  assert.equal(res.body.resetToken.length, 64, 'resetToken must be a 64-character hex string');

  // Verify DB state: resetTokenHash set, resetCodeHash removed
  const user = await User.findOne({ email }).select('+resetCodeHash +resetTokenHash');
  assert.equal(user.resetCodeHash, undefined, 'resetCodeHash must be consumed upon verification');
  assert.ok(user.resetTokenHash, 'resetTokenHash must be stored in DB');
  assert.equal(user.resetTokenHash, hashToken(email, res.body.resetToken));
});

test('5. wrong OTP is rejected with 400 and increments verification attempts', async () => {
  const email = 'wrongotp@example.com';
  await createTestAccount('wrongotp', email);
  await request('POST', '/api/auth/forgot-password', null, { email });

  const res = await request('POST', '/api/auth/verify-otp', null, { email, code: '000000' });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Invalid or expired code/i);

  const user = await User.findOne({ email }).select('+resetCodeAttempts');
  assert.equal(user.resetCodeAttempts, 1);
});

test('6. expired OTP is rejected with 400', async () => {
  const email = 'expiredotp@example.com';
  await createTestAccount('expiredotp', email);
  await request('POST', '/api/auth/forgot-password', null, { email });

  const code = interceptedEmails[interceptedEmails.length - 1].code;

  // Manually expire the code
  await User.updateOne({ email }, { resetCodeExpiresAt: new Date(Date.now() - 5000) });

  const res = await request('POST', '/api/auth/verify-otp', null, { email, code });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error, /Invalid or expired code/i);
});

test('7. OTP reuse is blocked: single-use code cannot be verified twice', async () => {
  const email = 'reusetest@example.com';
  await createTestAccount('reusetest', email);
  await request('POST', '/api/auth/forgot-password', null, { email });

  const code = interceptedEmails[interceptedEmails.length - 1].code;

  // First verification succeeds
  const first = await request('POST', '/api/auth/verify-otp', null, { email, code });
  assert.equal(first.status, 200);

  // Second verification with identical code must fail
  const second = await request('POST', '/api/auth/verify-otp', null, { email, code });
  assert.equal(second.status, 400);
  assert.equal(second.body.success, false);
  assert.match(second.body.error, /Invalid or expired code/i);
});

test('8. maximum attempts: after 5 failed attempts, OTP verification is locked out', async () => {
  const email = 'maxattempts@example.com';
  await createTestAccount('maxattempts', email);
  await request('POST', '/api/auth/forgot-password', null, { email });

  const correctCode = interceptedEmails[interceptedEmails.length - 1].code;

  // Fail 5 times with incorrect code
  for (let i = 1; i <= 5; i++) {
    const res = await request('POST', '/api/auth/verify-otp', null, { email, code: '999999' });
    assert.equal(res.status, 400);
    if (i >= 5) {
      assert.match(res.body.error, /Maximum verification attempts exceeded/i);
    }
  }

  // Attempting with the correct code now must also fail
  const lockedRes = await request('POST', '/api/auth/verify-otp', null, { email, code: correctCode });
  assert.equal(lockedRes.status, 400);
});

test('9. resend cooldown and rate limiting prevent abuse without leaking existence', async () => {
  const email = 'cooldowntest@example.com';
  await createTestAccount('cooldowntest', email);

  // First request sends email
  const first = await request('POST', '/api/auth/forgot-password', null, { email });
  assert.equal(first.status, 200);
  assert.equal(interceptedEmails.length, 1);

  // Immediate second request within 60s cooldown returns 200 generic message but does NOT send email
  const second = await request('POST', '/api/auth/forgot-password', null, { email });
  assert.equal(second.status, 200);
  assert.equal(second.body.message, genericMessage);
  assert.equal(interceptedEmails.length, 1, 'No email should be dispatched during cooldown');

  // Fast-forward cooldown by updating resetCodeRequestedAt
  await User.updateOne({ email }, { resetCodeRequestedAt: new Date(Date.now() - 65000) });

  // Third request after cooldown expires sends a fresh email
  const third = await request('POST', '/api/auth/forgot-password', null, { email });
  assert.equal(third.status, 200);
  assert.equal(interceptedEmails.length, 2, 'Email should be dispatched after cooldown');

  // Rate limiting limit on /forgot-password is 5 requests per window
  // Run remaining requests to hit IP rate limit
  for (let i = 0; i < 3; i++) {
    await request('POST', '/api/auth/forgot-password', null, { email });
  }
  const throttled = await request('POST', '/api/auth/forgot-password', null, { email });
  assert.equal(throttled.status, 429);
  assert.match(throttled.body.error, /Too many requests/i);
});

test('10. nonexistent and blocked emails return identical generic response (no enumeration)', async () => {
  // Nonexistent email
  const nonExist = await request('POST', '/api/auth/forgot-password', null, { email: 'nosuchuser@example.com' });
  assert.equal(nonExist.status, 200);
  assert.equal(nonExist.body.success, true);
  assert.equal(nonExist.body.message, genericMessage);
  assert.equal(interceptedEmails.length, 0, 'No email sent for nonexistent user');

  // Blocked account (isActive: false)
  const blocked = await createTestAccount('blockeduser', 'blocked@example.com');
  await User.updateOne({ _id: blocked._id }, { isActive: false });
  const blockedRes = await request('POST', '/api/auth/forgot-password', null, { email: 'blocked@example.com' });
  assert.equal(blockedRes.status, 200);
  assert.equal(blockedRes.body.success, true);
  assert.equal(blockedRes.body.message, genericMessage);
  assert.equal(interceptedEmails.length, 0, 'No email sent for blocked user');
});

test('11. password reset updates password, enforces policy, and permits login with new password', async () => {
  const email = 'resetpass@example.com';
  await createTestAccount('resetpass', email, 'OldPassword123!');

  await request('POST', '/api/auth/forgot-password', null, { email });
  const code = interceptedEmails[interceptedEmails.length - 1].code;

  const verify = await request('POST', '/api/auth/verify-otp', null, { email, code });
  assert.equal(verify.status, 200);
  const resetToken = verify.body.resetToken;

  // Password policy violation: too short (< 6 chars)
  const shortPass = await request('POST', '/api/auth/reset-password', null, {
    email,
    resetToken,
    newPassword: 'short',
  });
  assert.equal(shortPass.status, 400);

  // Successful reset with valid password (>= 6 chars)
  const resetRes = await request('POST', '/api/auth/reset-password', null, {
    email,
    resetToken,
    newPassword: 'BrandNewSecurePass123!',
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // Login with old password must fail
  const oldLogin = await request('POST', '/api/auth/login', null, {
    email,
    password: 'OldPassword123!',
  });
  assert.equal(oldLogin.status, 401);

  // Login with new password must succeed
  const newLogin = await request('POST', '/api/auth/login', null, {
    email,
    password: 'BrandNewSecurePass123!',
  });
  assert.equal(newLogin.status, 200);
  assert.ok(newLogin.body.data.accessToken);

  // ResetToken reuse must be blocked (single-use)
  const reuseToken = await request('POST', '/api/auth/reset-password', null, {
    email,
    resetToken,
    newPassword: 'AnotherPassword123!',
  });
  assert.equal(reuseToken.status, 400);
});

test('12. old-session invalidation: password reset revokes all prior access and refresh tokens', async () => {
  const email = 'sessioninval@example.com';
  await createTestAccount('sessioninval', email, 'InitialPass123!');

  // User logs in to get active session tokens
  const loginRes = await request('POST', '/api/auth/login', null, { email, password: 'InitialPass123!' });
  assert.equal(loginRes.status, 200);
  const oldAccessToken = loginRes.body.data.accessToken;
  const oldRefreshToken = loginRes.body.data.refreshToken;

  // Verify access token and refresh token work before password reset
  const meBefore = await request('GET', '/api/auth/me', oldAccessToken);
  assert.equal(meBefore.status, 200);
  const refreshBefore = await request('POST', '/api/auth/refresh', null, { refreshToken: oldRefreshToken });
  assert.equal(refreshBefore.status, 200);

  // Perform password reset flow
  await request('POST', '/api/auth/forgot-password', null, { email });
  const code = interceptedEmails[interceptedEmails.length - 1].code;
  const verify = await request('POST', '/api/auth/verify-otp', null, { email, code });
  await request('POST', '/api/auth/reset-password', null, {
    email,
    resetToken: verify.body.resetToken,
    newPassword: 'NewSessionPass123!',
  });

  // Verify old access token is now immediately rejected with 401
  const meAfter = await request('GET', '/api/auth/me', oldAccessToken);
  assert.equal(meAfter.status, 401);
  assert.match(meAfter.body.error, /Session expired; please log in again/i);

  // Verify old refresh token is now immediately rejected with 401
  const refreshAfter = await request('POST', '/api/auth/refresh', null, { refreshToken: oldRefreshToken });
  assert.equal(refreshAfter.status, 401);
  assert.match(refreshAfter.body.error, /Invalid refresh token/i);

  // New login produces valid session
  const newLogin = await request('POST', '/api/auth/login', null, { email, password: 'NewSessionPass123!' });
  assert.equal(newLogin.status, 200);
  const meWithNew = await request('GET', '/api/auth/me', newLogin.body.data.accessToken);
  assert.equal(meWithNew.status, 200);
});

test('13. token/OTP/password logging protection: console logging never outputs credentials', async () => {
  const logged = [];
  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;

  const capture = (...args) => {
    logged.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  };
  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;

  try {
    const email = 'logprotect@example.com';
    const secretPassword = 'SecretP@ssword9988!';
    await createTestAccount('logprotect', email, secretPassword);

    await request('POST', '/api/auth/forgot-password', null, { email });
    const code = interceptedEmails[interceptedEmails.length - 1].code;

    const verify = await request('POST', '/api/auth/verify-otp', null, { email, code });
    const resetToken = verify.body.resetToken;

    await request('POST', '/api/auth/reset-password', null, {
      email,
      resetToken,
      newPassword: 'UpdatedSecretP@ss7766!',
    });

    const loginRes = await request('POST', '/api/auth/login', null, {
      email,
      password: 'UpdatedSecretP@ss7766!',
    });
    const accessToken = loginRes.body.data.accessToken;
    const refreshToken = loginRes.body.data.refreshToken;

    // Trigger error cases as well
    await request('POST', '/api/auth/login', null, { email, password: 'wrongpassword' });
    await request('POST', '/api/auth/verify-otp', null, { email, code: '000000' });

    // Assert that NONE of the logged messages contain sensitive secrets
    const allLogs = logged.join('\n');
    assert.equal(allLogs.includes(secretPassword), false, 'Plain password must not be logged');
    assert.equal(allLogs.includes('UpdatedSecretP@ss7766!'), false, 'New password must not be logged');
    assert.equal(allLogs.includes(code), false, 'OTP code must not be logged');
    assert.equal(allLogs.includes(resetToken), false, 'Reset token must not be logged');
    assert.equal(allLogs.includes(accessToken), false, 'Access token must not be logged');
    assert.equal(allLogs.includes(refreshToken), false, 'Refresh token must not be logged');
    assert.equal(allLogs.includes(process.env.RESEND_API_KEY), false, 'Resend API key must not be logged');
  } finally {
    console.log = origLog;
    console.info = origInfo;
    console.warn = origWarn;
    console.error = origError;
  }
});
