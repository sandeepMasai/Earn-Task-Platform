const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
  publicId: { type: String, required: true },
  assetId: { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
}, { _id: false });
