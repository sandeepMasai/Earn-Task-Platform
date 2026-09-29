#!/usr/bin/env node
// No Cloudinary deletion or application metadata changes, in either mode.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const digest = value => createHash('sha256').update(value).digest('hex');
function options(args, env) {
  const allowed = new Set(['--dry-run', '--execute', '--confirm', '--journal']);
  for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i])) throw new Error('Unknown option'); if (args[i] === '--journal') { if (!args[++i] || args[i].startsWith('--')) throw new Error('Journal path required'); } }
  const execute = args.includes('--execute');
  const journal = args.includes('--journal') ? args[args.indexOf('--journal') + 1] : undefined;
  if (execute && (args.includes('--dry-run') || env.MEDIA_MIGRATION_EXECUTE !== 'true' || !args.includes('--confirm') || !journal || env.MEDIA_MIGRATION_BUCKET_CONFIRM !== env.R2_BUCKET)) throw new Error('Execution requires MEDIA_MIGRATION_EXECUTE=true, MEDIA_MIGRATION_BUCKET_CONFIRM matching R2_BUCKET, --execute --confirm --journal PATH (no --dry-run)');
  // Production execution is deliberately unavailable in this validation phase.
  if (execute && (env.NODE_ENV === 'production' || !/(?:^|[-_])(staging|test)(?:$|[-_])/.test(env.R2_BUCKET || ''))) throw new Error('Production migration is disabled');
  if (execute && (!/(?:^|[-_/])(staging|test)(?:$|[-_/])/.test(env.CLOUDINARY_FOLDER_PREFIX || '') || env.MEDIA_MIGRATION_SOURCE_CONFIRM !== env.CLOUDINARY_FOLDER_PREFIX)) throw new Error('Execution requires an explicitly confirmed staging/test Cloudinary prefix');
  return { execute, journal };
}
function plan(asset, cloud) {
  const identity = [cloud, asset.resource_type, asset.type, asset.asset_id, asset.version].join(':');
  const key = `migration/cloudinary/${digest(identity)}`;
  let reason;
  if (!asset.asset_id || !asset.public_id || !asset.version || !['image', 'video', 'raw'].includes(asset.resource_type) || !['upload', 'private', 'authenticated'].includes(asset.type)) reason = 'invalid_identity';
  else if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 512 * 1024 * 1024) reason = 'invalid_or_oversized_bytes';
  else if (asset.type !== 'upload') reason = 'restricted_source_requires_review';
  else { try { const u = new URL(asset.secure_url); if (u.protocol !== 'https:' || u.hostname !== 'res.cloudinary.com' || u.username || u.password || u.search || u.hash || u.pathname.split('/')[1] !== cloud) reason = 'unsupported_source_url'; } catch { reason = 'invalid_source_url'; } }
  return { key, identity: digest(identity), bytes: asset.bytes, reason };
}
async function hashBody(body) { const h = createHash('sha256'); let size = 0; for await (const chunk of body) { h.update(chunk); size += chunk.length; } return { hash: h.digest('hex'), size }; }
async function copy(asset, item, provider, previous) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'earn-media-migration-'));
  try {
    const response = await fetch(asset.secure_url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error('SOURCE_DOWNLOAD_FAILED');
    const file = path.join(directory, 'source');
    let size = 0; const hash = createHash('sha256');
    await pipeline(Readable.fromWeb(response.body), new Transform({ transform(chunk, encoding, callback) { size += chunk.length; if (size > item.bytes) return callback(new Error('SOURCE_SIZE_MISMATCH')); hash.update(chunk); callback(null, chunk); } }), fs.createWriteStream(file, { flags: 'wx', mode: 0o600 }));
    const checksum = hash.digest('hex');
    if (size !== item.bytes) throw new Error('SOURCE_SIZE_MISMATCH');
    const exists = await provider.exists({ storageKey: item.key });
    // A destination not claimed in this journal is a conflict, never an overwrite.
    if (exists && !previous) throw new Error('DESTINATION_CONFLICT');
    if (!exists) await provider.upload({ filePath: file, storageKey: item.key, mimeType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream', size });
    const object = await provider.send(new GetObjectCommand({ Bucket: provider.config.bucket, Key: item.key }));
    const verified = await hashBody(object.Body);
    if (verified.size !== size || verified.hash !== checksum) throw new Error('DESTINATION_CHECKSUM_MISMATCH');
    return { checksum, bytes: size };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
async function run({ source, provider, cloud, execute = false, journal, output = console.log, copyAsset = copy }) {
  const summary = { mode: execute ? 'EXECUTE' : 'DRY_RUN', total: 0, eligible: 0, skipped: 0, conflicts: 0, estimatedBytes: 0, wouldMigrate: 0, migrated: 0, failed: 0, assets: [] };
  let states = {}, lock;
  const scope = digest(cloud + ':' + provider.config.accountId + ':' + provider.config.bucket);
  if (execute) {
    lock = fs.openSync(journal + '.lock', 'wx', 0o600);
    try { if (fs.existsSync(journal)) { const data = JSON.parse(fs.readFileSync(journal, 'utf8')); if (data.scope !== scope) throw new Error('Journal scope mismatch'); states = data.assets; } }
    catch (e) { fs.closeSync(lock); fs.unlinkSync(journal + '.lock'); throw e; }
  }
  function save() { const temp = journal + '.tmp'; const fd = fs.openSync(temp, 'w', 0o600); try { fs.writeFileSync(fd, JSON.stringify({ version: 1, scope, assets: states }, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(temp, journal); }
  const seen = new Set();
  try {
    for await (const asset of source()) {
      summary.total++;
      const item = plan(asset, cloud), record = { destinationKey: item.key, bytes: item.bytes, status: item.reason || 'eligible' };
      summary.assets.push(record);
      if (item.reason) { summary.skipped++; continue; }
      if (seen.has(item.key)) { summary.conflicts++; record.status = 'duplicate_source_identity'; continue; }
      seen.add(item.key);
      let exists;
      try { exists = await provider.exists({ storageKey: item.key }); }
      catch { summary.failed++; record.status = 'destination_inspection_failed'; continue; }
      if (exists && (!execute || !states[item.identity])) { summary.conflicts++; record.status = 'destination_exists'; continue; }
      summary.eligible++; summary.estimatedBytes += item.bytes; summary.wouldMigrate++;
      if (!execute) continue;
      const previous = states[item.identity];
      states[item.identity] = { ...previous, key: item.key, status: 'pending' }; save();
      let done = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { const result = await copyAsset(asset, item, provider, exists ? previous : states[item.identity]); states[item.identity] = { key: item.key, status: 'verified', ...result }; save(); record.status = 'verified'; summary.migrated++; done = true; break; }
        catch { states[item.identity] = { ...states[item.identity], status: 'failed', attempts: attempt }; save(); if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 500)); }
      }
      if (!done) { summary.failed++; record.status = 'copy_or_verification_failed'; }
    }
  } finally { if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(journal + '.lock'); } }
  output(JSON.stringify(summary, null, 2));
  return summary;
}
async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const opts = options(process.argv.slice(2), process.env);
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) if (!process.env[key]) throw new Error('Cloudinary source configuration required');
  // Inventory does not assert bucket privacy or write anything. Execution requires the provider's private-mode guard.
  const providerEnv = opts.execute ? process.env : { ...process.env, R2_PRIVATE_BUCKET: 'true', R2_PUBLIC_BASE_URL: '' };
  const provider = new (require('../src/services/storage/r2.provider'))({ env: providerEnv });
  async function* source() {
    for (const resource_type of ['image', 'video', 'raw']) for (const type of ['upload', 'private', 'authenticated']) {
      let next_cursor;
      do {
        const url = new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/resources/${resource_type}/${type}`);
        url.searchParams.set('max_results', '500'); if (opts.execute) url.searchParams.set('prefix', process.env.CLOUDINARY_FOLDER_PREFIX + '/'); if (next_cursor) url.searchParams.set('next_cursor', next_cursor);
        const response = await fetch(url, { headers: { Authorization: 'Basic ' + Buffer.from(process.env.CLOUDINARY_API_KEY + ':' + process.env.CLOUDINARY_API_SECRET).toString('base64') }, signal: AbortSignal.timeout(30000), redirect: 'error' });
        if (!response.ok) throw Object.assign(new Error('Source inventory denied'), { httpStatus: response.status });
        const page = await response.json(); for (const asset of page.resources) yield asset; next_cursor = page.next_cursor;
      } while (next_cursor);
    }
  }
  try { const report = await run({ source, provider, cloud: process.env.CLOUDINARY_CLOUD_NAME, ...opts }); if (report.failed) process.exitCode = 1; }
  finally { provider.client.destroy(); }
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ status: 'BLOCKED', httpStatus: error.httpStatus || null, network: ['ENOTFOUND','ECONNREFUSED','ETIMEDOUT'].includes(error.cause?.code) ? error.cause.code : error.name === 'TimeoutError' ? 'TIMEOUT' : undefined })); console.error('Migration BLOCKED: source/destination access, configuration or journal failed; provider details suppressed. No Cloudinary deletes or database changes performed.'); process.exitCode = 1; });
module.exports = { options, plan, run, copy };
