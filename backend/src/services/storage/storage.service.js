const { randomUUID } = require('node:crypto');
const { providerFor } = require('./config');
const { StorageError, safeError } = require('./storage.errors');
const providers = {};
function provider(name) {
  if (!['cloudinary', 'r2'].includes(name)) throw new StorageError('INVALID_STORAGE_PROVIDER', 503);
  return providers[name] ||= new (require(`./${name}.provider`))();
}
async function run(name, operation, args, context = {}) {
  const started = Date.now(); let success = false;
  const correlationId = /^[a-f0-9-]{36}$/.test(context.requestId || '') ? context.requestId : randomUUID();
  try { const result = await provider(name)[operation](...args); success = true; return result; }
  catch (e) { throw safeError(e); }
  finally { if (process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ provider: name, operation, success, durationMs: Date.now() - started, requestId: correlationId })); }
}
module.exports = {
  providerFor,
  upload: (input, context) => run(input.provider || providerFor(input.category), 'upload', [input], context),
  delete: (asset, context) => run(asset.provider || 'cloudinary', 'delete', [asset], context),
  getUrl: (asset, options, context) => run(asset.provider || 'cloudinary', 'getUrl', [asset, options], context),
  exists: (asset, context) => run(asset.provider || 'cloudinary', 'exists', [asset], context),
  getMetadata: (asset, context) => run(asset.provider || 'cloudinary', 'getMetadata', [asset], context),
  readPrefix: (asset, context) => run(asset.provider || 'r2', 'readPrefix', [asset], context),
  presignUpload: (input, context) => run('r2', 'presignUpload', [input], context),
  deleteLegacyUrl: url => run('cloudinary', 'deleteLegacyUrl', [url]),
};
