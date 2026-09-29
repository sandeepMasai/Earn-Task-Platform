const { test } = require('node:test');
const assert = require('node:assert/strict');
const R2Provider = require('../src/services/storage/r2.provider');
const { providerFor, validKey } = require('../src/services/storage/config');
const { createHash } = require('node:crypto');
// Nonfunctional synthetic signing fixture; no network calls or real credentials.
const env = { R2_ACCOUNT_ID: '0'.repeat(32), R2_ACCESS_KEY_ID: 'unit-test-only', R2_SECRET_ACCESS_KEY: 'unit-test-only', R2_BUCKET: 'unit-test-bucket', R2_PRIVATE_BUCKET: 'true' };
const checksum = createHash('sha256').update('fixture').digest('base64');
test('Cloudinary remains default; category overrides and invalid provider handling', () => {
  assert.equal(providerFor('videos', {}), 'cloudinary');
  assert.equal(providerFor('videos', { MEDIA_STORAGE_PROVIDER_VIDEOS: 'r2' }), 'r2');
  assert.equal(providerFor('images', { MEDIA_STORAGE_PROVIDER_VIDEOS: 'r2' }), 'cloudinary');
  assert.throws(() => providerFor('videos', { MEDIA_STORAGE_PROVIDER: 'unknown' }));
});
test('R2 rejects missing configuration and unsafe keys', () => {
  assert.throws(() => new R2Provider({ env: {} }), e => e.code === 'R2_NOT_CONFIGURED');
  for (const key of ['../a', '/a', 'a//b', 'a/../b', 'https://x', 'a/%2e%2e/b', 'a\\b', '']) assert.throws(() => validKey(key));
  assert.throws(() => new R2Provider({ env: { ...env, R2_PUBLIC_BASE_URL: 'http://insecure.invalid' } }));
});
test('R2 signatures bind size, MIME, checksum, overwrite protection and expiry', async () => {
  const provider = new R2Provider({ env });
  const result = await provider.presignUpload({ storageKey: 'test/random/file.png', mimeType: 'image/png', size: 7, checksum, expiresIn: 60 });
  const url = new URL(result.url);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  const headers = url.searchParams.get('X-Amz-SignedHeaders').split(';');
  for (const name of ['content-type', 'content-length', 'if-none-match', 'x-amz-checksum-sha256']) assert.ok(headers.includes(name), name);
  assert.equal(result.headers['If-None-Match'], '*');
  await assert.rejects(provider.presignUpload({ storageKey: 'test/a', mimeType: 'image/png', size: 9999999999, checksum }));
  await assert.rejects(provider.presignUpload({ storageKey: 'test/a', mimeType: 'image/png', size: 7, checksum, expiresIn: 0 }));
  await assert.rejects(provider.getUrl({ storageKey: 'test/a' }, { expiresIn: 901 }));
  const download = new URL(await provider.getUrl({ storageKey: 'test/a' }, { expiresIn: 1 }));
  assert.equal(download.searchParams.get('X-Amz-Expires'), '1');
  provider.client.destroy();
});
test('provider failures are sanitized; missing objects differ from auth/bucket failures', async () => {
  for (const code of [403, 404, 500]) {
    const provider = new R2Provider({ env, client: { send: async () => { throw Object.assign(new Error('sensitive provider payload'), { $metadata: { httpStatusCode: code } }); } } });
    for (const method of ['delete', 'getMetadata', 'readPrefix']) await assert.rejects(provider[method]({ storageKey: 'test/a' }), e => !e.message.includes('sensitive') && e.status === (code === 404 ? 404 : 502));
    if (code === 404) assert.equal(await provider.exists({ storageKey: 'test/a' }), false);
    else await assert.rejects(provider.exists({ storageKey: 'test/a' }));
  }
});
test('R2 prefix read is bounded and metadata contains no provider credentials', async () => {
  const { Readable } = require('node:stream');
  const provider = new R2Provider({ env, client: { send: async command => command.constructor.name === 'GetObjectCommand' ? { Body: Readable.from([Buffer.alloc(20000)]) } : { ContentLength: 12, ContentType: 'image/png', ETag: 'tag', privateSecret: 'not-returned' } } });
  assert.equal((await provider.readPrefix({ storageKey: 'test/a' })).length, 8192);
  assert.deepEqual(await provider.getMetadata({ storageKey: 'test/a' }), { size: 12, mimeType: 'image/png', etag: 'tag', version: undefined });
});
test('legacy Cloudinary embedded records remain valid without fabricated R2 identity', async () => {
  const mongoose = require('mongoose');
  const Model = mongoose.model('StorageCompatibilityFixture', new mongoose.Schema({ asset: require('../src/models/mediaAsset') }));
  const old = new Model({ asset: { publicId: 'existing/image', assetId: 'existing-id', resourceType: 'image' } });
  await old.validate(); assert.equal(old.asset.provider, undefined); assert.equal(old.asset.storageKey, undefined);
  await new Model({ asset: { provider: 'r2', storageKey: 'originals/test/a', resourceType: 'image' } }).validate();
});
test('R2 upload failures and missing buckets return safe distinct errors', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const os = require('node:os');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'earn-storage-fixture-'));
  const file = path.join(dir, 'file.txt'); await fs.writeFile(file, 'fixture');
  try {
    const provider = new R2Provider({ env, client: { send: async () => { throw Object.assign(new Error('private provider details'), { name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } }); } } });
    await assert.rejects(provider.upload({ filePath: file, storageKey: 'test/file.txt', mimeType: 'text/plain', size: 7, resourceType: 'raw' }), e => e.code === 'R2_BUCKET_UNAVAILABLE' && e.status === 503 && !e.message.includes('private'));
    await assert.rejects(provider.exists({ storageKey: 'test/file.txt' }), e => e.code === 'R2_BUCKET_UNAVAILABLE');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('selecting an unconfigured R2 provider fails configuration validation', () => {
  assert.throws(() => require('../src/config/production').validateProduction({ NODE_ENV: 'test', MEDIA_STORAGE_PROVIDER_VIDEOS: 'r2' }), e => e.code === 'R2_NOT_CONFIGURED');
});

test('truncated media signatures produce safe client errors', async () => {
  const { validateBytes } = require('../src/services/storage/mediaPolicy');
  await assert.rejects(validateBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png'), error => error.status === 400);
});

test('media policy rejects null, unsafe filenames and client-selected object keys', () => {
  const policy = require('../src/services/storage/mediaPolicy');
  const input = { category: 'images', mimeType: 'image/png', size: 7, checksum };
  for (const value of [null, [], { ...input, storageKey: 'other/users/object.png' }, { ...input, filename: '../../evil.png' }, { ...input, filename: 'bad\u0000.png' }]) {
    assert.throws(() => policy.validate(value), e => e.status === 400);
  }
  assert.equal(policy.validate({ ...input, filename: 'photo.png' }), 'png');
  assert.throws(() => policy.validate({ ...input, size: policy.limits.images + 1 }), e => e.status === 400);
});

test('R2 fails startup for public URLs or unconfirmed private mode', () => {
  const validate = require('../src/config/production').validateProduction;
  for (const url of ['https://example.com/media', 'https://' + env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com']) {
    assert.throws(() => validate({ ...env, MEDIA_STORAGE_PROVIDER: 'r2', R2_PUBLIC_BASE_URL: url }), e => e.code === 'R2_PUBLIC_URL_UNSUPPORTED');
  }
  assert.throws(() => validate({ ...env, MEDIA_STORAGE_PROVIDER: 'r2', R2_PRIVATE_BUCKET: 'false' }), e => e.code === 'R2_PRIVATE_BUCKET_REQUIRED');
  assert.doesNotThrow(() => validate({ ...env, MEDIA_STORAGE_PROVIDER: 'r2' }));
});
