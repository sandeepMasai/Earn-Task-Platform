const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getCloudinaryFolderPrefix, createPublicId } = require('../src/config/cloudinaryPrefix');

test('staging and production prefixes and development compatibility', () => {
  for (const name of ['staging', 'production']) {
    assert.equal(getCloudinaryFolderPrefix({ NODE_ENV: name, CLOUDINARY_FOLDER_PREFIX: `earn-task-platform/${name}` }), `earn-task-platform/${name}`);
  }
  assert.equal(getCloudinaryFolderPrefix({}), 'earn-task-platform');
  assert.equal(getCloudinaryFolderPrefix({ CLOUDINARY_FOLDER_PREFIX: ' /earn-task-platform//staging/// ' }), 'earn-task-platform/staging');
});
test('missing staging prefix fails startup configuration', () => {
  assert.throws(() => require('../src/config/production').validateProduction({ NODE_ENV: 'staging' }), /CLOUDINARY_FOLDER_PREFIX/);
});
test('invalid and traversal prefixes are rejected without exposing their values', () => {
  for (const value of ['', ' ', '/', 4, null, 'https://example.com/assets', 'x://y', '../x', 'a/../b', 'a/./b', 'a\\..\\b', 'a/%2e%2e/b', 'a\nb']) {
    assert.throws(() => getCloudinaryFolderPrefix({ CLOUDINARY_FOLDER_PREFIX: value }), /Invalid CLOUDINARY_FOLDER_PREFIX/);
  }
});
test('generated public IDs are unique and resource-separated with raw extensions', () => {
  const env = { NODE_ENV: 'staging', CLOUDINARY_FOLDER_PREFIX: 'earn-task-platform/staging' };
  const ids = ['image', 'video', 'raw'].map(type => createPublicId(type, 'txt', env));
  ids.forEach((id, index) => assert.match(id, new RegExp(`^earn-task-platform/staging/${['image', 'video', 'raw'][index]}/[a-f0-9-]{36}${index === 2 ? '\\.txt' : ''}$`)));
  assert.notEqual(createPublicId('image', 'png', env), ids[0]);
});

test('multipart image/video/raw uploads persist generated IDs and delete by stored identity', async t => {
  const express = require('express');
  const { once } = require('node:events');
  const keys = ['NODE_ENV', 'CLOUDINARY_FOLDER_PREFIX', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { NODE_ENV: 'staging', CLOUDINARY_FOLDER_PREFIX: ' /earn-task-platform//staging/ ', CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'fixture' });
  const { cloudinary, deleteAsset } = require('../src/config/cloudinary');
  const uploads = [], deletes = [];
  t.mock.method(cloudinary.uploader, 'upload', async (file, options) => {
    uploads.push(options);
    return { public_id: options.public_id, resource_type: options.resource_type, asset_id: 'fixture-id', secure_url: 'https://res.cloudinary.com/fixture/test' };
  });
  t.mock.method(cloudinary.uploader, 'destroy', async (id, options) => { deletes.push({ id, ...options }); return { result: 'ok' }; });
  const app = express();
  app.post('/upload', require('../src/middleware/upload').upload.single('file'), (req, res) => res.json(req.file.asset));
  app.use((err, req, res, next) => res.status(400).json({ error: 'invalid upload' }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const fixtures = [
      ['image', 'image/png', 'png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==', 'base64')],
      ['video', 'video/mp4', 'mp4', Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex')],
      ['raw', 'text/plain', 'txt', Buffer.from('Disposable unit test')],
    ];
    for (const [type, mime, ext, bytes] of fixtures) {
      const form = new FormData(); form.append('file', new Blob([bytes], { type: mime }), `fixture.${ext}`);
      const response = await fetch(`http://127.0.0.1:${server.address().port}/upload`, { method: 'POST', body: form });
      assert.equal(response.status, 200, type);
      const asset = await response.json();
      assert.equal(asset.resourceType, type);
      assert.match(asset.publicId, new RegExp(`^earn-task-platform/staging/${type}/[a-f0-9-]{36}${type === 'raw' ? '\\.txt' : ''}$`));
      assert.equal(uploads.at(-1).public_id, asset.publicId);
      assert.equal(uploads.at(-1).overwrite, false);
      assert.equal(await deleteAsset(asset), true);
      assert.equal(deletes.at(-1).id, asset.publicId);
      assert.equal(deletes.at(-1).resource_type, type);
    }
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
