const cloudinary = require('cloudinary').v2;
const { getCloudinaryFolderPrefix } = require('./cloudinaryPrefix');
getCloudinaryFolderPrefix(); // Fail configuration at startup, including before local fallback.

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Check if Cloudinary is configured
const useCloudinary = () => {
  return !!(process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET);
};

const retry = require('../utils/retry');

const uploadAsset = async (filePath, options) => {
  getCloudinaryFolderPrefix();
  try {
    const result = await retry(() => cloudinary.uploader.upload(filePath, { timeout: 30000, overwrite: false, ...options }));
    if (!result.public_id || !result.asset_id || !result.resource_type || !result.secure_url?.startsWith('https://')) throw new Error('Invalid upload response');
    return result;
  } catch (error) {
    throw Object.assign(new Error('Media provider upload failed'), { status: error.http_code === 429 ? 503 : 502, providerStatus: Number.isInteger(error.http_code) ? error.http_code : undefined, providerCode: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'].includes(error.code) ? error.code : undefined });
  }
};

const deleteAsset = async (asset) => {
  if (!asset?.publicId || !['image', 'video', 'raw'].includes(asset.resourceType)) throw new Error('Invalid stored asset identity');
  try {
    const result = await retry(() => cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resourceType, invalidate: true, timeout: 30000 }));
    return ['ok', 'not found'].includes(result.result);
  } catch (error) {
    throw Object.assign(new Error('Media provider deletion failed'), { status: error.http_code === 429 ? 503 : 502, providerStatus: Number.isInteger(error.http_code) ? error.http_code : undefined, providerCode: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'].includes(error.code) ? error.code : undefined });
  }
};

// Helper function to delete file from Cloudinary
const deleteFromCloudinary = async (url) => {
  if (!url || !useCloudinary()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'res.cloudinary.com') return false;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] !== process.env.CLOUDINARY_CLOUD_NAME || parts[2] !== 'upload') return false;
    const resourceType = parts[1];
    if (!['image', 'video', 'raw'].includes(resourceType)) return false;
    const asset = parts.slice(3);
    const version = asset.findIndex(part => /^v\d+$/.test(part));
    const publicParts = version >= 0 ? asset.slice(version + 1) : asset;
    let publicId = decodeURIComponent(publicParts.join('/'));
    if (resourceType !== 'raw') publicId = publicId.replace(/\.[^/.]+$/, '');
    if (!publicId) return false;

    // Delete from Cloudinary
    return deleteAsset({ publicId, resourceType });
  } catch (error) {
    console.error('Media provider deletion failed');
    return false;
  }
};

module.exports = {
  cloudinary,
  uploadAsset,
  deleteAsset,
  deleteFromCloudinary,
  useCloudinary,
};
