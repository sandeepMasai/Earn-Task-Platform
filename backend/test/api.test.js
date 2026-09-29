const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// Never load .env or use the application's database/cloud credentials.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'isolated-test-refresh-secret';
for (const key of ['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[key];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'earn-api-test-'));
process.env.UPLOAD_DIR = path.join(directory, 'uploads');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const Withdrawal = require('../src/models/Withdrawal');
const Transaction = require('../src/models/Transaction');
const TaskSubmission = require('../src/models/TaskSubmission');
const CoinConfig = require('../src/models/CoinConfig');
let mongo, server, base, user, admin, creator, other;
const coverage = new Set();
const outcomes = [];
async function request(method, route, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  outcomes.push({ method, route: route.split('?')[0], status: response.status });
  coverage.add(`${method} ${route.split('?')[0]}`);
  return { status: response.status, body: data };
}
function status(result, expected) { assert.equal(result.status, expected, JSON.stringify(result.body)); return result.body.data; }
async function account(name, role = 'user') {
  const data = status(await request('POST', '/api/auth/signup', null, { email: `${name}@example.com`, password: 'TestPass123!', name, username: name }), 201);
  if (role !== 'user') await User.updateOne({ _id: data.user.id }, { role, ...(role === 'creator' ? { isCreator: true, creatorStatus: 'approved', creatorWallet: 10000 } : {}) });
  return { ...data, id: data.user.id, token: data.accessToken };
}
function upload(field, values = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  body.set(field, new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'test.png');
  return body;
}
before(async () => {
  const instance = await require('./support/mongo').startMongo(directory);
  mongo = instance.child;
  await mongoose.connect(instance.uri, { serverSelectionTimeoutMS: 15000 });
  const app = require('../src/server');
  for (const model of Object.values(mongoose.models)) await model.init();
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
  user = await account('user'); admin = await account('admin', 'admin'); creator = await account('creator', 'creator'); other = await account('other');
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await require('./support/mongo').stopMongo(mongo);
  fs.rmSync(directory, { recursive: true, force: true });
  console.log(`Exercised ${coverage.size} concrete API method/path combinations`);
});

async function watched(taskId, account, seconds) {
  let time = Date.now();
  const service = require('../src/services/watchSessions').createService(() => time);
  const session = await service.start(taskId, account.id);
  for (let position = 5, sequence = 1; position <= seconds; position += 5, sequence++) {
    time += 5000;
    await service.heartbeat(taskId, account.id, { sessionId: session.sessionId, playbackPosition: position, clientTimestamp: time, sequence });
  }
  return session.sessionId;
}

beforeEach(async () => { await require('../src/models/RateLimitBucket').deleteMany({}); });

test('health, auth, token separation, blocking and validation', async () => {
  status(await request('GET', '/api/health'), 200);
  status(await request('POST', '/api/auth/signup', null, {}), 400);
  status(await request('POST', '/api/auth/login', null, { email: 'user@example.com', password: 'wrong' }), 401);
  const login = status(await request('POST', '/api/auth/login', null, { email: 'USER@example.com', password: 'TestPass123!' }), 200);
  assert.equal(new Date(login.expiresAt).getTime(), require('jsonwebtoken').decode(login.accessToken).exp * 1000);
  status(await request('GET', '/api/auth/me', user.token), 200);
  status(await request('GET', '/api/auth/me', user.refreshToken), 401);
  status(await request('POST', '/api/auth/refresh', null, { refreshToken: user.token }), 401);
  status(await request('POST', '/api/auth/refresh', null, { refreshToken: user.refreshToken }), 200);
  status(await request('PUT', `/api/admin/users/${user.id}/block`, admin.token, { isActive: false }), 200);
  status(await request('GET', '/api/auth/me', user.token), 403);
  status(await request('POST', '/api/auth/login', null, { email: 'user@example.com', password: 'TestPass123!' }), 403);
  status(await request('POST', '/api/auth/refresh', null, { refreshToken: user.refreshToken }), 403);
  status(await request('PUT', `/api/admin/users/${user.id}/block`, admin.token, { isActive: true }), 200);
  status(await request('PUT', '/api/auth/profile', user.token, { name: 'Updated' }), 200);
  status(await request('PUT', '/api/auth/instagram-id', user.token, { instagramId: 'tester' }), 200);
  status(await request('GET', `/api/auth/user/${other.id}`, user.token), 200);
  status(await request('PUT', '/api/auth/change-password', other.token, { oldPassword: 'TestPass123!', newPassword: 'Changed123!' }), 200);
  status(await request('POST', '/api/auth/logout', user.token), 200);
  status(await request('GET', '/api/posts/feed?page=-1', user.token), 400);
  status(await request('GET', '/api/tasks/not-an-id', user.token), 400);
  status(await request('GET', '/api/admin/users?search[$ne]=x', admin.token), 400);
});

test('all protected routes reject missing tokens; ordinary users cannot access admin APIs', async () => {
  const app = require('../src/server');
  const mounts = { authRoutes: '/api/auth', taskRoutes: '/api/tasks', walletRoutes: '/api/wallet', postRoutes: '/api/posts', referralRoutes: '/api/referrals', adminRoutes: '/api/admin', adminTaskRoutes: '/api/admin/tasks', creatorRoutes: '/api/creator', storyRoutes: '/api/stories', followRoutes: '/api/follow', mediaRoutes: '/api/media' };
  const publicPaths = new Set(['/api/auth/signup', '/api/auth/login', '/api/auth/refresh', '/api/referrals/check/:code', '/api/wallet/withdrawal-settings']);
  let count = 0;
  for (const [file, prefix] of Object.entries(mounts)) {
    const router = require('../src/routes/' + file);
    for (const layer of router.stack.filter(l => l.route)) {
      const template = prefix + (layer.route.path === '/' ? '' : layer.route.path);
      if (publicPaths.has(template)) continue;
      const route = template.replace(/:(id|userId)/g, user.id).replace(':key', 'WATCH_VIDEO');
      for (const method of Object.keys(layer.route.methods)) {
        status(await request(method.toUpperCase(), route), 401); count++;
        if (prefix.startsWith('/api/admin')) status(await request(method.toUpperCase(), route, user.token, method === 'get' ? undefined : {}), 403);
      }
    }
  }
  assert.ok(count > 60);
});

test('withdrawals reserve once, refund once, and reject concurrent overspending', async () => {
  await User.updateOne({ _id: user.id }, { coins: 3000, totalWithdrawn: 0 });
  const payload = { amount: 1000, paymentMethod: 'UPI', accountDetails: 'test@upi' };
  for (const bad of [{ amount: -1 }, { amount: '1000' }, { paymentMethod: 'invalid' }, { amount: 1.5 }]) status(await request('POST', '/api/wallet/withdraw', user.token, { ...payload, ...bad }), 400);
  assert.equal((await User.findById(user.id)).coins, 3000);
  const w = status(await request('POST', '/api/wallet/withdraw', user.token, payload), 201);
  status(await request('PUT', `/api/admin/payments/${w.id}/status`, admin.token, { status: 'approved' }), 200);
  assert.equal((await User.findById(user.id)).coins, 2000);
  status(await request('PUT', `/api/admin/payments/${w.id}/status`, admin.token, { status: 'rejected' }), 200);
  status(await request('PUT', `/api/admin/payments/${w.id}/status`, admin.token, { status: 'rejected' }), 400);
  assert.equal((await User.findById(user.id)).coins, 3000);
  await User.updateOne({ _id: user.id }, { coins: 1000 });
  const results = await Promise.all([request('POST', '/api/wallet/withdraw', user.token, payload), request('POST', '/api/wallet/withdraw', user.token, payload)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400]);
  const pending = results.find(r => r.status === 201).body.data;
  status(await request('PUT', `/api/admin/payments/${pending.id}/status`, admin.token, { status: 'rejected' }), 200);
  assert.equal((await User.findById(user.id)).coins, 1000);
  for (const route of ['/api/wallet/balance', '/api/wallet/transactions', '/api/wallet/withdrawals', '/api/wallet/withdrawal-settings', '/api/admin/payments', '/api/admin/payments/download']) status(await request('GET', route, admin.token), 200);
});

test('task CRUD, completion validation, duplicate reward protection and proof review', async () => {
  const video = status(await request('POST', '/api/admin/tasks', admin.token, { type: 'watch_video', title: 'Video', description: 'Test', coins: 10, videoUrl: 'https://example.com/video.mp4', videoDuration: 100 }), 201);
  for (const duration of [undefined, 'bad', 5]) status(await request('POST', `/api/tasks/${video.id}/complete`, user.token, duration === undefined ? {} : { watchDuration: duration }), 400);
  const sessionId = await watched(video.id, user, 90);
  const prior = (await User.findById(user.id)).coins;
  const results = await Promise.all([request('POST', `/api/tasks/${video.id}/complete`, user.token, { sessionId }), request('POST', `/api/tasks/${video.id}/complete`, user.token, { sessionId })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await User.findById(user.id)).coins, prior + 10);
  for (const route of ['/api/tasks', `/api/tasks/${video.id}`, '/api/admin/tasks', `/api/admin/tasks/${video.id}`, `/api/admin/tasks/${video.id}/completions`]) status(await request('GET', route, admin.token), 200);
  status(await request('PUT', `/api/admin/tasks/${video.id}`, admin.token, { isActive: false }), 200);
  status(await request('POST', `/api/tasks/${video.id}/complete`, other.token, { sessionId }), 400);
  const social = status(await request('POST', '/api/admin/tasks', admin.token, { type: 'instagram_follow', title: 'Follow', description: 'Test', coins: 20, instagramUrl: 'https://instagram.com/example' }), 201);
  status(await request('POST', `/api/tasks/${social.id}/complete`, user.token, {}), 400);
  assert.equal(status(await request('POST', '/api/tasks/verify/instagram-follow', user.token, {}), 200).verified, false);
  assert.equal(status(await request('POST', '/api/tasks/verify/youtube-subscribe', user.token, {}), 200).verified, false);
  const proof = status(await request('POST', `/api/tasks/${social.id}/submit-proof`, user.token, upload('proofImage')), 200);
  status(await request('POST', `/api/tasks/${social.id}/submit-proof`, user.token, upload('proofImage')), 400);
  status(await request('GET', '/api/admin/task-submissions', admin.token), 200);
  status(await request('GET', `/api/admin/task-submissions/${proof.submissionId}`, admin.token), 200);
  status(await request('PUT', `/api/admin/task-submissions/${proof.submissionId}/reject`, admin.token, { rejectionReason: 'Try again' }), 200);
  status(await request('POST', `/api/tasks/${social.id}/submit-proof`, user.token, upload('proofImage')), 200);
  const approvals = await Promise.all([request('PUT', `/api/admin/task-submissions/${proof.submissionId}/approve`, admin.token, {}), request('PUT', `/api/admin/task-submissions/${proof.submissionId}/approve`, admin.token, {})]);
  assert.deepEqual(approvals.map(r => r.status).sort(), [200, 400]);
  status(await request('DELETE', `/api/admin/tasks/${video.id}`, admin.token), 200);
});

test('creator funding, budget edits, ownership and refunds', async () => {
  status(await request('POST', '/api/creator/register', other.token, { youtubeUrl: 'https://youtube.com/@test' }), 200);
  status(await request('GET', '/api/admin/creator-requests', admin.token), 200);
  status(await request('PUT', `/api/admin/creator-requests/${other.id}/approve`, admin.token, {}), 200);
  status(await request('GET', '/api/creator/request-history', other.token), 200);
  const coin = status(await request('POST', '/api/creator/request-coins', creator.token, upload('paymentProof', { coins: '1000' })), 200);
  const results = await Promise.all([request('PUT', `/api/admin/creator-coin-requests/${coin.requestId}/approve`, admin.token, {}), request('PUT', `/api/admin/creator-coin-requests/${coin.requestId}/approve`, admin.token, {})]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await User.findById(creator.id)).creatorWallet, 11000);
  const rejectedCoin = status(await request('POST', '/api/creator/request-coins', creator.token, upload('paymentProof', { coins: '1000' })), 200);
  status(await request('PUT', `/api/admin/creator-coin-requests/${rejectedCoin.requestId}/reject`, admin.token, {}), 200);
  const task = status(await request('POST', '/api/creator/tasks', creator.token, { type: 'youtube_subscribe', title: 'Creator test', description: 'Test', rewardPerUser: 10, maxUsers: 10, youtubeUrl: 'https://youtube.com/@test' }), 201);
  assert.equal((await User.findById(creator.id)).creatorWallet, 10900);
  status(await request('PUT', `/api/creator/tasks/${task.id}`, creator.token, { maxUsers: 20 }), 200);
  assert.equal((await User.findById(creator.id)).creatorWallet, 10800);
  status(await request('PUT', `/api/creator/tasks/${task.id}`, creator.token, { maxUsers: 5 }), 200);
  assert.equal((await User.findById(creator.id)).creatorWallet, 10950);
  status(await request('PUT', `/api/creator/tasks/${task.id}`, creator.token, { maxUsers: 999999 }), 400);
  status(await request('DELETE', `/api/creator/tasks/${task.id}`, other.token), 403);
  const proof = status(await request('POST', `/api/tasks/${task.id}/submit-proof`, user.token, upload('proofImage')), 200);
  for (const route of ['/api/creator/dashboard', '/api/creator/tasks', '/api/creator/coin-requests', '/api/creator/task-submissions', `/api/creator/task-submissions/${proof.submissionId}`]) status(await request('GET', route, creator.token), 200);
  status(await request('PUT', `/api/creator/task-submissions/${proof.submissionId}/reject`, creator.token, {}), 200);
  status(await request('POST', `/api/tasks/${task.id}/submit-proof`, user.token, upload('proofImage')), 200);
  status(await request('PUT', `/api/creator/task-submissions/${proof.submissionId}/approve`, creator.token, {}), 200);
  status(await request('DELETE', `/api/creator/tasks/${task.id}`, creator.token), 200);
  assert.equal((await User.findById(creator.id)).creatorWallet, 10990);
  status(await request('GET', '/api/admin/creator-coin-requests', admin.token), 200);
  status(await request('PUT', `/api/admin/creator-requests/${other.id}/reject`, admin.token, {}), 200);
});

test('posts, comments, likes, follows, stories, referrals and settings', async () => {
  const post = status(await request('POST', '/api/posts', user.token, upload('image', { caption: 'Test', type: 'image' })), 201);
  for (const route of ['/api/posts/feed', '/api/posts/me', `/api/posts/${post.id}`]) status(await request('GET', route, user.token), 200);
  status(await request('PUT', `/api/posts/${post.id}`, other.token, { caption: 'No' }), 403);
  status(await request('PUT', `/api/posts/${post.id}`, user.token, { caption: '' }), 200);
  status(await request('GET', '/api/admin/coins', admin.token), 200);
  status(await request('PUT', '/api/admin/coins/POST_LIKE', admin.token, { value: 5 }), 200);
  status(await request('PUT', '/api/admin/coins', admin.token, { configs: [{ key: 'POST_UPLOAD', value: 30 }] }), 200);
  status(await request('PUT', '/api/admin/coins', admin.token, { configs: [{ key: 'POST_UPLOAD', value: -10 }] }), 400);
  const before = (await User.findById(other.id)).coins;
  status(await request('POST', `/api/posts/${post.id}/like`, other.token, {}), 200);
  status(await request('POST', `/api/posts/${post.id}/unlike`, other.token, {}), 200);
  status(await request('POST', `/api/posts/${post.id}/like`, other.token, {}), 200);
  assert.equal((await User.findById(other.id)).coins, before + 5);
  status(await request('POST', `/api/posts/${post.id}/comments`, other.token, { text: 'Hello' }), 200);
  status(await request('GET', `/api/posts/${post.id}/comments`, user.token), 200);
  status(await request('POST', `/api/follow/${user.id}`, other.token, {}), 200);
  status(await request('GET', `/api/follow/${user.id}`, other.token), 200);
  status(await request('DELETE', `/api/follow/${user.id}`, other.token), 200);
  const story = status(await request('POST', '/api/stories', user.token, upload('media', { type: 'image' })), 201);
  status(await request('GET', '/api/stories', user.token), 200);
  status(await request('POST', `/api/stories/${story.id}/view`, other.token, {}), 200);
  status(await request('GET', '/api/referrals/stats', user.token), 200);
  assert.equal(status(await request('GET', `/api/referrals/check/${user.user.referralCode}`), 200).valid, true);
  status(await request('GET', '/api/admin/dashboard', admin.token), 200);
  status(await request('GET', '/api/admin/users', admin.token), 200);
  status(await request('GET', `/api/admin/users/${user.id}`, admin.token), 200);
  status(await request('GET', '/api/admin/withdrawal-settings', admin.token), 200);
  status(await request('PUT', '/api/admin/withdrawal-settings', admin.token, { minimumWithdrawalAmount: 1000, withdrawalAmounts: [1000, 2000] }), 200);
  status(await request('DELETE', `/api/posts/${post.id}`, user.token), 200);
  const disposable = await account('disposable');
  status(await request('DELETE', `/api/admin/users/${disposable.id}`, admin.token), 200);
});

test('failed ledger writes roll back wallet and task changes', async () => {
  await User.updateOne({ _id: user.id }, { coins: 2000 });
  const beforeWithdrawals = await Withdrawal.countDocuments();
  const create = Transaction.create;
  try {
    Transaction.create = async () => { throw Object.assign(new Error('Injected ledger failure'), { status: 503 }); };
    status(await request('POST', '/api/wallet/withdraw', user.token, { amount: 1000, paymentMethod: 'UPI', accountDetails: 'test@upi' }), 503);
    assert.equal((await User.findById(user.id)).coins, 2000);
    assert.equal(await Withdrawal.countDocuments(), beforeWithdrawals);
    const task = await Task.create({ type: 'watch_video', title: 'Rollback test', description: 'Test', coins: 50, videoUrl: 'https://example.com/v.mp4', videoDuration: 10 });
    const sessionId = await watched(task.id, user, 10);
    status(await request('POST', `/api/tasks/${task.id}/complete`, user.token, { sessionId }), 503);
    assert.equal((await Task.findById(task.id)).completedBy.length, 0);
    assert.equal((await User.findById(user.id)).coins, 2000);
  } finally { Transaction.create = create; }
});

test('referral reward, concurrent follows, malformed payloads and missing resources', async () => {
  const before = (await User.findById(user.id)).coins;
  status(await request('POST', '/api/auth/signup', null, { email: 'referred@example.com', password: 'Pass123!', name: 'Referred', username: 'referred', referralCode: user.user.referralCode }), 201);
  assert.equal((await User.findById(user.id)).coins, before + 500);
  const results = await Promise.all([request('POST', `/api/follow/${user.id}`, other.token), request('POST', `/api/follow/${user.id}`, other.token)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
  assert.equal((await User.findById(user.id)).followers.filter(id => id.equals(other.id)).length, 1);
  status(await request('PUT', '/api/auth/profile', user.token, { username: { $ne: '' } }), 400);
  status(await request('PUT', '/api/admin/coins/INVALID', admin.token, { value: 10 }), 400);
  status(await request('PUT', '/api/admin/withdrawal-settings', admin.token, { minimumWithdrawalAmount: 'invalid' }), 400);
  const missing = '000000000000000000000001';
  for (const route of [`/api/tasks/${missing}`, `/api/posts/${missing}`, `/api/auth/user/${missing}`, `/api/admin/users/${missing}`, `/api/admin/task-submissions/${missing}`, `/api/creator/task-submissions/${missing}`]) status(await request('GET', route, route.startsWith('/api/admin') ? admin.token : creator.token), 404);
  const badUpload = new FormData(); badUpload.set('image', new Blob(['test'], { type: 'application/x-executable' }), 'bad.exe');
  status(await request('POST', '/api/posts', user.token, badUpload), 400);
  status(await request('GET', '/missing-route'), 404);
});

test('Cloudinary deletion strips versions and preserves raw extensions without contacting cloud', async () => {
  const { cloudinary, deleteFromCloudinary } = require('../src/config/cloudinary');
  const original = cloudinary.uploader.destroy;
  const calls = [];
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'; process.env.CLOUDINARY_API_KEY = 'test'; process.env.CLOUDINARY_API_SECRET = 'test';
  cloudinary.uploader.destroy = async (id, options) => { calls.push([id, options.resource_type]); return { result: 'ok' }; };
  try {
    assert.equal(await deleteFromCloudinary('https://res.cloudinary.com/test-cloud/image/upload/c_limit,w_1920/v123/folder/photo.name.jpg'), true);
    assert.equal(await deleteFromCloudinary('https://res.cloudinary.com/test-cloud/raw/upload/v123/folder/document.pdf'), true);
    assert.equal(await deleteFromCloudinary('https://res.cloudinary.com.evil.example/test-cloud/image/upload/v123/photo.jpg'), false);
    assert.deepEqual(calls, [['folder/photo.name', 'image'], ['folder/document.pdf', 'raw']]);
  } finally { cloudinary.uploader.destroy = original; for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) delete process.env[key]; }
});

test('watch sessions reject cheats, expire, bind ownership, and enforce sequence', async () => {
  const watcher = await account('watcher');
  const task = await Task.create({ type: 'watch_video', title: 'Watch controls', description: 'Test', coins: 5, videoDuration: 10, videoUrl: 'https://example.com/v.mp4' });
  const started = status(await request('POST', `/api/tasks/${task.id}/watch/start`, watcher.token, {}), 201);
  assert.equal(status(await request('POST', `/api/tasks/${task.id}/watch/start`, watcher.token, {}), 201).sessionId, started.sessionId);
  status(await request('POST', `/api/tasks/${task.id}/watch/heartbeat`, other.token, { sessionId: started.sessionId, playbackPosition: 5, clientTimestamp: Date.now(), sequence: 1 }), 404);
  status(await request('POST', `/api/tasks/${task.id}/complete`, watcher.token, { sessionId: started.sessionId, watchDuration: 99999 }), 400);
  const second = await Task.create({ type: 'watch_video', title: 'Another', description: 'Test', coins: 5, videoDuration: 10, videoUrl: 'https://example.com/v2.mp4' });
  status(await request('POST', `/api/tasks/${second.id}/watch/start`, watcher.token, {}), 409);
  const service = require('../src/services/watchSessions').createService(() => Date.now() + 5000);
  await assert.rejects(service.heartbeat(task.id, watcher.id, { sessionId: started.sessionId, playbackPosition: 100, clientTimestamp: Date.now(), sequence: 1 }), /Implausible/);
  status(await request('POST', `/api/tasks/${task.id}/watch/heartbeat`, watcher.token, { sessionId: started.sessionId, playbackPosition: 1, clientTimestamp: Date.now(), sequence: 1 }), 429);
  const WatchSession = require('../src/models/WatchSession');
  await WatchSession.updateOne({ _id: started.sessionId }, { lastHeartbeatAt: new Date(Date.now() - 5000) });
  status(await request('POST', `/api/tasks/${task.id}/watch/heartbeat`, watcher.token, { sessionId: started.sessionId, playbackPosition: 5, clientTimestamp: Date.now(), sequence: 1 }), 200);
  status(await request('POST', `/api/tasks/${task.id}/watch/heartbeat`, watcher.token, { sessionId: started.sessionId, playbackPosition: 5, clientTimestamp: Date.now(), sequence: 1 }), 409);
  await WatchSession.updateOne({ _id: started.sessionId }, { expiresAt: new Date(Date.now() - 1) });
  status(await request('POST', `/api/tasks/${task.id}/complete`, watcher.token, { sessionId: started.sessionId }), 409);
});

test('reviewed reconciliation repairs once, rejects stale reports, and rolls back on failure', async () => {
  const account = await User.create({ name: 'Repair', username: 'repair', email: 'repair@example.com', password: 'TestPass123!', coins: 3000, totalEarned: 5000, totalWithdrawn: 2000 });
  const withdrawal = await Withdrawal.create({ user: account.id, amount: 1000, status: 'approved', paymentMethod: 'UPI', accountDetails: 'fixture@upi' });
  await Transaction.create([{ user: account.id, type: 'earned', amount: 5000, description: 'Fixture earnings' }, { user: account.id, type: 'withdrawn', amount: 1000, description: 'Fixture withdrawal', withdrawal: withdrawal.id }]);
  const service = require('../src/services/reconciliation');
  const evidence = { userId: account.id, openingBalance: 0, source: 'Isolated fixture complete history', completeHistoryConfirmed: true };
  const report = await service.inspect(account.id, evidence);
  await assert.rejects(service.apply(report, true), /RECONCILE_APPLY/);
  process.env.RECONCILE_APPLY = 'true';
  try {
    await assert.rejects(service.apply(report, false), /confirm/);
    const create = Transaction.create;
    try {
      Transaction.create = async () => { throw new Error('Injected ledger failure'); };
      await assert.rejects(service.apply(report, true), /Injected/);
      assert.equal((await User.findById(account.id)).coins, 3000);
    } finally { Transaction.create = create; }
    assert.equal((await service.apply(report, true)).status, 'APPLIED');
    assert.equal((await User.findById(account.id)).coins, 4000);
    assert.equal((await service.apply(report, true)).status, 'ALREADY_APPLIED');
    assert.equal(await Transaction.countDocuments({ user: account.id, type: 'reconciliation' }), 1);
    const Audit = require('../src/models/ReconciliationAudit');
    await assert.rejects(Audit.updateMany({}, { $set: { evidence: {} } }), /append-only/);
    const next = await service.inspect(account.id, evidence);
    await User.updateOne({ _id: account.id }, { $inc: { coins: 1 } });
    await assert.rejects(service.apply(next, true), /stale/);
  } finally { delete process.env.RECONCILE_APPLY; }
});

test('production health, security headers, real throttling and readiness', async () => {
  status(await request('GET', '/health'), 200);
  status(await request('GET', '/ready'), 200);
  const response = await fetch(base + '/health');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const app = require('../src/server'); app.locals.shuttingDown = true;
  status(await request('GET', '/ready'), 503); app.locals.shuttingDown = false;
  for (let n = 0; n < 30; n++) status(await request('POST', '/api/auth/login', null, {}), 400);
  status(await request('POST', '/api/auth/login', null, {}), 429);
  const bad = new FormData(); bad.set('image', new Blob(['not really png'], { type: 'image/png' }), 'spoof.png');
  status(await request('POST', '/api/posts', user.token, bad), 400);
});

test('direct media APIs enforce authorization, content, expiry and lifecycle', async t => {
  const storage = require('../src/services/storage/storage.service');
  const Media = require('../src/models/Media');
  const original = { provider: process.env.MEDIA_STORAGE_PROVIDER, private: process.env.R2_PRIVATE_BUCKET, public: process.env.R2_PUBLIC_BASE_URL };
  process.env.MEDIA_STORAGE_PROVIDER = 'r2'; process.env.R2_PRIVATE_BUCKET = 'true'; delete process.env.R2_PUBLIC_BASE_URL;
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==', 'base64');
  const body = { category: 'images', mimeType: 'image/png', size: bytes.length, checksum: require('node:crypto').createHash('sha256').update(bytes).digest('base64') };
  let deleted = 0;
  t.mock.method(storage, 'presignUpload', async () => ({ url: 'https://storage.invalid/test', method: 'PUT', expiresIn: 300 }));
  t.mock.method(storage, 'getMetadata', async () => ({ size: bytes.length, mimeType: 'image/png', etag: 'fixture' }));
  t.mock.method(storage, 'readPrefix', async () => bytes);
  t.mock.method(storage, 'getUrl', async () => 'https://storage.invalid/download');
  t.mock.method(storage, 'delete', async () => { deleted++; return true; });
  try {
    status(await request('POST', '/api/media/upload/init', null, body), 401);
    status(await request('POST', '/api/media/upload/init', user.token, { ...body, category: '../images' }), 400);
    status(await request('POST', '/api/media/upload/init', user.token, { ...body, mimeType: 'text/html' }), 400);
    status(await request('POST', '/api/media/upload/init', user.token, { ...body, size: 999999999 }), 400);
    status(await request('POST', '/api/media/upload/init', user.token, { ...body, checksum: 'invalid' }), 400);
    const init = status(await request('POST', '/api/media/upload/init', user.token, body), 201);
    const id = init.media.id;
    assert.ok(!(await Media.findById(id)).storageKey.includes(user.id));
    for (const [method, route] of [['GET', `/api/media/${id}`], ['GET', `/api/media/${id}/download`], ['GET', `/api/media/${id}/content`], ['DELETE', `/api/media/${id}`], ['POST', `/api/media/${id}/complete`]]) status(await request(method, route, other.token, method === 'POST' ? {} : undefined), 403);
    status(await request('PATCH', `/api/media/${id}`, other.token, { size: 1 }), 404);
    assert.equal(deleted, 0);
    status(await request('GET', `/api/media/${id}/download`, user.token), 409);
    status(await request('GET', `/api/media/${id}`, user.token), 200);
    status(await request('POST', `/api/media/${id}/complete`, user.token, {}), 200);
    status(await request('POST', `/api/media/${id}/complete`, user.token, {}), 200);
    status(await request('GET', `/api/media/${id}/download`, user.token), 200);
    const content = await fetch(base + `/api/media/${id}/content`, { headers: { Authorization: `Bearer ${user.token}` }, redirect: 'manual' });
    assert.equal(content.status, 302); assert.equal(content.headers.get('Location'), 'https://storage.invalid/download');
    outcomes.push({ method: 'GET', route: `/api/media/${id}/content`, status: content.status });
    status(await request('POST', '/api/posts', other.token, { mediaId: id }), 403);
    const attachedPost = status(await request('POST', '/api/posts', user.token, { mediaId: id }), 201);
    assert.equal(attachedPost.imageUrl, `/api/media/${id}/content`);
    const published = await fetch(base + `/api/media/${id}/content`, { headers: { Authorization: `Bearer ${other.token}` }, redirect: 'manual' });
    assert.equal(published.status, 302);
    status(await request('GET', `/api/media/${id}/download`, other.token), 403);
    const attachedProfile = status(await request('PUT', '/api/auth/profile', user.token, { mediaId: id }), 200);
    assert.equal(attachedProfile.user.avatar, `/api/media/${id}/content`);
    const attachedStory = status(await request('POST', '/api/stories', user.token, { mediaId: id, type: 'image' }), 201);
    assert.equal(attachedStory.mediaUrl, `/api/media/${id}/content`);
    status(await request('DELETE', `/api/posts/${attachedPost.id}`, user.token), 200);
    assert.equal(deleted, 0, 'Avatar/story references retain the shared object');
    status(await request('DELETE', `/api/media/${id}`, user.token), 202);
    status(await request('GET', `/api/media/${id}/download`, user.token), 409);
    await Media.updateOne({ _id: id }, { expiresAt: new Date(0) });
    status(await request('DELETE', `/api/media/${id}`, user.token), 200);
    status(await request('DELETE', `/api/media/${id}`, user.token), 200);
    assert.equal(deleted, 1);
    const expired = status(await request('POST', '/api/media/upload/init', user.token, body), 201).media.id;
    await Media.updateOne({ _id: expired }, { expiresAt: new Date(0) });
    status(await request('POST', `/api/media/${expired}/complete`, user.token, {}), 409);
    const invalid = status(await request('POST', '/api/media/upload/init', user.token, body), 201).media.id;
    storage.getMetadata.mock.mockImplementation(async () => ({ size: bytes.length + 1, mimeType: 'image/png' }));
    status(await request('POST', `/api/media/${invalid}/complete`, user.token, {}), 400);
    assert.equal((await Media.findById(invalid)).status, 'rejected');
    // Provider delete failure must leave an inaccessible, retryable state.
    const deleting = await Media.create({ user: user.id, provider: 'r2', storageKey: 'originals/test/delete-failure.png', category: 'images', mimeType: body.mimeType, size: body.size, checksum: body.checksum, status: 'ready', expiresAt: new Date(0) });
    storage.delete.mock.mockImplementation(async () => { throw new (require('../src/services/storage/storage.errors').StorageError)(); });
    status(await request('DELETE', `/api/media/${deleting.id}`, user.token), 502);
    assert.equal((await Media.findById(deleting.id)).status, 'deleting');
    status(await request('GET', `/api/media/${deleting.id}/download`, user.token), 409);
    storage.delete.mock.mockImplementation(async () => true);
    status(await request('DELETE', `/api/media/${deleting.id}`, user.token), 200);
    const spoof = status(await request('POST', '/api/media/upload/init', user.token, body), 201).media.id;
    storage.getMetadata.mock.mockImplementation(async () => ({ size: bytes.length, mimeType: 'image/png' }));
    storage.readPrefix.mock.mockImplementation(async () => Buffer.from('not an image'));
    status(await request('POST', `/api/media/${spoof}/complete`, user.token, {}), 400);
    storage.presignUpload.mock.mockImplementation(async () => { throw new (require('../src/services/storage/storage.errors').StorageError)(); });
    const failed = await request('POST', '/api/media/upload/init', user.token, body);
    assert.equal(failed.status, 502); assert.equal(failed.body.error, 'Server error');
    await User.updateOne({ _id: user.id }, { isActive: false });
    status(await request('POST', '/api/media/upload/init', user.token, body), 403);
    await User.updateOne({ _id: user.id }, { isActive: true });
  } finally {
    for (const [key, value] of [['MEDIA_STORAGE_PROVIDER', original.provider], ['R2_PRIVATE_BUCKET', original.private], ['R2_PUBLIC_BASE_URL', original.public]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});

test('R2 cleanup retries failed objects and retires expired unreferenced story media', async t => {
  const Media = require('../src/models/Media');
  const storage = require('../src/services/storage/storage.service');
  const cleanup = require('../scripts/cleanup-media');
  const sample = { user: user.id, provider: 'r2', category: 'images', mimeType: 'image/png', size: 1, checksum: 'a'.repeat(43) + '=', expiresAt: new Date(0) };
  const [bad, good, story] = await Media.create([
    { ...sample, storageKey: 'test/retry-bad', status: 'pending' },
    { ...sample, storageKey: 'test/retry-good', status: 'pending' },
    { ...sample, storageKey: 'test/expired-story', status: 'ready', retireAfter: new Date(0) },
  ]);
  let fail = true;
  t.mock.method(storage, 'delete', async asset => { if (fail && asset.storageKey === bad.storageKey) throw Error('Injected provider failure'); return true; });
  await assert.rejects(cleanup(), /cleanup incomplete/);
  assert.equal((await Media.findById(bad.id)).status, 'deleting');
  assert.equal((await Media.findById(good.id)).status, 'deleted');
  assert.equal((await Media.findById(story.id)).status, 'deleted');
  fail = false; await cleanup();
  assert.equal((await Media.findById(bad.id)).status, 'deleted');
});

test('every declared API endpoint has a successful response test', () => {
  const mounts = { authRoutes: '/api/auth', taskRoutes: '/api/tasks', walletRoutes: '/api/wallet', postRoutes: '/api/posts', referralRoutes: '/api/referrals', adminRoutes: '/api/admin', adminTaskRoutes: '/api/admin/tasks', creatorRoutes: '/api/creator', storyRoutes: '/api/stories', followRoutes: '/api/follow', mediaRoutes: '/api/media' };
  let count = 0;
  for (const [file, prefix] of Object.entries(mounts)) {
    for (const layer of require('../src/routes/' + file).stack.filter(l => l.route)) {
      const template = prefix + (layer.route.path === '/' ? '' : layer.route.path);
      const pattern = new RegExp('^' + template.replace(/:[A-Za-z]+/g, '[^/]+') + '$');
      for (const method of Object.keys(layer.route.methods)) {
        assert.ok(outcomes.some(o => o.method === method.toUpperCase() && pattern.test(o.route) && o.status < 400), `Missing successful test: ${method.toUpperCase()} ${template}`);
        count++;
      }
    }
  }
  console.log(`Successful HTTP coverage: ${count} declared route/method endpoints, plus health`);
});
