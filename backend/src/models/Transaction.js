const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    reconciliationId: { type: String },
    direction: { type: String, enum: ['credit', 'debit'] },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['earned', 'withdrawn', 'bonus', 'referral', 'refund', 'reconciliation'],
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

transactionSchema.index({ reconciliationId: 1 }, { unique: true, partialFilterExpression: { reconciliationId: { $type: 'string' } } });

// Index for faster queries
transactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);

