#!/usr/bin/env node
// This runner intentionally has no remote target option. All mutations go to a
// fresh loopback-only MongoDB replica set and app, with cloud credentials removed.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-load-access-secret';
process.env.JWT_REFRESH_SECRET = 'isolated-load-refresh-secret';
for (const key of ['MONGODB_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'RENDER']) delete process.env[key];
const levels = (process.env.LOAD_CONCURRENCY || '50').split(',').map(Number);
if (levels.some(n => !Number.isSafeInteger(n) || n < 1 || n > 250) || (levels.some(n => n > 50) && process.env.LOAD_ALLOW_HIGH !== 'true')) {
  console.error('Use 1–50 by default; 100/250 require LOAD_ALLOW_HIGH=true (isolated environment only)'); process.exit(1);
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'earn-load-'));
process.env.UPLOAD_DIR = path.join(directory, 'uploads');
const mongoose = require('mongoose');
const { startMongo, stopMongo } = require('../test/support/mongo');
let mongo, server, base;
const report = { generatedAt: new Date().toISOString(), target: 'disposable loopback app/database', criteria: { unexpectedErrorRate: 0, timeoutRate: 0, p95Ms: 15000, p99Ms: 45000, financialInvariantFailures: 0 }, scenarios: [], invariants: [], driverErrors: {}, limitations: ['Short controlled bursts; not a soak test or production capacity guarantee', 'Login rate limiting stays enabled; expected HTTP 429 is recorded separately', 'Watch prerequisites are prepared with a test-controlled server clock; load requests cannot submit duration to earn rewards'] };
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=', 'base64');
function form(field) { const body = new FormData(); body.set(field, new Blob([image], { type: 'image/png' }), 'pixel.png'); return body; }
async function req(method, route, token, body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000) });
  await response.arrayBuffer(); return response.status;
}
async function burst(name, count, operation, expected) {
  await require('../src/models/RateLimitBucket').deleteMany({});
  const cpu = process.cpuUsage(); const memory = process.memoryUsage(); const start = performance.now();
  const timings = []; const statuses = {}; let timeouts = 0, unexpected = 0;
  await Promise.all(Array.from({ length: count }, async (_, i) => {
    const t = performance.now();
    try { const status = await operation(i); statuses[status] = (statuses[status] || 0) + 1; if (!expected.includes(status)) unexpected++; }
    catch (error) { if (error.name === 'TimeoutError' || error.name === 'AbortError') timeouts++; unexpected++; }
    timings.push(performance.now() - t);
  }));
  timings.sort((a, b) => a - b); const elapsed = performance.now() - start; const used = process.cpuUsage(cpu);
  const percentile = p => Math.round(timings[Math.min(timings.length - 1, Math.ceil(p * timings.length) - 1)] * 100) / 100;
  const entry = { name, concurrency: count, requests: count, requestsPerSecond: Number((count / (elapsed / 1000)).toFixed(2)), p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), unexpectedErrorRate: unexpected / count, timeoutRate: timeouts / count, statuses, cpuMs: (used.user + used.system) / 1000, rssBytes: process.memoryUsage().rss, heapDeltaBytes: process.memoryUsage().heapUsed - memory.heapUsed };
  entry.status = unexpected === 0 && timeouts === 0 && entry.p95Ms <= report.criteria.p95Ms && entry.p99Ms <= report.criteria.p99Ms ? 'PASS' : 'FAIL';
  report.scenarios.push(entry); console.log(`${entry.status} ${name} concurrency=${count} p95=${entry.p95Ms}ms statuses=${JSON.stringify(statuses)}`);
}
function invariant(name, check) { try { check(); report.invariants.push({ name, status: 'PASS' }); } catch (error) { report.invariants.push({ name, status: 'FAIL', reason: error.message }); } }
async function main() {
  const instance = await startMongo(directory); mongo = instance.child;
  await mongoose.connect(instance.uri, { monitorCommands: true });
  mongoose.connection.getClient().on('commandFailed', event => { const code = String(event.failure?.code || 'unknown'); report.driverErrors[code] = (report.driverErrors[code] || 0) + 1; });
  const app = require('../src/server');
  for (const model of Object.values(mongoose.models)) await model.init();
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
  const User = require('../src/models/User'), Task = require('../src/models/Task'), Post = require('../src/models/Post'), Tx = require('../src/models/Transaction'), Withdrawal = require('../src/models/Withdrawal'), Submission = require('../src/models/TaskSubmission'), Request = require('../src/models/CreatorCoinRequest');
  const sign = require('../src/utils/generateToken');
  const before = await mongoose.connection.db.admin().command({ serverStatus: 1 });
  for (const concurrency of levels) {
    const user = await User.create({ name: 'Load', username: `load${concurrency}`, email: `load${concurrency}@example.com`, password: 'LoadTest123!', coins: 1000 });
    const admin = await User.create({ name: 'Admin', username: `admin${concurrency}`, email: `admin${concurrency}@example.com`, password: 'LoadTest123!', role: 'admin' });
    const creator = await User.create({ name: 'Creator', username: `creator${concurrency}`, email: `creator${concurrency}@example.com`, password: 'LoadTest123!', role: 'creator', isCreator: true, creatorStatus: 'approved' });
    const token = sign(user.id), adminToken = sign(admin.id);
    await burst('health', concurrency, () => req('GET', '/health'), [200]);
    await burst('login (30/minute protection)', concurrency, () => req('POST', '/api/auth/login', null, { email: user.email, password: 'LoadTest123!' }), [200, 429]);
    await burst('protected profile', concurrency, () => req('GET', '/api/auth/me', token), [200]);
    await burst('task listing', concurrency, () => req('GET', '/api/tasks', token), [200]);
    await burst('wallet reads', concurrency, () => req('GET', '/api/wallet/balance', token), [200]);
    await burst('concurrent withdrawals', concurrency, () => req('POST', '/api/wallet/withdraw', token, { amount: 1000, paymentMethod: 'UPI', accountDetails: 'disposable@upi' }), [201, 400]);
    const balance = await User.findById(user.id); const withdrawals = await Withdrawal.countDocuments({ user: user.id }); const debits = await Tx.countDocuments({ user: user.id, type: 'withdrawn' });
    invariant(`withdrawal consistency at ${concurrency}`, () => { assert.equal(balance.coins, 0); assert.equal(balance.totalWithdrawn, 1000); assert.equal(withdrawals, 1); assert.equal(debits, 1); });
    const task = await Task.create({ type: 'watch_video', title: 'Load task', description: 'Fixture', coins: 10, videoUrl: 'https://example.com/video.mp4', videoDuration: 10 });
    let now = Date.now(); const watch = require('../src/services/watchSessions').createService(() => now); const session = await watch.start(task.id, user.id);
    for (let seq = 1; seq <= 2; seq++) { now += 5000; await watch.heartbeat(task.id, user.id, { sessionId: session.sessionId, sequence: seq, playbackPosition: seq * 5, clientTimestamp: now }); }
    await burst('concurrent task completion', concurrency, () => req('POST', `/api/tasks/${task.id}/complete`, token, { sessionId: session.sessionId }), [200, 400]);
    const rewarded = await User.findById(user.id); const taskTx = await Tx.countDocuments({ user: user.id, task: task.id });
    invariant(`task ledger at ${concurrency}`, () => { assert.equal(rewarded.coins, 10); assert.equal(taskTx, 1); });
    const social = await Task.create({ type: 'instagram_follow', title: 'Proof load', description: 'Fixture', coins: 20, instagramUrl: 'https://instagram.com/example' });
    await burst('proof submission', concurrency, () => req('POST', `/api/tasks/${social.id}/submit-proof`, token, form('proofImage')), [200, 400, 409]);
    const proofs = await Submission.find({ user: user.id, task: social.id });
    invariant(`unique proof at ${concurrency}`, () => assert.equal(proofs.length, 1));
    if (proofs[0]) await burst('concurrent proof approval', concurrency, () => req('PUT', `/api/admin/task-submissions/${proofs[0].id}/approve`, adminToken, {}), [200, 400]);
    const proofTx = await Tx.countDocuments({ user: user.id, task: social.id });
    invariant(`single proof reward at ${concurrency}`, () => assert.equal(proofTx, 1));
    const funding = await Request.create({ creator: creator.id, coins: 1000, amount: 10, paymentProof: '/uploads/disposable-fixture.png' });
    await burst('concurrent creator funding approval', concurrency, () => req('PUT', `/api/admin/creator-coin-requests/${funding.id}/approve`, adminToken, {}), [200, 400]);
    const funded = await User.findById(creator.id);
    invariant(`creator wallet at ${concurrency}`, () => assert.equal(funded.creatorWallet, 1000));
    await burst('concurrent follows', concurrency, () => req('POST', `/api/follow/${creator.id}`, token, {}), [200, 400]);
    const followed = await User.findById(creator.id);
    invariant(`single follow at ${concurrency}`, () => assert.equal(followed.followers.filter(id => id.equals(user.id)).length, 1));
    const post = await Post.create({ user: creator.id, type: 'image', imageUrl: '/uploads/disposable-fixture.png' });
    await require('../src/models/CoinConfig').findOneAndUpdate({ key: 'POST_LIKE' }, { value: 5, label: 'Post like' }, { upsert: true }); require('../src/utils/coinHelper').clearCoinCache();
    const beforeLikes = (await User.findById(user.id)).coins;
    await burst('concurrent like reward', concurrency, () => req('POST', `/api/posts/${post.id}/like`, token, {}), [200, 400]);
    const afterLikes = (await User.findById(user.id)).coins;
    invariant(`single like reward at ${concurrency}`, () => assert.equal(afterLikes - beforeLikes, 5));
    const beforeUpload = (await User.findById(user.id)).coins;
    await burst('local uploads with rewards', concurrency, () => req('POST', '/api/posts', token, form('image')), [201]);
    const afterUpload = (await User.findById(user.id)).coins; const postCount = await Post.countDocuments({ user: user.id });
    invariant(`upload reward ledger at ${concurrency}`, () => { assert.equal(postCount, concurrency); assert.equal(afterUpload - beforeUpload, concurrency * 30); });
    global.gc?.(); report.heapAfterGCBytes = process.memoryUsage().heapUsed;
  }
  const after = await mongoose.connection.db.admin().command({ serverStatus: 1 });
  report.mongo = { transactionAborts: Number(after.transactions?.totalAborted || 0) - Number(before.transactions?.totalAborted || 0), writeConflicts: Number(after.metrics?.operation?.writeConflicts || 0) - Number(before.metrics?.operation?.writeConflicts || 0) };
}
main().catch(error => { report.fatal = { name: error.name, code: error.code || null }; report.status = 'FAIL'; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await stopMongo(mongo); fs.rmSync(directory, { recursive: true, force: true });
  report.status = report.fatal || report.scenarios.some(s => s.status !== 'PASS') || report.invariants.some(i => i.status !== 'PASS') ? 'FAIL' : 'PASS';
  const output = process.env.LOAD_REPORT || path.join(__dirname, '../reports/load-test.json');
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(`Load result: ${report.status}; report written`); process.exitCode = report.status === 'PASS' ? 0 : 1;
});
