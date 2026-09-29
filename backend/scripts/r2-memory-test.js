// Opt-in real staging transfers. Never connects to any application database or Cloudinary.
require('dotenv').config();
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { fork } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const Provider = require('../src/services/storage/r2.provider');
const { once } = require('node:events');
async function digest(file) { const h = createHash('sha256'); for await (const c of fs.createReadStream(file)) h.update(c); return h.digest('base64'); }
(async () => {
  if (process.env.R2_MEMORY_TEST !== 'true' || !/(?:^|[-_])(staging|test)(?:$|[-_])/.test(process.env.R2_BUCKET || '')) throw Error('Explicit staging opt-in required');
  const provider = new Provider(), prefix = `test/memory-${randomUUID()}/`, tracked = new Set();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'earn-r2-memory-'));
  const worker = fork(path.join(__dirname, '../test/support/r2-memory-worker.js'), [], { execArgv: ['--expose-gc'], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let next = 0; const pending = new Map(); worker.on('message', m => { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(Error(m.error)) : p.resolve(m.result); } });
  worker.on('exit', () => { for (const p of pending.values()) p.reject(Error('Backend worker exited')); pending.clear(); });
  const rpc = (action, input) => new Promise((resolve, reject) => { const id = ++next; pending.set(id, { resolve, reject }); worker.send({ id, action, input }); });
  const report = { startedAt: new Date().toISOString(), prefix, scope: 'Real streamed client PUT/GET; separate Node backend process signs and inspects at most 8192 bytes; application routes are covered separately', samples: [] };
  const remove = async key => { await provider.delete({ storageKey: key }); assert.equal(await provider.exists({ storageKey: key }), false); tracked.delete(key); };
  try {
    for (const mib of [10, 50, 100, 250, 512]) {
      const file = path.join(dir, 'fixture.mp4'), seed = fs.readFileSync(process.env.R2_VIDEO_FIXTURE || path.join(__dirname, '../test/fixtures/staging-video.mp4'));
      const size = mib * 1024 * 1024, header = Buffer.alloc(8); header.writeUInt32BE(size - seed.length); header.write('free', 4);
      fs.writeFileSync(file, Buffer.concat([seed, header])); fs.truncateSync(file, size);
      const checksum = await digest(file), key = prefix + mib + '.mp4'; tracked.add(key);
      try {
        const signed = await rpc('begin', { storageKey: key, mimeType: 'video/mp4', size, checksum, expiresIn: 900 });
        const started = performance.now(); const stream = fs.createReadStream(file);
        let put; try { put = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: stream, duplex: 'half', signal: AbortSignal.timeout(840000) }); await put.arrayBuffer(); } finally { stream.destroy(); }
        assert.equal(put.status, 200); const uploadMs = performance.now() - started;
        const inspected = await rpc('inspect', { storageKey: key }); assert.equal(inspected.metadata.size, size); assert.equal(inspected.metadata.mimeType, 'video/mp4'); assert.equal(inspected.inspectedBytes, 8192);
        const down = performance.now(), response = await fetch(inspected.url, { signal: AbortSignal.timeout(840000) }); assert.equal(response.status, 200);
        const h = createHash('sha256'); let downloaded = 0; for await (const chunk of response.body) { downloaded += chunk.length; h.update(chunk); }
        assert.equal(downloaded, size); assert.equal(h.digest('base64'), checksum);
        const memory = await rpc('finish'); const growth = memory.peak.rss - memory.before.rss;
        report.samples.push({ sizeBytes: size, mib, uploadMs, downloadMs: performance.now() - down, ...memory, rssGrowthBytes: growth, contentVerified: true });
        console.log(JSON.stringify({ mib, status: 'PASS', peakRssMiB: memory.peak.rss / 1048576, rssGrowthMiB: growth / 1048576, uploadMs }));
        if (memory.peak.rss > 512 * 1024 * 1024) { report.stopped = 'Backend RSS safety threshold exceeded'; break; }
      } finally { await remove(key); }
    }
  } catch { report.error = 'Transfer or assertion failed; secrets suppressed'; process.exitCode = 1; }
  finally {
    const errors = []; for (const key of tracked) { try { await remove(key); } catch { errors.push('Cleanup failed'); } }
    try { const page = await provider.client.send(new ListObjectsV2Command({ Bucket: provider.config.bucket, Prefix: prefix })); report.cleanup = { remaining: page.KeyCount, status: page.KeyCount === 0 && !errors.length ? 'PASS' : 'BLOCKED' }; } catch { report.cleanup = { status: 'BLOCKED' }; }
    const ended = once(worker, 'exit'); worker.send({ action: 'stop' }); await ended;
    provider.client.destroy(); fs.rmSync(dir, { recursive: true, force: true }); report.completedAt = new Date().toISOString(); fs.writeFileSync('/tmp/earn-r2-memory-report.json', JSON.stringify(report, null, 2), { mode: 0o600 });
  }
})().catch(() => { console.error('R2 memory test blocked; secrets suppressed'); process.exitCode = 1; });
