const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const schema = new mongoose.Schema({
  _id: { type: String, default: randomUUID },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['r2', 'cloudinary'], required: true },
  storageKey: { type: String, required: true },
  category: { type: String, enum: ['images', 'videos', 'reels', 'documents'], required: true },
  type: { type: String, enum: ['image', 'video', 'reel', 'document'], default: function () { return ({ images: 'image', videos: 'video', reels: 'reel', documents: 'document' })[this.category]; } },
  mimeType: { type: String, required: true }, size: { type: Number, required: true },
  checksum: { type: String, required: true },
  status: { type: String, enum: ['pending', 'ready', 'rejected', 'deleting', 'deleted'], default: 'pending' },
  expiresAt: { type: Date, required: true },
  retireAfter: Date,
  etag: String, duration: Number,
  // Future workers write derived streaming assets separately, never binary data.
  processingStatus: { type: String, enum: ['not_requested', 'queued', 'processing', 'ready', 'failed'], default: 'not_requested' },
  renditions: [{ _id: false, storageKey: String, format: String, width: Number, height: Number, bitrate: Number }],
}, { timestamps: true });
schema.index({ provider: 1, storageKey: 1 }, { unique: true });
schema.index({ status: 1, expiresAt: 1 }); // Explicit cleanup; TTL would orphan storage objects.
module.exports = mongoose.model('Media', schema);
