const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['earned', 'withdrawn', 'bonus', 'referral'],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    withdrawal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Withdrawal',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
transactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);

