// Reuse the validated upload pipeline; callers must use a video field.
const { upload, getFileUrl, useCloudinary } = require('./upload');
module.exports = { uploadVideo: upload, getVideoUrl: getFileUrl, useCloudinary };
