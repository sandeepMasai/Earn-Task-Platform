const Media = require('../models/Media');
const fail = require('../utils/httpError');

// JSON clients attach a completed upload. Multipart Cloudinary clients keep their existing path.
module.exports = field => async (req, res, next) => {
  try {
    if (req.body?.mediaId === undefined) return next();
    if (req.file || typeof req.body.mediaId !== 'string' || !/^[a-f0-9-]{36}$/.test(req.body.mediaId)) throw fail(400, 'Invalid media reference');
    const media = await Media.findById(req.body.mediaId);
    if (!media) throw fail(404, 'Media not found');
    if (String(media.user) !== String(req.user._id)) throw fail(403, 'Media belongs to another user');
    if (media.status !== 'ready') throw fail(409, 'Media is not ready');
    if (field === 'avatar' && !media.mimeType.startsWith('image/')) throw fail(400, 'An image is required');
    if (field === 'story' && !/^(image|video)\//.test(media.mimeType)) throw fail(400, 'An image or video is required');
    if (field === 'story' && req.body.type && req.body.type !== media.mimeType.split('/')[0]) throw fail(400, 'Story type does not match media');
    const expected = media.category === 'reels' ? 'reel' : media.type;
    if (field === 'post' && req.body.type && req.body.type !== expected) throw fail(400, 'Post type does not match media');
    if (field === 'post') req.body.type = expected;
    req.file = {
      mimetype: media.mimeType, size: media.size, path: `/api/media/${media.id}/content`,
      asset: { provider: 'r2', mediaId: media.id, storageKey: media.storageKey, mimeType: media.mimeType, size: media.size, type: media.type, createdAt: media.createdAt, resourceType: media.mimeType.startsWith('image/') ? 'image' : media.mimeType.startsWith('video/') ? 'video' : 'raw' },
    };
    next();
  } catch (error) { next(error); }
};
