const { randomUUID } = require('node:crypto');

function getCloudinaryFolderPrefix(env = process.env) {
  const value = env.CLOUDINARY_FOLDER_PREFIX;
  if (value === undefined && env.NODE_ENV === 'staging') {
    throw new Error('CLOUDINARY_FOLDER_PREFIX is required in staging');
  }
  const prefix = value === undefined ? 'earn-task-platform' : value;
  if (typeof prefix !== 'string' || !prefix.trim()) throw new Error('Invalid CLOUDINARY_FOLDER_PREFIX');
  const trimmed = prefix.trim();
  // A restricted path alphabet also rejects encoded traversal, URL schemes,
  // backslashes and control characters without echoing configuration values.
  if (!/^[a-zA-Z0-9_./-]+$/.test(trimmed)) throw new Error('Invalid CLOUDINARY_FOLDER_PREFIX');
  const segments = trimmed.split('/').filter(Boolean);
  if (!segments.length || segments.some(segment => segment === '..' || segment === '.')) {
    throw new Error('Invalid CLOUDINARY_FOLDER_PREFIX');
  }
  return segments.join('/');
}

function createPublicId(resourceType, extension, env = process.env) {
  if (!['image', 'video', 'raw'].includes(resourceType)) throw new Error('Invalid resource type');
  if (resourceType === 'raw' && !/^[a-zA-Z0-9]+$/.test(extension || '')) throw new Error('Invalid raw extension');
  return `${getCloudinaryFolderPrefix(env)}/${resourceType}/${randomUUID()}${resourceType === 'raw' ? '.' + extension : ''}`;
}

module.exports = { getCloudinaryFolderPrefix, createPublicId };
