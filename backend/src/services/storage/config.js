const { StorageError } = require('./storage.errors');
function providerFor(category, env = process.env) {
  const provider = env[`MEDIA_STORAGE_PROVIDER_${String(category || '').toUpperCase()}`] || env.MEDIA_STORAGE_PROVIDER || 'cloudinary';
  if (!['cloudinary', 'r2'].includes(provider)) throw new StorageError('INVALID_STORAGE_PROVIDER', 503);
  return provider;
}
function r2Config(env = process.env) {
  for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
    if (!env[key]) throw new StorageError('R2_NOT_CONFIGURED', 503);
  }
  if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET)) throw new StorageError('INVALID_R2_CONFIG', 503);
  // All implemented R2 reads are authenticated, short-lived signed S3 requests.
  // There is no public/CDN delivery mode in this application.
  if (env.R2_PUBLIC_BASE_URL) throw new StorageError('R2_PUBLIC_URL_UNSUPPORTED', 503);
  if (env.R2_PRIVATE_BUCKET !== 'true') throw new StorageError('R2_PRIVATE_BUCKET_REQUIRED', 503);
  return { accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET, publicBaseUrl: env.R2_PUBLIC_BASE_URL };
}
function validKey(key) {
  if (typeof key !== 'string' || key.length > 512 || !/^[a-zA-Z0-9_./-]+$/.test(key) || key.startsWith('/') || key.split('/').some(x => !x || x === '.' || x === '..')) throw new StorageError('INVALID_OBJECT_KEY', 400);
  return key;
}
module.exports = { providerFor, r2Config, validKey };
