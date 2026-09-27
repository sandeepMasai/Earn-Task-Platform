const multer = require('multer');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { uploadAsset, useCloudinary, deleteAsset } = require('../config/cloudinary');
const fail = require('../utils/httpError');

function parseSize(value, fallback) {
  if (!value) return fallback;
  const match = /^(\d+)(mb)?$/i.exec(String(value).trim());
  if (!match) throw new Error('Invalid upload size setting');
  const size = Number(match[1]) * (match[2] ? 1024 * 1024 : 1);
  if (!Number.isSafeInteger(size) || size < 1) throw new Error('Invalid upload size setting');
  return size;
}
const maxFileSize = parseSize(process.env.MAX_FILE_SIZE, 50 * 1024 * 1024);
const maxVideoSize = parseSize(process.env.MAX_VIDEO_SIZE, maxFileSize);
const permitted = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const parser = multer({
  storage: multer.diskStorage({ destination: os.tmpdir(), filename: (req, file, cb) => cb(null, `earn-upload-${randomUUID()}`) }),
  limits: { fileSize: Math.max(maxFileSize, maxVideoSize), files: 1, fields: 20, fieldSize: 65536, parts: 21 },
  fileFilter: (req, file, cb) => cb(permitted.has(file.mimetype) ? null : fail(400, 'Unsupported media type'), permitted.has(file.mimetype)),
});
async function validateContent(file, field) {
  const { fileTypeFromFile } = await import('file-type');
  const detected = await fileTypeFromFile(file.path);
  let mime = detected?.mime;
  if (!detected && file.mimetype === 'text/plain') {
    const handle = await fs.promises.open(file.path, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(file.size, 8192)); await handle.read(buffer, 0, buffer.length, 0);
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (buffer.includes(0)) throw fail(400, 'Invalid text file');
      mime = 'text/plain';
    } finally { await handle.close(); }
  }
  if (!mime || mime !== file.mimetype || !permitted.has(mime)) throw fail(400, 'File content does not match its media type');
  if (['avatar', 'proofImage', 'paymentProof'].includes(field) && !mime.startsWith('image/')) throw fail(400, 'An image is required');
  if (field === 'video' && !mime.startsWith('video/')) throw fail(400, 'A video is required');
  if (field === 'media' && !mime.startsWith('image/') && !mime.startsWith('video/')) throw fail(400, 'Story must be an image or video');
  const limit = mime.startsWith('video/') ? maxVideoSize : maxFileSize;
  if (file.size > limit) throw fail(413, 'File exceeds upload size limit');
  return detected?.ext || 'txt';
}
const upload = { single: field => (req, res, next) => parser.single(field)(req, res, async error => {
  if (error) return next(error);
  if (!req.file) return next();
  const file = req.file;
  const temporaryPath = file.path;
  try {
    const extension = await validateContent(file, field);
    if (useCloudinary()) {
      const resourceType = file.mimetype.startsWith('image/') ? 'image' : file.mimetype.startsWith('video/') ? 'video' : 'raw';
      const result = await uploadAsset(file.path, { resource_type: resourceType, public_id: `earn-task-platform/${resourceType}/${randomUUID()}${resourceType === 'raw' ? '.' + extension : ''}` });
      file.asset = { publicId: result.public_id, assetId: result.asset_id, resourceType: result.resource_type };
      file.path = result.secure_url;
      file.filename = result.public_id;
    } else {
      const directory = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
      await fs.promises.mkdir(directory, { recursive: true });
      file.filename = `${randomUUID()}.${extension}`;
      file.path = path.join(directory, file.filename);
      await fs.promises.copyFile(temporaryPath, file.path);
    }
    // Clean files from rejected requests. Successful records retain asset identity.
    res.once('finish', () => {
      if (res.statusCode >= 400) {
        const cleanup = file.asset ? deleteAsset(file.asset) : fs.promises.unlink(file.path);
        Promise.resolve(cleanup).catch(() => console.error('Rejected upload cleanup failed'));
      }
    });
    next();
  } catch (err) { next(err.status ? err : fail(400, 'Invalid file content')); }
  finally { await fs.promises.unlink(temporaryPath).catch(() => {}); }
}) };
const getFileUrl = file => file ? (file.asset ? file.path : `/uploads/${file.filename}`) : null;
module.exports = { upload, getFileUrl, useCloudinary, parseSize, validateContent };
