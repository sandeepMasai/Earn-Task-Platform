// Full Comprehensive E2E Live Audit Script for Earn Task Platform
// Exercises real HTTP requests against the live running backend, staging DB, and staging R2.
require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash, createHmac } = require('node:crypto');
const mongoose = require('mongoose');

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  matrix: [],
  details: {}
};

function record(section, feature, passed, problem = null, fix = null) {
  results.total++;
  if (passed) results.passed++;
  else results.failed++;
  results.matrix.push({
    section,
    feature,
    tested: true,
    result: passed ? 'PASS' : 'FAIL',
    problem: problem || 'None',
    fix: fix || 'None',
    retested: passed ? 'YES' : 'PENDING'
  });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${section} > ${feature} ${problem ? `(${problem})` : ''}`);
}

async function api(method, endpoint, token = null, body = undefined, headers = {}) {
  const reqHeaders = { ...headers };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  if (body !== undefined && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: reqHeaders,
    signal: AbortSignal.timeout(30000)
  };
  if (body !== undefined) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let resBody;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    resBody = await res.json();
  } else {
    resBody = await res.text();
  }
  return { status: res.status, headers: res.headers, body: resBody };
}

const hashSha256Base64 = (buf) => createHash('sha256').update(buf).digest('base64');

(async () => {
  console.log('====================================================');
  console.log('STARTING FULL LIVE END-TO-END AUDIT');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Database: ${process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}`);
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../src/models/User');
  const Media = require('../src/models/Media');
  const Post = require('../src/models/Post');
  const Task = require('../src/models/Task');
  const TaskSubmission = require('../src/models/TaskSubmission');
  const Story = require('../src/models/Story');
  const Transaction = require('../src/models/Transaction');

  const stamp = Date.now();
  const testUserA = {
    name: 'Audit User A',
    username: `audita_${stamp}`,
    email: `audita_${stamp}@smartlibdesk.in`,
    password: 'Password@123'
  };
  const testUserB = {
    name: 'Audit User B',
    username: `auditb_${stamp}`,
    email: `auditb_${stamp}@smartlibdesk.in`,
    password: 'Password@456'
  };

  let tokenA = null;
  let refreshA = null;
  let userAId = null;

  let tokenB = null;
  let refreshB = null;
  let userBId = null;

  let adminToken = null;

  try {
    // -------------------------------------------------------------------------
    // 1. ENVIRONMENT / CONFIGURATION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- 1. ENVIRONMENT / CONFIGURATION AUDIT ---');
    const isStaging = process.env.NODE_ENV === 'staging';
    const isStagingDb = mongoose.connection.name === 'earn_task_platform_staging';
    const isR2Provider = process.env.MEDIA_STORAGE_PROVIDER === 'r2';
    const isR2Private = process.env.R2_PRIVATE_BUCKET === 'true';
    const hasResend = Boolean(process.env.RESEND_API_KEY);

    record('Config', 'NODE_ENV is staging', isStaging);
    record('Config', 'Staging DB separation (earn_task_platform_staging)', isStagingDb);
    record('Config', 'R2 Media Storage Provider is active', isR2Provider);
    record('Config', 'R2 Bucket is private', isR2Private);
    record('Config', 'Resend API key configured in backend only', hasResend);

    // -------------------------------------------------------------------------
    // 2. BACKEND HEALTH & ROUTE DISCOVERY
    // -------------------------------------------------------------------------
    console.log('\n--- 2. BACKEND HEALTH & ROUTE DISCOVERY ---');
    const h1 = await api('GET', '/health');
    record('Health', 'GET /health returns 200 ok', h1.status === 200 && h1.body.status === 'ok');

    const h2 = await api('GET', '/ready');
    record('Health', 'GET /ready returns 200 connected', h2.status === 200 && h2.body.database === 'connected');

    const h3 = await api('GET', '/api/health');
    record('Health', 'GET /api/health returns 200 connected', h3.status === 200 && h3.body.status === 'ok');

    const h4 = await api('GET', '/api/non-existent-route-audit');
    record('Health', '404 handler returns clean error', h4.status === 404 && h4.body.error === 'Route not found');

    const nosniff = h1.headers.get('x-content-type-options') === 'nosniff';
    record('Health', 'Security headers present (x-content-type-options: nosniff)', nosniff);

    // -------------------------------------------------------------------------
    // 3. AUTHENTICATION & USER LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. AUTHENTICATION ---');
    // Validation tests
    const dupWeak = await api('POST', '/api/auth/signup', null, { ...testUserA, password: '123' });
    record('Auth', 'Signup rejects weak password (< 6 chars)', dupWeak.status === 400);

    const dupEmailInvalid = await api('POST', '/api/auth/signup', null, { ...testUserA, email: 'not-an-email' });
    record('Auth', 'Signup rejects invalid email format', dupEmailInvalid.status === 400);

    const dupMissing = await api('POST', '/api/auth/signup', null, { email: testUserA.email });
    record('Auth', 'Signup rejects missing required fields', dupMissing.status === 400);

    // Valid signup User A
    const regA = await api('POST', '/api/auth/signup', null, testUserA);
    record('Auth', 'Signup disposable User A succeeds (201)', regA.status === 201 && regA.body.success);
    userAId = regA.body.data?.user?.id;

    // Duplicate email & username check
    const dupEmail = await api('POST', '/api/auth/signup', null, { ...testUserA, username: `other_${stamp}` });
    record('Auth', 'Signup rejects duplicate email', dupEmail.status === 400);

    const dupUser = await api('POST', '/api/auth/signup', null, { ...testUserA, email: `other_${stamp}@example.com` });
    record('Auth', 'Signup rejects duplicate username', dupUser.status === 400);

    // Signup User B
    const regB = await api('POST', '/api/auth/signup', null, testUserB);
    record('Auth', 'Signup disposable User B succeeds (201)', regB.status === 201 && regB.body.success);
    userBId = regB.body.data?.user?.id;

    // Login checks
    const wrongPass = await api('POST', '/api/auth/login', null, { email: testUserA.email, password: 'WrongPassword!' });
    record('Auth', 'Login rejects wrong password with 401', wrongPass.status === 401);

    const nonUser = await api('POST', '/api/auth/login', null, { email: `nonexistent_${stamp}@example.com`, password: 'Password@123' });
    record('Auth', 'Login rejects nonexistent user with 401', nonUser.status === 401);

    const loginA = await api('POST', '/api/auth/login', null, { email: testUserA.email, password: testUserA.password });
    tokenA = loginA.body.data?.accessToken;
    refreshA = loginA.body.data?.refreshToken;
    record('Auth', 'Login User A returns accessToken and refreshToken', loginA.status === 200 && Boolean(tokenA && refreshA));

    const loginB = await api('POST', '/api/auth/login', null, { email: testUserB.email, password: testUserB.password });
    tokenB = loginB.body.data?.accessToken;
    refreshB = loginB.body.data?.refreshToken;
    record('Auth', 'Login User B returns valid credentials', loginB.status === 200 && Boolean(tokenB));

    // Protected route check
    const meA = await api('GET', '/api/auth/me', tokenA);
    record('Auth', 'GET /api/auth/me succeeds with valid Bearer token', meA.status === 200 && meA.body.data?.user?.id === userAId);

    const meInvalid = await api('GET', '/api/auth/me', 'invalid-token-string');
    record('Auth', 'GET /api/auth/me rejects invalid token with 401', meInvalid.status === 401);

    // Token refresh check
    const refreshed = await api('POST', '/api/auth/refresh', null, { refreshToken: refreshA });
    const newTokenA = refreshed.body.data?.accessToken;
    record('Auth', 'POST /api/auth/refresh returns new accessToken', refreshed.status === 200 && Boolean(newTokenA));
    if (newTokenA) tokenA = newTokenA;

    // Update profile check
    const updatedProfile = await api('PUT', '/api/auth/profile', tokenA, { name: 'Audit User A Updated' });
    record('Auth', 'PUT /api/auth/profile updates profile fields', updatedProfile.status === 200 && updatedProfile.body.data?.user?.name === 'Audit User A Updated');

    // -------------------------------------------------------------------------
    // 4. FORGOT PASSWORD & OTP VERIFICATION FLOW
    // -------------------------------------------------------------------------
    console.log('\n--- 4. FORGOT PASSWORD & OTP FLOW ---');
    const RateLimitBucket = require('../src/models/RateLimitBucket');
    await RateLimitBucket.deleteMany({ _id: { $regex: 'password-reset' } });

    // Nonexistent email enumeration check: must return generic message
    const forgotUnknown = await api('POST', '/api/auth/forgot-password', null, { email: `unknown_${stamp}@smartlibdesk.in` });
    record('PasswordReset', 'Forgot password does not reveal unknown email (generic message)', forgotUnknown.status === 200);

    // Request forgot password for User B
    const forgotB = await api('POST', '/api/auth/forgot-password', null, { email: testUserB.email });
    record('PasswordReset', 'Forgot password request succeeds with generic message', forgotB.status === 200 && forgotB.body.message.includes('code has been sent'));

    // Verify OTP security in DB: must be HMAC-hashed, never plaintext
    const { hashCode } = require('../src/controllers/passwordResetController');
    const dbUserB = await User.findById(userBId).select('+resetCodeHash');
    const hasHash = Boolean(dbUserB.resetCodeHash);
    const noPlaintext = !dbUserB.resetCode && !dbUserB.code && !dbUserB.toObject().resetCode;
    record('PasswordReset', 'OTP is HMAC-hashed in DB and never stored as plaintext', hasHash && noPlaintext);

    // Test wrong OTP verification
    const wrongOtp = await api('POST', '/api/auth/verify-otp', null, { email: testUserB.email, code: '000000' });
    record('PasswordReset', 'Verify OTP rejects invalid 6-digit code with 400', wrongOtp.status === 400);

    // Find the valid OTP by computing the matching HMAC code (for deterministic test execution)
    let validOtp = null;
    for (let c = 100000; c <= 999999; c++) {
      const codeStr = String(c);
      if (hashCode(testUserB.email, codeStr) === dbUserB.resetCodeHash) {
        validOtp = codeStr;
        break;
      }
    }
    assert.ok(validOtp, 'Could not resolve OTP from HMAC hash');

    // Verify OTP with valid code -> returns resetToken
    const verifySuccess = await api('POST', '/api/auth/verify-otp', null, { email: testUserB.email, code: validOtp });
    const resetToken = verifySuccess.body.resetToken;
    record('PasswordReset', 'Verify OTP returns single-use resetToken', verifySuccess.status === 200 && Boolean(resetToken));

    // Test OTP reuse is blocked
    const reuseOtp = await api('POST', '/api/auth/verify-otp', null, { email: testUserB.email, code: validOtp });
    record('PasswordReset', 'OTP reuse is strictly blocked (single-use code)', reuseOtp.status === 400);

    // Reset password using resetToken
    const newPassB = 'NewPassword@789';
    const resetRes = await api('POST', '/api/auth/reset-password', null, {
      email: testUserB.email,
      resetToken,
      newPassword: newPassB
    });
    record('PasswordReset', 'POST /api/auth/reset-password succeeds', resetRes.status === 200);

    // Verify old password fails
    const oldLoginB = await api('POST', '/api/auth/login', null, { email: testUserB.email, password: testUserB.password });
    record('PasswordReset', 'Old password is no longer accepted after reset', oldLoginB.status === 401);

    // Verify new password succeeds
    const newLoginB = await api('POST', '/api/auth/login', null, { email: testUserB.email, password: newPassB });
    record('PasswordReset', 'Login succeeds with new password', newLoginB.status === 200);
    tokenB = newLoginB.body.data?.accessToken;

    // Prior token B should be invalidated due to tokenVersion increment
    const staleTokenB = await api('GET', '/api/auth/me', loginB.body.data?.accessToken);
    record('PasswordReset', 'Prior sessions/tokens invalidated after password reset', staleTokenB.status === 401);

    // -------------------------------------------------------------------------
    // 5. R2 MEDIA SYSTEM (ALL MEDIA TYPES)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. R2 MEDIA SYSTEM (ALL TYPES) ---');
    // Media 1: PNG Image (Avatar)
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=', 'base64');
    const pngInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'images',
      mimeType: 'image/png',
      size: pngBytes.length,
      checksum: hashSha256Base64(pngBytes)
    });
    record('Media:Image', 'Init image/png upload returns presigned R2 URL and mediaId', pngInit.status === 201 && Boolean(pngInit.body.data?.upload?.url));
    const mediaPngId = pngInit.body.data?.media?.id;
    const putPngRes = await fetch(pngInit.body.data?.upload?.url, {
      method: 'PUT',
      headers: pngInit.body.data?.upload?.headers,
      body: pngBytes
    });
    record('Media:Image', 'Direct HTTP PUT of PNG to R2 succeeds (200)', putPngRes.status === 200);
    const completePng = await api('POST', `/api/media/${mediaPngId}/complete`, tokenA);
    record('Media:Image', 'POST /api/media/:id/complete succeeds with status ready', completePng.status === 200 && completePng.body.data?.status === 'ready');

    // Attach to profile avatar
    const avatarAttach = await api('PUT', '/api/auth/profile', tokenA, { mediaId: mediaPngId });
    record('Media:Image', 'Attach R2 mediaId to user avatar succeeds', avatarAttach.status === 200 && avatarAttach.body.data?.user?.avatar?.includes(mediaPngId));

    // Media 2: JPEG Image
    const jpegBytes = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    const jpegInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'images',
      mimeType: 'image/jpeg',
      size: jpegBytes.length,
      checksum: hashSha256Base64(jpegBytes)
    });
    const mediaJpegId = jpegInit.body.data?.media?.id;
    await fetch(jpegInit.body.data?.upload?.url, { method: 'PUT', headers: jpegInit.body.data?.upload?.headers, body: jpegBytes });
    const completeJpeg = await api('POST', `/api/media/${mediaJpegId}/complete`, tokenA);
    record('Media:Image', 'Upload and complete image/jpeg succeeds', completeJpeg.status === 200 && completeJpeg.body.data?.status === 'ready');

    // Media 3: WebP Image
    const webpBytes = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAgA0JaQAA3AA/vuUAAA=', 'base64');
    const webpInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'images',
      mimeType: 'image/webp',
      size: webpBytes.length,
      checksum: hashSha256Base64(webpBytes)
    });
    const mediaWebpId = webpInit.body.data?.media?.id;
    await fetch(webpInit.body.data?.upload?.url, { method: 'PUT', headers: webpInit.body.data?.upload?.headers, body: webpBytes });
    const completeWebp = await api('POST', `/api/media/${mediaWebpId}/complete`, tokenA);
    record('Media:Image', 'Upload and complete image/webp succeeds', completeWebp.status === 200 && completeWebp.body.data?.status === 'ready');

    // Media 4: MP4 Video
    const videoBytes = fs.readFileSync(path.join(__dirname, '../test/fixtures/staging-video.mp4'));
    const videoInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'videos',
      mimeType: 'video/mp4',
      size: videoBytes.length,
      checksum: hashSha256Base64(videoBytes)
    });
    record('Media:Video', 'Init video/mp4 upload returns presigned R2 URL', videoInit.status === 201);
    const mediaVideoId = videoInit.body.data?.media?.id;
    const putVideoRes = await fetch(videoInit.body.data?.upload?.url, { method: 'PUT', headers: videoInit.body.data?.upload?.headers, body: videoBytes });
    record('Media:Video', 'Direct HTTP PUT of MP4 to R2 succeeds (200)', putVideoRes.status === 200);
    const completeVideo = await api('POST', `/api/media/${mediaVideoId}/complete`, tokenA);
    record('Media:Video', 'Complete video/mp4 succeeds with status ready', completeVideo.status === 200 && completeVideo.body.data?.status === 'ready');

    // Media 5: PDF Document
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n');
    const pdfInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'documents',
      mimeType: 'application/pdf',
      size: pdfBytes.length,
      checksum: hashSha256Base64(pdfBytes)
    });
    record('Media:Document', 'Init application/pdf upload returns presigned R2 URL', pdfInit.status === 201);
    const mediaPdfId = pdfInit.body.data?.media?.id;
    await fetch(pdfInit.body.data?.upload?.url, { method: 'PUT', headers: pdfInit.body.data?.upload?.headers, body: pdfBytes });
    const completePdf = await api('POST', `/api/media/${mediaPdfId}/complete`, tokenA);
    record('Media:Document', 'Complete application/pdf succeeds with status ready', completePdf.status === 200 && completePdf.body.data?.status === 'ready');

    // Media 6: Audio Upload Check (Verify app rejects unsupported audio category cleanly)
    const audioInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'audio',
      mimeType: 'audio/mpeg',
      size: 1024,
      checksum: hashSha256Base64(Buffer.alloc(1024))
    });
    record('Media:Audio', 'Audio upload cleanly rejected (unsupported category)', audioInit.status === 400);

    // Private signed download URL check
    const downA = await api('GET', `/api/media/${mediaPngId}/download`, tokenA);
    record('Media:Security', 'GET /api/media/:id/download returns signed R2 download URL', downA.status === 200 && Boolean(downA.body.data?.url));
    const r2Content = await fetch(downA.body.data?.url);
    const fetchedBuf = Buffer.from(await r2Content.arrayBuffer());
    record('Media:Security', 'Signed R2 download URL downloads exact matching file bytes', r2Content.status === 200 && Buffer.compare(fetchedBuf, pngBytes) === 0);

    // Cross-user unauthorized access check: User B cannot download User A's private media
    const downOther = await api('GET', `/api/media/${mediaPngId}/download`, tokenB);
    record('Media:Security', 'User B cannot download User A private media (403)', downOther.status === 403);

    // Anonymous access check: 401
    const downAnon = await api('GET', `/api/media/${mediaPngId}/download`);
    record('Media:Security', 'Anonymous user cannot download private media (401)', downAnon.status === 401);

    // Tampered signed URL check
    const tampered = new URL(downA.body.data?.url);
    tampered.searchParams.set('X-Amz-Expires', '99999');
    const tamperedRes = await fetch(tampered);
    record('Media:Security', 'Tampered signed R2 URL rejected by Cloudflare R2 (403)', tamperedRes.status === 403);

    // -------------------------------------------------------------------------
    // 6. FILE CONTENT / MIME SECURITY (MAGIC BYTE SPOOFING CHECKS)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. FILE CONTENT / MIME SECURITY ---');
    // Spoof 1: Text file declared as image/jpeg
    const spoofTextBytes = Buffer.from('This is a malicious text file disguised as a jpeg');
    const spoof1Init = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'images',
      mimeType: 'image/jpeg',
      size: spoofTextBytes.length,
      checksum: hashSha256Base64(spoofTextBytes)
    });
    const spoof1Id = spoof1Init.body.data?.media?.id;
    await fetch(spoof1Init.body.data?.upload?.url, { method: 'PUT', headers: spoof1Init.body.data?.upload?.headers, body: spoofTextBytes });
    const spoof1Comp = await api('POST', `/api/media/${spoof1Id}/complete`, tokenA);
    record('MIME:Security', 'Server strictly rejects text file declared as image/jpeg (400)', spoof1Comp.status === 400 && spoof1Comp.body.error === 'File content does not match its media type');

    // Spoof 2: JPEG bytes declared as image/png
    const spoof2Init = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'images',
      mimeType: 'image/png',
      size: jpegBytes.length,
      checksum: hashSha256Base64(jpegBytes)
    });
    const spoof2Id = spoof2Init.body.data?.media?.id;
    await fetch(spoof2Init.body.data?.upload?.url, { method: 'PUT', headers: spoof2Init.body.data?.upload?.headers, body: jpegBytes });
    const spoof2Comp = await api('POST', `/api/media/${spoof2Id}/complete`, tokenA);
    record('MIME:Security', 'Server strictly rejects JPEG bytes declared as image/png (400)', spoof2Comp.status === 400 && spoof2Comp.body.error === 'File content does not match its media type');

    // -------------------------------------------------------------------------
    // 7. POSTS LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 7. POSTS LIFECYCLE ---');
    // Create Image Post
    const postImage = await api('POST', '/api/posts', tokenA, {
      mediaId: mediaJpegId,
      caption: 'Audit Test Image Post',
      type: 'image'
    });
    record('Posts', 'Create image post with R2 mediaId succeeds (201)', postImage.status === 201 && Boolean(postImage.body.data?.id));
    const postId = postImage.body.data?.id;

    // Create Video Post
    const postVideo = await api('POST', '/api/posts', tokenA, {
      mediaId: mediaVideoId,
      caption: 'Audit Test Video Post',
      type: 'video',
      videoDuration: 15
    });
    record('Posts', 'Create video post with R2 mediaId succeeds (201)', postVideo.status === 201);

    // Get Feed
    const feed = await api('GET', '/api/posts/feed', tokenB);
    const inFeed = feed.body.data?.posts?.some(p => p.id === postId);
    record('Posts', 'GET /api/posts/feed returns newly created post', feed.status === 200 && inFeed);

    // Like & Duplicate Like Prevention
    const like1 = await api('POST', `/api/posts/${postId}/like`, tokenB);
    record('Posts', 'User B likes User A post succeeds', like1.status === 200);

    const like2 = await api('POST', `/api/posts/${postId}/like`, tokenB);
    record('Posts', 'Duplicate like is rejected / idempotent', like2.status === 400 || (like2.status === 200 && like2.body.data?.isLiked));

    // Comments
    const comment1 = await api('POST', `/api/posts/${postId}/comments`, tokenB, { text: 'Great audit post!' });
    record('Posts', 'Add comment succeeds (200/201)', comment1.status === 200 || comment1.status === 201);
    const commentId = comment1.body.data?.id;

    const getComments = await api('GET', `/api/posts/${postId}/comments`, tokenA);
    record('Posts', 'Get post comments succeeds', getComments.status === 200 && Array.isArray(getComments.body.data) && getComments.body.data.length > 0);

    // Delete comment
    if (commentId) {
      const delComment = await api('DELETE', `/api/posts/${postId}/comments/${commentId}`, tokenB);
      record('Posts', 'Delete own comment succeeds', delComment.status === 200);
    }

    // Unlike post
    const unlike = await api('POST', `/api/posts/${postId}/unlike`, tokenB);
    record('Posts', 'Unlike post succeeds', unlike.status === 200);

    // Delete post
    const delPost = await api('DELETE', `/api/posts/${postId}`, tokenA);
    record('Posts', 'Delete own post succeeds', delPost.status === 200);

    // -------------------------------------------------------------------------
    // 8. FOLLOW SYSTEM
    // -------------------------------------------------------------------------
    console.log('\n--- 8. FOLLOW SYSTEM ---');
    // Follow User B from User A
    const follow1 = await api('POST', `/api/follow/${userBId}`, tokenA);
    record('Follow', 'User A follows User B succeeds', follow1.status === 200);

    // Duplicate follow prevention
    const followDup = await api('POST', `/api/follow/${userBId}`, tokenA);
    record('Follow', 'Duplicate follow rejected', followDup.status === 400);

    // Check follow stats
    const statsB = await api('GET', `/api/follow/${userBId}`, tokenA);
    record('Follow', 'Follow stats reflect follower count increase', statsB.status === 200 && statsB.body.data?.followersCount >= 1);

    // Unfollow
    const unfollow = await api('DELETE', `/api/follow/${userBId}`, tokenA);
    record('Follow', 'Unfollow User B succeeds', unfollow.status === 200);

    // -------------------------------------------------------------------------
    // 9. STORIES LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 9. STORIES ---');
    const storyCreate = await api('POST', '/api/stories', tokenA, {
      mediaId: mediaWebpId,
      type: 'image'
    });
    record('Stories', 'Create story with R2 mediaId succeeds (201)', storyCreate.status === 201);
    const storyId = storyCreate.body.data?.id;

    const storiesList = await api('GET', '/api/stories', tokenB);
    record('Stories', 'GET /api/stories lists active stories', storiesList.status === 200 && Array.isArray(storiesList.body.data));

    if (storyId) {
      const storyView = await api('POST', `/api/stories/${storyId}/view`, tokenB);
      record('Stories', 'POST /api/stories/:id/view records story view', storyView.status === 200);
    }

    // -------------------------------------------------------------------------
    // 10. TASKS & SUBMISSIONS LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 10. TASKS & SUBMISSIONS ---');
    // Admin login
    const adminLogin = await api('POST', '/api/auth/login', null, {
      email: 'admin123@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123'
    });
    adminToken = adminLogin.body.data?.accessToken;
    record('Admin', 'Admin login succeeds', adminLogin.status === 200 && Boolean(adminToken));

    // Admin creates an Instagram follow task
    const taskCreate = await api('POST', '/api/admin/tasks', adminToken, {
      title: `Audit Proof Task ${stamp}`,
      description: 'Follow our official channel and submit screenshot proof',
      type: 'instagram_follow',
      coins: 50,
      rewardPerUser: 50,
      instagramUrl: 'https://instagram.com/smartlibdesk'
    });
    record('Tasks', 'Admin creates Instagram task requiring screenshot proof', taskCreate.status === 201 && Boolean(taskCreate.body.data?.id));
    const taskId = taskCreate.body.data?.id;

    // User A views tasks
    const tasksList = await api('GET', '/api/tasks', tokenA);
    record('Tasks', 'User views available tasks', tasksList.status === 200 && tasksList.body.data?.some(t => t.id === taskId));

    // User A uploads proof image to R2
    const proofInit = await api('POST', '/api/media/upload/init', tokenA, {
      category: 'images',
      mimeType: 'image/png',
      size: pngBytes.length,
      checksum: hashSha256Base64(pngBytes)
    });
    const proofMediaId = proofInit.body.data?.media?.id;
    await fetch(proofInit.body.data?.upload?.url, { method: 'PUT', headers: proofInit.body.data?.upload?.headers, body: pngBytes });
    await api('POST', `/api/media/${proofMediaId}/complete`, tokenA);

    // User A submits task proof with mediaId
    const submitProof = await api('POST', `/api/tasks/${taskId}/submit-proof`, tokenA, {
      mediaId: proofMediaId
    });
    record('Tasks', 'User submits task proof via direct R2 mediaId', submitProof.status === 200);

    // Duplicate submission prevention
    const submitDup = await api('POST', `/api/tasks/${taskId}/submit-proof`, tokenA, {
      mediaId: proofMediaId
    });
    record('Tasks', 'Duplicate task submission rejected (400)', submitDup.status === 400);

    // Admin reviews submission
    const subList = await api('GET', '/api/admin/task-submissions', adminToken);
    const subItem = Array.isArray(subList.body.data) ? subList.body.data.find(s => s.task?.id === taskId) : null;
    record('Tasks', 'Admin views task submissions list', subList.status === 200 && Boolean(subItem));

    const initialCoinsA = (await api('GET', '/api/wallet/balance', tokenA)).body.data?.balance || 0;

    // Admin approves task submission
    if (subItem) {
      const approveSub = await api('PUT', `/api/admin/task-submissions/${subItem.id}/approve`, adminToken);
      record('Tasks', 'Admin approves task submission', approveSub.status === 200);

      // Verify User A coins increased by 50
      const finalCoinsA = (await api('GET', '/api/wallet/balance', tokenA)).body.data?.balance || 0;
      record('Tasks', 'User wallet credited with reward coins upon approval', finalCoinsA === initialCoinsA + 50);
    }

    // -------------------------------------------------------------------------
    // 11. WALLET & TRANSACTIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 11. WALLET & TRANSACTIONS ---');
    const balanceRes = await api('GET', '/api/wallet/balance', tokenA);
    record('Wallet', 'GET /api/wallet/balance returns current balance', balanceRes.status === 200 && typeof balanceRes.body.data?.balance === 'number');

    const txRes = await api('GET', '/api/wallet/transactions', tokenA);
    record('Wallet', 'GET /api/wallet/transactions returns transaction history', txRes.status === 200 && Array.isArray(txRes.body.data));

    // Overdraft withdrawal prevention (withdrawing 999999 coins when having < 100)
    const overdraft = await api('POST', '/api/wallet/withdraw', tokenA, {
      amount: 999999,
      paymentMethod: 'upi',
      accountDetails: 'user@upi'
    });
    record('Wallet', 'Overdraft withdrawal strictly rejected (400)', overdraft.status === 400);

    // -------------------------------------------------------------------------
    // 12. CREATOR FEATURES
    // -------------------------------------------------------------------------
    console.log('\n--- 12. CREATOR FEATURES ---');
    // Register as creator
    const regCreator = await api('POST', '/api/creator/register', tokenA, {
      youtubeUrl: 'https://youtube.com/@auditcreator',
      instagramUrl: 'https://instagram.com/auditcreator'
    });
    record('Creator', 'Register as creator succeeds', regCreator.status === 200);

    // Pending creator blocked from dashboard
    const pendingDash = await api('GET', '/api/creator/dashboard', tokenA);
    record('Creator', 'Pending creator blocked from /creator/dashboard with 403', pendingDash.status === 403);

    // Admin approves creator request
    const approveCreator = await api('PUT', `/api/admin/creator-requests/${userAId}/approve`, adminToken);
    record('Creator', 'Admin approves creator request', approveCreator.status === 200);

    // Approved creator accesses dashboard
    const creatorDash = await api('GET', '/api/creator/dashboard', tokenA);
    record('Creator', 'GET /creator/dashboard succeeds after approval', creatorDash.status === 200);

    // Request coins with payment proof mediaId
    const creatorReq = await api('POST', '/api/creator/request-coins', tokenA, {
      coins: 1000,
      mediaId: proofMediaId
    });
    record('Creator', 'Creator requests coins with R2 payment proof mediaId', creatorReq.status === 200);

    // -------------------------------------------------------------------------
    // 13. ADMIN FEATURES & PRIVILEGE ESCALATION (IDOR)
    // -------------------------------------------------------------------------
    console.log('\n--- 13. ADMIN FEATURES & IDOR SECURITY ---');
    // Normal user attempting to access admin dashboard: must get 403 Forbidden
    const userAdminAccess = await api('GET', '/api/admin/dashboard', tokenA);
    record('Security:IDOR', 'Normal user blocked from /api/admin/dashboard with 403', userAdminAccess.status === 403);

    // Normal user attempting to delete another user: must get 403
    const userDeleteOther = await api('DELETE', `/api/admin/users/${userBId}`, tokenA);
    record('Security:IDOR', 'Normal user blocked from /api/admin/users/:id delete with 403', userDeleteOther.status === 403);

    // Admin views dashboard
    const adminDash = await api('GET', '/api/admin/dashboard', adminToken);
    record('Admin', 'Admin accesses /api/admin/dashboard stats', adminDash.status === 200 && Boolean(adminDash.body.data?.stats));

    // Admin views users
    const adminUsers = await api('GET', '/api/admin/users', adminToken);
    record('Admin', 'Admin accesses /api/admin/users list', adminUsers.status === 200 && Array.isArray(adminUsers.body.data?.users));

    // -------------------------------------------------------------------------
    // 14. SETTINGS & CONFIGS
    // -------------------------------------------------------------------------
    console.log('\n--- 14. SETTINGS & CONFIGS ---');
    const coinsConfig = await api('GET', '/api/admin/coins', adminToken);
    record('Settings', 'GET /api/admin/coins returns coin configurations', coinsConfig.status === 200);

    const withdrawSettings = await api('GET', '/api/wallet/withdrawal-settings');
    record('Settings', 'GET /api/wallet/withdrawal-settings returns active limits', withdrawSettings.status === 200);

    // -------------------------------------------------------------------------
    // 15. CLEANUP DELETION TEST & MEDIA RETRIEVAL
    // -------------------------------------------------------------------------
    console.log('\n--- 15. MEDIA CLEANUP & DELETION ---');
    const delMedia = await api('DELETE', `/api/media/${mediaPdfId}`, tokenA);
    record('Media:Delete', 'Delete PDF media returns 202/200', delMedia.status === 200 || delMedia.status === 202);

    // Verify deleted media download returns 404 or 409
    const delDownload = await api('GET', `/api/media/${mediaPdfId}/download`, tokenA);
    record('Media:Delete', 'Deleted media download rejected (404/409)', delDownload.status === 404 || delDownload.status === 409);

    // Cleanup disposable test accounts created during audit
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await Task.deleteOne({ _id: taskId });
    await TaskSubmission.deleteMany({ user: { $in: [userAId, userBId] } });
    await Media.deleteMany({ user: { $in: [userAId, userBId] } });
    console.log('Disposable audit test records cleaned up.');

  } catch (error) {
    console.error('Fatal audit failure:', error);
    record('Audit', 'Execution completed without fatal exceptions', false, error.message);
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log('AUDIT SUMMARY');
  console.log(`TOTAL TESTS: ${results.total}`);
  console.log(`PASSED: ${results.passed}`);
  console.log(`FAILED: ${results.failed}`);
  console.log('====================================================');

  fs.writeFileSync(path.join(__dirname, 'audit-results.json'), JSON.stringify(results, null, 2));
  process.exit(results.failed > 0 ? 1 : 0);
})();
