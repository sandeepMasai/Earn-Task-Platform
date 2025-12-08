const mongoose = require('mongoose');

const creatorCoinRequestSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
    coins: {
      type: Number,
      required: [true, 'Coins amount is required'],
      min: 1000, // Minimum 1000 coins
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      // 1000 coins = 10 rupees, so amount = coins / 100
    },
    paymentProof: {
      type: String,
      required: [true, 'Payment proof is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('CreatorCoinRequest', creatorCoinRequestSchema);

