const mongoose = require('mongoose');

const CoinConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'WATCH_VIDEO',
      'INSTAGRAM_FOLLOW',
      'INSTAGRAM_LIKE',
      'YOUTUBE_SUBSCRIBE',
      'REFERRAL_BONUS',
      'POST_UPLOAD',
      'DAILY_LOGIN',
      'POST_LIKE',
    ],
  },
  value: {
    type: Number,
    required: true,
    min: 0,
  },
  label: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CoinConfig', CoinConfigSchema);

