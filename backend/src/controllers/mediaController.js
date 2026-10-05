const Media = require('../models/Media');
const storage = require('../services/storage/storage.service');
const policy = require('../services/storage/mediaPolicy');
const fail = require('../utils/httpError');
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
async function owned(req) {
  if (!/^[a-f0-9-]{36}$/.test(req.params.id || '')) throw fail(404, 'Media not found');
  const media = await Media.findById(req.params.id);
  if (!media) throw fail(404, 'Media not found');
  if (String(media.user) !== String(req.user._id)) throw fail(403, 'Media belongs to another user');
  return media;
}
const view = media => ({ id: media.id, provider: media.provider, storageKey: media.storageKey, category: media.category, type: media.type, createdAt: media.createdAt, mimeType: media.mimeType, size: media.size, status: media.status, processingStatus: media.processingStatus });
exports.init = wrap(async (req, res) => {
  const extension = policy.validate(req.body);
  if (storage.providerFor(req.body.category) !== 'r2') throw fail(409, 'Direct uploads are not enabled for this media category');
  if (process.env.R2_PRIVATE_BUCKET !== 'true' || process.env.R2_PUBLIC_BASE_URL) throw fail(503, 'Direct uploads require a configured private bucket');
  const expiresAt = new Date(Date.now() + 300000);
  const input = { storageKey: policy.key(req.body.category, extension), mimeType: req.body.mimeType, size: req.body.size, checksum: req.body.checksum };
  const signed = await storage.presignUpload(input, { requestId: req.mediaRequestId });
  const media = await Media.create({ ...input, user: req.user._id, category: req.body.category, provider: 'r2', expiresAt });
  res.status(201).json({ success: true, data: { media: view(media), upload: signed, expiresAt } });
});
exports.complete = wrap(async (req, res) => {
  const media = await owned(req);
  if (media.status === 'ready') return res.json({ success: true, data: view(media) });
  if (media.status !== 'pending' || media.expiresAt <= new Date()) throw fail(409, 'Upload expired or unavailable');
  const metadata = await storage.getMetadata(media, { requestId: req.mediaRequestId });
  try {
    if (metadata.size !== media.size || metadata.mimeType !== media.mimeType) throw fail(400, 'Uploaded object does not match the authorized upload');
    await policy.validateBytes(await storage.readPrefix(media, { requestId: req.mediaRequestId }), media.mimeType);
  } catch (e) {
    if (e.status === 400) await Media.updateOne({ _id: media.id, status: 'pending' }, { status: 'rejected' });
    throw e;
  }
  // The signed checksum and If-None-Match prevent content replacement between validation and publication.
  const updated = await Media.findOneAndUpdate({ _id: media.id, user: req.user._id, status: 'pending', expiresAt: { $gt: new Date() } }, { status: 'ready', etag: metadata.etag }, { new: true });
  if (!updated) {
    const current = await owned(req);
    if (current.status === 'ready') return res.json({ success: true, data: view(current) });
    throw fail(409, 'Upload state changed');
  }
  res.json({ success: true, data: view(updated) });
});
async function authorizeMediaAccess(req, mediaId) {
  if (!/^[a-f0-9-]{36}$/.test(mediaId || '')) throw fail(404, 'Media not found');
  const media = await Media.findById(mediaId);
  if (!media) throw fail(404, 'Media not found');
  if (String(media.user) !== String(req.user._id) && req.user.role !== 'admin') {
    const [publishedPost, publishedStory, publishedAvatar, submission] = await Promise.all([
      require('../models/Post').exists({ 'mediaAsset.mediaId': media.id, isActive: true }),
      require('../models/Story').exists({ 'mediaAsset.mediaId': media.id, isActive: true, expiresAt: { $gt: new Date() } }),
      require('../models/User').exists({ 'avatarAsset.mediaId': media.id, isActive: true }),
      require('../models/TaskSubmission').findOne({ 'proofAsset.mediaId': media.id }),
    ]);

    let isAuthorized = Boolean(publishedPost || publishedStory || publishedAvatar);

    if (!isAuthorized && submission) {
      const task = await require('../models/Task').findById(submission.task);
      if (task && String(task.createdBy) === String(req.user._id)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      console.warn(`[MediaAuth] Authorization denied: user=${req.user._id} role=${req.user.role} mediaId=${media.id}`);
      throw fail(403, 'Media belongs to another user');
    }
  }
  if (media.status !== 'ready') throw fail(409, 'Media is not ready');
  return media;
}

exports.metadata = wrap(async (req, res) => res.json({ success: true, data: view(await owned(req)) }));

// Generates a short-lived signed GET URL for in-app media playback and display
exports.getUrl = wrap(async (req, res) => {
  const media = await authorizeMediaAccess(req, req.params.id);
  const signedUrl = await storage.getUrl(media, { expiresIn: 300, disposition: 'inline' }, { requestId: req.mediaRequestId });
  res.json({
    success: true,
    url: signedUrl,
    expiresIn: 300,
    data: {
      url: signedUrl,
      expiresIn: 300,
      mimeType: media.mimeType,
      size: media.size,
    },
  });
});

exports.download = wrap(async (req, res) => {
  const media = await owned(req);
  if (media.status !== 'ready') throw fail(409, 'Media is not ready');
  const signedUrl = await storage.getUrl(media, { expiresIn: 300, disposition: 'attachment' }, { requestId: req.mediaRequestId });
  res.json({
    success: true,
    url: signedUrl,
    expiresIn: 300,
    data: {
      url: signedUrl,
      expiresIn: 300,
      mimeType: media.mimeType,
      size: media.size,
    },
  });
});

// Feed/story/profile publication grants authenticated read access only.
exports.content = wrap(async (req, res) => {
  const media = await authorizeMediaAccess(req, req.params.id);
  const signedUrl = await storage.getUrl(media, { expiresIn: 300, disposition: 'inline' }, { requestId: req.mediaRequestId });
  res.set('Accept-Ranges', 'bytes');
  if (media.mimeType) {
    res.set('Content-Type', media.mimeType);
  }
  res.set('Location', signedUrl);
  return res.status(302).end();
});
exports.remove = wrap(async (req, res) => {
  const media = await owned(req);
  if (media.status !== 'deleted') {
    // Revoke app access first. Retry can finish deletion after a provider failure.
    await Media.updateOne({ _id: media.id, user: req.user._id }, { status: 'deleting' });
    // Do not remove the object while an issued PUT could recreate it.
    if (media.expiresAt > new Date()) return res.status(202).json({ success: true, data: { status: 'deleting', deleteAfter: media.expiresAt } });
    await storage.delete(media, { requestId: req.mediaRequestId });
    await Media.updateOne({ _id: media.id, status: 'deleting' }, { status: 'deleted' });
  }
  res.json({ success: true, data: { status: 'deleted' } });
});
