const { test } = require('node:test');
const enabled = process.env.R2_INTEGRATION_TEST === 'true';
if (enabled) require('dotenv').config();
const { configured, verifyTestBucket, disposable } = require('../support/r2-live');
const blocked = !enabled ? 'BLOCKED: set R2_INTEGRATION_TEST=true and dedicated test bucket credentials' : !configured() ? 'BLOCKED: R2 credentials missing' : false;
test('live R2 upload, exists, metadata, direct download, immutable PUT and delete', { skip: blocked, timeout: 120000 }, async () => {
  verifyTestBucket(); const provider = new (require('../../src/services/storage/r2.provider'))();
  try { await disposable(provider); } finally { provider.client.destroy(); }
});
test('live R2 rejects expired presigned PUT', { skip: blocked, timeout: 60000 }, async () => {
  verifyTestBucket(); const provider = new (require('../../src/services/storage/r2.provider'))();
  try { await disposable(provider, { expired: true }); } finally { provider.client.destroy(); }
});
