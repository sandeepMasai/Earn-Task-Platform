const { randomUUID, createHash } = require('node:crypto');
function configured() {
  return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].every(key => Boolean(process.env[key]));
}
function verifyTestBucket() {
  if (!/(?:^|[-_])(staging|test)(?:$|[-_])/.test(process.env.R2_BUCKET || '') || process.env.R2_TEST_BUCKET_CONFIRM !== process.env.R2_BUCKET || process.env.R2_PRIVATE_BUCKET !== 'true' || process.env.R2_PUBLIC_BASE_URL) throw new Error('BLOCKED: explicitly confirm a private staging/test bucket');
}
async function disposable(provider, { expired = false } = {}) {
  const bytes = Buffer.from('Disposable R2 integration fixture\n');
  const asset = { provider: 'r2', storageKey: `test/${randomUUID()}/fixture.txt` };
  const assert = require('node:assert/strict');
  const started = performance.now();
  let primary, result;
  try {
    const initStart = performance.now();
    const signed = await provider.presignUpload({ ...asset, mimeType: 'text/plain', size: bytes.length, checksum: createHash('sha256').update(bytes).digest('base64'), expiresIn: expired ? 1 : 60 });
    const initMs = performance.now() - initStart;
    if (expired) {
      await new Promise(resolve => setTimeout(resolve, 2100));
      const response = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: bytes, signal: AbortSignal.timeout(20000) });
      assert.equal(response.status, 403); return;
    }
    const uploadStart = performance.now();
    let response = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: bytes, signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, 'Disposable upload failed');
    const uploadMs = performance.now() - uploadStart;
    assert.equal(await provider.exists(asset), true);
    const metadata = await provider.getMetadata(asset);
    assert.equal(metadata.size, bytes.length); assert.equal(metadata.mimeType, 'text/plain');
    response = await fetch(await provider.getUrl(asset), { signal: AbortSignal.timeout(20000) });
    assert.ok(response.ok, 'Disposable download failed');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    const replay = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: bytes, signal: AbortSignal.timeout(20000) });
    assert.equal(replay.status, 412, 'Upload cannot overwrite its existing key');
    await provider.delete(asset); assert.equal(await provider.exists(asset), false);
    result = { initMs, uploadMs, totalMs: performance.now() - started };
  } catch { primary = new Error('R2 disposable operation failed; provider payload and signed URL suppressed'); }
  finally { try { await provider.delete(asset); } catch { throw new Error('R2 disposable cleanup failed; inspect test/ objects in the dedicated bucket'); } }
  if (primary) throw primary;
  return result;
}
module.exports = { configured, verifyTestBucket, disposable };
