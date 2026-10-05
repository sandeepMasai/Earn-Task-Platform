#!/usr/bin/env node
// No Cloudinary deletion or application metadata changes, in either mode.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { GetObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { sourcePrefixes, targetIdentity, fingerprint, assertFresh } = require('../src/services/reconciliation-media/migration-safety');
const { parseUrl } = require('../src/services/reconciliation-media');
const { verifyEvidence } = require('./reconcile-media');
const digest = value => createHash('sha256').update(value).digest('hex');
function options(args, env) {
  const allowed = new Set(['--dry-run', '--execute', '--confirm', '--confirm-production', '--journal']);
  for (let i = 0; i < args.length; i++) { if (!allowed.has(args[i])) throw new Error('Unknown option'); if (args[i] === '--journal') { if (!args[++i] || args[i].startsWith('--')) throw new Error('Journal path required'); } }
  const execute = args.includes('--execute');
  const journal = args.includes('--journal') ? args[args.indexOf('--journal') + 1] : undefined;
  if (execute && (args.includes('--dry-run') || env.MEDIA_MIGRATION_EXECUTE !== 'true' || !args.includes('--confirm') || !journal || env.MEDIA_MIGRATION_BUCKET_CONFIRM !== env.R2_BUCKET)) throw new Error('Execution requires MEDIA_MIGRATION_EXECUTE=true, MEDIA_MIGRATION_BUCKET_CONFIRM matching R2_BUCKET, --execute --confirm --journal PATH (no --dry-run)');
  if (execute && env.NODE_ENV === 'production' && !args.includes('--confirm-production')) throw new Error('Execution requires explicit production confirmation: --confirm-production');
  if (execute && !['production', 'staging', 'test'].includes(env.NODE_ENV)) throw new Error('Execution requires a recognized environment');
  if (args.includes('--confirm-production') && env.NODE_ENV !== 'production') throw new Error('Production confirmation does not match runtime environment');
  // Production execution is deliberately unavailable in this validation phase.
  if (execute && (env.NODE_ENV === 'production' || !/(?:^|[-_])(staging|test)(?:$|[-_])/.test(env.R2_BUCKET || ''))) throw new Error('Production migration is disabled');
  if (execute && (!/(?:^|[-_/])(staging|test)(?:$|[-_/])/.test(env.CLOUDINARY_FOLDER_PREFIX || '') || env.MEDIA_MIGRATION_SOURCE_CONFIRM !== env.CLOUDINARY_FOLDER_PREFIX)) throw new Error('Execution requires an explicitly confirmed staging/test Cloudinary prefix');
  if (execute && env.MEDIA_MIGRATION_SOURCE_PREFIXES !== undefined && env.MEDIA_MIGRATION_SOURCE_PREFIXES_CONFIRM !== sourcePrefixes(env).join(',')) throw Error('MIGRATION_SOURCE_CONFIRMATION_REQUIRED');
  return { execute, journal, executionArgs: args };
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
async function copy(asset, item, provider, previous, validateRuntime) {
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
    validateRuntime();
    if (!exists) await provider.upload({ filePath: file, storageKey: item.key, mimeType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream', size });
    const object = await provider.send(new GetObjectCommand({ Bucket: provider.config.bucket, Key: item.key }));
    const verified = await hashBody(object.Body);
    if (verified.size !== size || verified.hash !== checksum) throw new Error('DESTINATION_CHECKSUM_MISMATCH');
    return { checksum, bytes: size };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
async function run(input) {
  // Runtime configuration is the authority. Callers cannot supply alternate destinations or sources.
  for (const key of ['provider','source','env','cloud','copyAsset']) if (Object.hasOwn(input,key)) throw new Error('MIGRATION_OVERRIDE_FORBIDDEN');
  const { execute = false, journal, output = console.log, reconciliation, executionArgs = [] } = input;
  const env = Object.freeze({ ...process.env });
  if (typeof execute !== 'boolean') throw new Error('INVALID_EXECUTION_MODE');
  const authorized = options(executionArgs, env);
  if (authorized.execute !== execute || (execute && authorized.journal !== journal)) throw new Error('Execution requires matching CLI authorization and journal');
  const issued = verifyEvidence(reconciliation, env);
  const { inventory, target } = issued;
  const cloud = target.cloud;
  const effectiveSourcePrefixes = reconciliation.migrationBinding.sourcePrefixes;
  if (execute && fingerprint(effectiveSourcePrefixes) !== fingerprint(target.sourcePrefixes)) throw Error('MIGRATION_SOURCE_CONFIRMATION_REQUIRED');
  if (!reconciliation?.completed || !Array.isArray(reconciliation.references)) throw new Error('RECONCILIATION_REQUIRED');
  if (reconciliation.missingCloudinarySources || reconciliation.malformedReferences || reconciliation.metadataMismatches) throw new Error('RECONCILIATION_REVIEW_REQUIRED');
  const referenced = new Map(reconciliation.references.filter(r => r.classification === 'exists' && !r.metadataMismatch).map(r => [r.metadata.assetId, r.metadata]));
  const summary = { mode: execute ? 'EXECUTE' : 'DRY_RUN', destinationBucket: target.bucket, sourcePrefixes: effectiveSourcePrefixes, sourceScopeMode: reconciliation.migrationBinding.sourceScopeMode, sourceScopeValidation: 'PASS', eligibleImages: 0, eligibleVideos: 0, externalOrLocalReferences: reconciliation.externalOrLocalReferences, missingSources: reconciliation.missingCloudinarySources, journal: journal ? 'PENDING_INSPECTION' : 'NOT_SUPPLIED', writes: {mongodb: 0, r2: 0, cloudinary: 0}, environment: reconciliation.environment, readiness: reconciliation.readiness, referencedAssets: referenced.size, unreferencedAssets: reconciliation.unreferencedCloudinaryAssets, total: 0, eligible: 0, skipped: 0, conflicts: 0, estimatedBytes: 0, wouldMigrate: 0, migrated: 0, failed: 0, assets: [] };
  // Validate the complete referenced source set before any journal, destination read or copy.
  for (const asset of inventory) {
    if (!referenced.has(asset.asset_id)) continue;
    if (!effectiveSourcePrefixes.some(prefix => asset.public_id.startsWith(prefix + '/'))) throw new Error('SOURCE_OUTSIDE_RECONCILED_SCOPE');
    const urlIdentity = parseUrl(asset.secure_url, cloud);
    if (urlIdentity.kind !== 'cloudinary' || urlIdentity.public_id !== asset.public_id || urlIdentity.resource_type !== asset.resource_type || urlIdentity.type !== asset.type || (urlIdentity.version && String(urlIdentity.version) !== String(asset.version))) throw new Error('SOURCE_URL_SCOPE_MISMATCH');
    const ref = referenced.get(asset.asset_id);
    if (ref.version !== asset.version || ref.bytes !== asset.bytes || ref.resourceType !== asset.resource_type || ref.deliveryType !== asset.type) throw new Error('SOURCE_CHANGED_SINCE_RECONCILIATION');
  }
  const inventoried = new Set(inventory.map(a => a.asset_id));
  if ([...referenced.keys()].some(id => !inventoried.has(id))) throw new Error('REFERENCED_SOURCE_NOT_IN_INVENTORY');
  if (execute && !referenced.size) throw new Error('NO_REFERENCED_MIGRATION_CANDIDATES');
  const provider = new (require('../src/services/storage/r2.provider'))({ env });
  let states = {}, lock;
  const scope = fingerprint({target,sourcePrefixes:effectiveSourcePrefixes,inventory:issued.inventoryFingerprint,references:reconciliation.migrationBinding.referencesFingerprint});
  // Revalidate against the actual runtime, not confirmation settings, immediately before work.
  function validateRuntime() {
    assertFresh(reconciliation.generatedAt);
    if (fingerprint(targetIdentity(process.env)) !== issued.targetFingerprint || fingerprint(targetIdentity(env)) !== issued.targetFingerprint || provider.config.accountId !== target.accountId || provider.config.bucket !== target.bucket) throw new Error('MIGRATION_RUNTIME_CHANGED');
  }
  try {
    validateRuntime();
    try { await provider.send(new HeadBucketCommand({Bucket: target.bucket})); }
    catch { throw Error('R2_ACCESS'); }
    if (journal) {
      try {
        if (fs.existsSync(journal + '.lock')) throw Error();
        if (fs.existsSync(journal)) {
          const data = JSON.parse(fs.readFileSync(journal, 'utf8'));
          if (data.version !== 1 || data.scope !== scope || !data.assets || typeof data.assets !== 'object' || Array.isArray(data.assets)) throw Error();
          states = data.assets; summary.journal = 'VERIFIED';
        } else {
          if (!fs.statSync(path.dirname(path.resolve(journal))).isDirectory()) throw Error();
          summary.journal = 'NEW_JOURNAL';
        }
        if (execute) lock = fs.openSync(journal + '.lock', 'wx', 0o600);
      } catch { throw Error('MIGRATION_JOURNAL'); }
    }
    function save() { const temp = journal + '.tmp'; const fd = fs.openSync(temp, 'w', 0o600); try { fs.writeFileSync(fd, JSON.stringify({ version: 1, scope, assets: states }, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(temp, journal); }
    const seen = new Set();
    try {
      for (const asset of inventory) {
        validateRuntime();
        summary.total++;
        const item = plan(asset, cloud), record = { destinationKey: item.key, bytes: item.bytes, status: item.reason || 'eligible' };
        summary.assets.push(record);
        const evidence = referenced.get(asset.asset_id);
        if (!evidence) { summary.skipped++; record.status = 'unreferenced_not_authorized'; continue; }
        if (item.reason) { summary.skipped++; continue; }
        if (seen.has(item.key)) { summary.conflicts++; record.status = 'duplicate_source_identity'; continue; }
        seen.add(item.key);
        let exists;
        try { exists = await provider.exists({ storageKey: item.key }); }
        catch { summary.failed++; record.status = 'destination_inspection_failed'; continue; }
        validateRuntime();
        if (exists && (!execute || !states[item.identity])) { summary.conflicts++; record.status = 'destination_exists'; continue; }
        summary.eligible++; if (asset.resource_type === 'image') summary.eligibleImages++; if (asset.resource_type === 'video') summary.eligibleVideos++; summary.estimatedBytes += item.bytes; summary.wouldMigrate++;
        if (!execute) continue;
        const previous = states[item.identity];
        states[item.identity] = { ...previous, key: item.key, status: 'pending' }; save();
        let done = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try { validateRuntime(); const result = await copy(asset, item, provider, exists ? previous : states[item.identity], validateRuntime); states[item.identity] = { key: item.key, status: 'verified', ...result }; save(); record.status = 'verified'; summary.migrated++; done = true; break; }
          catch { states[item.identity] = { ...states[item.identity], status: 'failed', attempts: attempt }; save(); if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 500)); }
        }
        if (!done) { summary.failed++; record.status = 'copy_or_verification_failed'; }
      }
    } finally { if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(journal + '.lock'); } }
    summary.status = summary.failed || summary.conflicts ? 'BLOCKED' : execute ? 'EXECUTION_COMPLETE' : 'DRY_RUN_READY';
    if (summary.failed) summary.blockReason = 'R2_ACCESS_OR_COPY_VERIFICATION';
    if (summary.conflicts) summary.blockReason = 'DESTINATION_CONFLICT';
    if (execute) delete summary.writes; // A zero-write statement applies only to dry-run.
    output(JSON.stringify(summary, null, 2));
    return summary;
  } finally { provider.client.destroy(); }
}
async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const opts = options(process.argv.slice(2), process.env);
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) if (!process.env[key]) throw new Error('Cloudinary source configuration required');
  const {result: reconciliation} = await require('./reconcile-media').collect(process.env,{forMigration:true});
  const report = await run({ reconciliation, ...opts });
  if (report.failed || report.conflicts) process.exitCode = 1;
}
function diagnostic(error) {
  const reason = error?.safeCode || error?.code || error?.message;
  const groups = {
    CLOUDINARY_SOURCE_SCOPE: ['SOURCE_OUTSIDE_RECONCILED_SCOPE','SOURCE_URL_SCOPE_MISMATCH','MIGRATION_SOURCE_SCOPE_INVALID'],
    CLOUDINARY_ACCESS: ['CLOUDINARY_NETWORK_FAILURE','CLOUDINARY_METADATA_REQUEST_FAILED','INVALID_CLOUDINARY_INVENTORY','REPEATED_INVENTORY_CURSOR'],
    R2_ACCESS: ['R2_ACCESS','R2_BUCKET_UNAVAILABLE','STORAGE_UNAVAILABLE'],
    MIGRATION_JOURNAL: ['MIGRATION_JOURNAL'],
    RECONCILIATION_NOT_READY: ['RECONCILIATION_REQUIRED','RECONCILIATION_REVIEW_REQUIRED','REFERENCED_SOURCE_NOT_IN_INVENTORY','SOURCE_CHANGED_SINCE_RECONCILIATION','NO_REFERENCED_MIGRATION_CANDIDATES','RECONCILIATION_EVIDENCE_NOT_ISSUED','RECONCILIATION_STALE_OR_INVALID','RECONCILIATION_TARGET_MISMATCH','RECONCILIATION_EVIDENCE_CHANGED','MIGRATION_RUNTIME_CHANGED'],
    MIGRATION_AUTHORIZATION: ['MIGRATION_SOURCE_CONFIRMATION_REQUIRED','Production migration is disabled','Execution requires explicit production confirmation: --confirm-production','Production confirmation does not match runtime environment','MIGRATION_OVERRIDE_FORBIDDEN','Execution requires matching CLI authorization and journal'],
    CONFIGURATION: ['MIGRATION_ENVIRONMENT_INVALID','MIGRATION_DATABASE_INVALID','MIGRATION_PROVIDER_INVALID','RECONCILIATION_CONFIGURATION_MISSING','R2_NOT_CONFIGURED','INVALID_R2_CONFIG','R2_PRIVATE_BUCKET_REQUIRED','R2_PUBLIC_URL_UNSUPPORTED','Cloudinary source configuration required','Unknown option','Journal path required'],
  };
  const blockReason = Object.keys(groups).find(group => groups[group].includes(reason)) || (error?.name?.startsWith('Mongo') ? 'DATABASE_ACCESS' : 'UNCLASSIFIED_PREFLIGHT');
  // Never emit raw driver messages, stacks, causes, URLs or credential-bearing arguments.
  return {status:'BLOCKED',blockReason,httpStatus:Number.isInteger(error?.httpStatus)?error.httpStatus:null};
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify(diagnostic(error))); console.error('Migration BLOCKED; no Cloudinary deletes or database changes performed.'); process.exitCode = 1; });
module.exports = { options, plan, run, diagnostic };
