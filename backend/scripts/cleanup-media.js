// Explicit worker entrypoint. Never runs at startup; operates only on recorded owned keys.
if (require.main === module) require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('../src/models/Media');
const storage = require('../src/services/storage/storage.service');
async function cleanup() {
  const cutoff = new Date(Date.now() - 60000); // clock-skew buffer after PUT expiry
  let failures = 0;
  const retiredStories = await Media.find({ provider: 'r2', status: 'ready', retireAfter: { $lt: cutoff } }).limit(100);
  for (const media of retiredStories) {
    try { await require('../src/services/storage/mediaLifecycle').retire({ provider: 'r2', mediaId: media.id, storageKey: media.storageKey }); }
    catch { failures++; }
  }
  const records = await Media.find({ provider: 'r2', status: { $in: ['pending', 'rejected', 'deleting'] }, expiresAt: { $lt: cutoff } }).limit(100);
  for (const item of records) {
    try {
    const claimed = await Media.findOneAndUpdate({ _id: item.id, status: item.status, expiresAt: { $lt: cutoff } }, { status: 'deleting' }, { new: true });
    if (!claimed) continue;
    await storage.delete(claimed);
    await Media.updateOne({ _id: item.id, status: 'deleting' }, { status: 'deleted' });
    } catch { failures++; }
  }
  if (failures) throw new Error('Media cleanup incomplete; retry remaining records');
  return records.length;
}
if (require.main === module) {
  if (process.env.MEDIA_CLEANUP_ENABLED !== 'true') { console.error('Set MEDIA_CLEANUP_ENABLED=true for explicit cleanup'); process.exitCode = 1; }
  else mongoose.connect(process.env.MONGODB_URI).then(cleanup).then(count => console.log(JSON.stringify({ operation: 'media_cleanup', count }))).catch(() => { console.error('Media cleanup failed'); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
module.exports = cleanup;
