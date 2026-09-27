const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const enabled = process.env.CLOUDINARY_INTEGRATION_TEST === 'true';
if (enabled) require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const configured = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => Boolean(process.env[key]));

test('live Cloudinary disposable image and raw asset upload/retrieval/deletion', { skip: !enabled ? 'Set CLOUDINARY_INTEGRATION_TEST=true to opt in' : !configured ? 'Cloudinary credentials missing' : false, timeout: 180000 }, async () => {
  const { cloudinary, uploadAsset, deleteAsset } = require('../../src/config/cloudinary');
  const retry = require('../../src/utils/retry');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'earn-cloud-test-'));
  const folder = `backend-integration-tests/integration/${randomUUID()}`;
  const ownedAssets = [];
  let failure;
  let phase = 'prepare';
  try {
    for (const type of ['image', 'raw']) {
      const publicId = `${folder}/nested/${type === 'image' ? 'pixel' : 'document.txt'}`;
      const asset = { publicId, resourceType: type };
      ownedAssets.push(asset); // Cleanup even if an upload response is lost.
      const file = path.join(directory, type === 'image' ? 'pixel.png' : 'document.txt');
      await fs.writeFile(file, type === 'image' ? Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=', 'base64') : 'Disposable backend integration test\n');
      phase = `${type}:upload`;
      const result = await uploadAsset(file, { public_id: publicId, resource_type: type });
      assert.ok(result.public_id === publicId, 'Public ID must match this test run');
      assert.ok(result.resource_type === type, 'Resource type must match');
      assert.ok(typeof result.asset_id === 'string' && result.asset_id.length > 0, 'Stable asset ID required');
      const url = new URL(result.secure_url);
      assert.ok(url.protocol === 'https:' && url.hostname === 'res.cloudinary.com', 'Expected secure Cloudinary delivery URL');
      phase = `${type}:retrieve`;
      const response = await retry(async () => {
        const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw Object.assign(new Error('Asset retrieval failed'), { status: r.status });
        return r;
      });
      assert.ok((await response.arrayBuffer()).byteLength > 0, 'Asset body required');
      phase = `${type}:delete`;
      assert.ok(await deleteAsset(asset), 'Deletion must succeed');
      let missing = false;
      try { await retry(() => cloudinary.api.resource(publicId, { resource_type: type, timeout: 30000 })); }
      catch (error) { if (error.http_code === 404 || error.error?.http_code === 404) missing = true; else throw error; }
      assert.ok(missing, 'Provider must confirm asset no longer exists (CDN may retain cached data)');
    }
  } catch (error) {
    failure = new Error(`Cloudinary live test failed at ${phase} (status ${error.providerStatus || error.http_code || error.error?.http_code || error.status || 'unknown'}, code ${error.providerCode || 'unavailable'}); provider payload suppressed`);
  } finally {
    for (const asset of ownedAssets) {
      try { if (!(await deleteAsset(asset))) throw new Error('Cleanup unsuccessful'); }
      catch { failure = new Error('Cloudinary cleanup could not be confirmed; inspect dedicated backend-integration-tests folder'); }
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
  if (failure) throw failure;
});
