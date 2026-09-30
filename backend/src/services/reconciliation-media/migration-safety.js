// Pure validation only. Never connect to a database or storage provider here.
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { r2Config, providerFor } = require('../storage/config');
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MAX_EVIDENCE_AGE_MS = 5 * 60 * 1000;
function targetIdentity(env) {
  if (!['production', 'staging', 'test'].includes(env.NODE_ENV)) throw Error('MIGRATION_ENVIRONMENT_INVALID');
  let databaseName;
  try {
    const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)(?:\?|$)/.exec(env.MONGODB_URI || '');
    if (!match) throw Error();
    databaseName = decodeURIComponent(match[1]);
    // Parse driver options without opening a connection; do not accept an implicit database.
    if (!/^[a-zA-Z0-9_-]+$/.test(databaseName) || new MongoClient(env.MONGODB_URI).db().databaseName !== databaseName) throw Error();
  } catch { throw Error('MIGRATION_DATABASE_INVALID'); }
  const prefix = env.CLOUDINARY_FOLDER_PREFIX;
  if (!env.CLOUDINARY_CLOUD_NAME || typeof prefix !== 'string' || !prefix || prefix.trim() !== prefix || prefix.split('/').some(p => !p || p === '.' || p === '..') || !/^[a-zA-Z0-9_/-]+$/.test(prefix)) throw Error('MIGRATION_SOURCE_SCOPE_INVALID');
  if (['images', 'videos', 'reels', 'documents'].some(category => providerFor(category, env) !== 'r2')) throw Error('MIGRATION_PROVIDER_INVALID');
  const r2 = r2Config(env);
  return {
    environment: env.NODE_ENV, databaseName,
    // Bind the exact configured cluster/URI without retaining or displaying credentials.
    databaseTargetFingerprint: fingerprint(env.MONGODB_URI),
    cloud: env.CLOUDINARY_CLOUD_NAME, prefix,
    sourceCredentialFingerprint: fingerprint([env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET]),
    provider: 'r2', accountId: r2.accountId, bucket: r2.bucket,
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`, region: 'auto',
    privateBucket: true, publicBaseUrl: '',
    destinationCredentialFingerprint: fingerprint([r2.accessKeyId, r2.secretAccessKey]),
    keyScheme: 'cloudinary-sha256-v1',
  };
}
function inventoryFingerprint(inventory) {
  return fingerprint(inventory.map(a => [a.asset_id, a.public_id, a.resource_type, a.type, a.version, a.bytes, a.format ?? null, a.secure_url ?? null]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function assertFresh(generatedAt) {
  const stamp = Date.parse(generatedAt);
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString() !== generatedAt || stamp > Date.now() || Date.now() - stamp > MAX_EVIDENCE_AGE_MS) throw Error('RECONCILIATION_STALE_OR_INVALID');
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
module.exports = { targetIdentity, fingerprint, inventoryFingerprint, assertFresh, freeze, MAX_EVIDENCE_AGE_MS };
