const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateProduction } = require('../src/config/production');
const retry = require('../src/utils/retry');
const valid = { NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:27017/test', JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40), CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'fixture', CORS_ORIGINS: 'https://app.example.com', PORT: '3000' };
test('production rejects missing, weak, shared secrets and unsafe CORS', () => {
  assert.doesNotThrow(() => validateProduction(valid));
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_CLOUD_NAME']) assert.throws(() => validateProduction({ ...valid, [key]: '' }));
  assert.throws(() => validateProduction({ ...valid, JWT_SECRET: 'short' }));
  assert.throws(() => validateProduction({ ...valid, JWT_REFRESH_SECRET: valid.JWT_SECRET }));
  assert.throws(() => validateProduction({ ...valid, CORS_ORIGINS: '*' }));
  assert.throws(() => validateProduction({ ...valid, RATE_LIMIT_DISABLED: 'true' }));
});
test('rate limited provider calls back off with a strict retry bound', async () => {
  let calls = 0; const delays = [];
  await assert.rejects(retry(async () => { calls++; throw { http_code: 429 }; }, { sleep: async ms => delays.push(ms) }));
  assert.equal(calls, 3); assert.deepEqual(delays, [500, 1000]);
  calls = 0;
  await assert.rejects(retry(async () => { calls++; throw { http_code: 401 }; }, { sleep: async () => {} }));
  assert.equal(calls, 1);
});
test('graceful shutdown closes HTTP before MongoDB and runs only once', async () => {
  const { EventEmitter } = require('node:events');
  const mongoose = require('mongoose');
  const { installShutdown } = require('../src/utils/lifecycle');
  const original = mongoose.disconnect;
  const events = [];
  const server = new EventEmitter();
  server.on('shutdown', () => events.push('not_ready'));
  server.close = callback => { events.push('http_closed'); callback(); };
  mongoose.disconnect = async () => { events.push('database_closed'); };
  const shutdown = installShutdown(server, { exit: code => events.push(`exit_${code}`) });
  try {
    await shutdown(); await shutdown();
    assert.deepEqual(events, ['not_ready', 'http_closed', 'database_closed', 'exit_0']);
  } finally {
    mongoose.disconnect = original;
    process.removeListener('SIGTERM', shutdown);
    process.removeListener('SIGINT', shutdown);
  }
});
test('video upload fields reject images despite a valid image signature', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'earn-mime-'));
  const file = path.join(dir, 'tiny.png');
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==', 'base64');
  await fs.writeFile(file, bytes);
  try {
    await assert.rejects(require('../src/middleware/upload').validateContent({path: file, size: bytes.length, mimetype: 'image/png'}, 'video'), error => error.status === 400);
  } finally { await fs.rm(dir, {recursive: true, force: true}); }
});
