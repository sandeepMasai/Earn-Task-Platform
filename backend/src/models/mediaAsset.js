const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
  provider: { type: String, enum: ['cloudinary', 'r2'] },
  mediaId: String, type: String, createdAt: Date,
  storageKey: { type: String, required: function () { return this.provider === 'r2'; } },
  mimeType: String, format: String, size: Number, secureUrl: String, version: String,
  publicId: { type: String, required: function () { return this.provider !== 'r2'; } },
  assetId: { type: String, required: function () { return this.provider !== 'r2'; } },
  resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
}, { _id: false });
