const Media = require('../../models/Media');
async function referenced(id) {
  const refs = await Promise.all([
    require('../../models/Post').exists({ 'mediaAsset.mediaId': id, isActive: true }),
    require('../../models/Story').exists({ 'mediaAsset.mediaId': id, isActive: true, expiresAt: { $gt: new Date() } }),
    require('../../models/User').exists({ 'avatarAsset.mediaId': id }),
  ]);
  return refs.some(Boolean);
}
async function retire(asset) {
  if (asset?.provider !== 'r2' || !asset.mediaId || await referenced(asset.mediaId)) return;
  const media = await Media.findOneAndUpdate({ _id: asset.mediaId, storageKey: asset.storageKey, status: { $ne: 'deleted' } }, { status: 'deleting' }, { new: true });
  if (!media || media.expiresAt > new Date(Date.now() - 60000)) return;
  await require('./storage.service').delete(media);
  await Media.updateOne({ _id: media.id, status: 'deleting' }, { status: 'deleted' });
}
module.exports = { referenced, retire };
