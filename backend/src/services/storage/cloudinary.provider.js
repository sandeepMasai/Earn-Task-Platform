const legacy = require('../../config/cloudinary');
const { createPublicId } = require('../../config/cloudinaryPrefix');
class CloudinaryProvider {
  async upload({ filePath, resourceType, extension, mimeType, size }) {
    const result = await legacy.uploadAsset(filePath, { resource_type: resourceType, public_id: createPublicId(resourceType, extension) });
    return { provider: 'cloudinary', publicId: result.public_id, storageKey: result.public_id, assetId: result.asset_id, resourceType: result.resource_type, mimeType, size: result.bytes || size, format: result.format || extension, secureUrl: result.secure_url, version: result.version === undefined ? undefined : String(result.version) };
  }
  delete(asset) { return legacy.deleteAsset(asset); }
  getUrl(asset) { return asset.secureUrl || null; }
  async getMetadata(asset) {
    const data = await legacy.cloudinary.api.resource(asset.publicId, { resource_type: asset.resourceType, timeout: 30000 });
    return { size: data.bytes, format: data.format, resourceType: data.resource_type, secureUrl: data.secure_url, version: String(data.version) };
  }
  async exists(asset) { try { await this.getMetadata(asset); return true; } catch (e) { if (e.http_code === 404 || e.error?.http_code === 404) return false; throw e; } }
  deleteLegacyUrl(url) { return legacy.deleteFromCloudinary(url); }
}
module.exports = CloudinaryProvider;
