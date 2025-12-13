const mongoose = require('mongoose');

const withdrawalSettingsSchema = new mongoose.Schema(
  {
    minimumWithdrawalAmount: {
      type: Number,
      required: true,
      default: 1000,
      min: 0,
    },
    withdrawalAmounts: {
      type: [Number],
      required: true,
      default: [100, 500, 1000, 2000, 5000, 10000],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0 && v.every((amount) => amount > 0);
        },
        message: 'Withdrawal amounts must be a non-empty array of positive numbers',
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one document exists
withdrawalSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      minimumWithdrawalAmount: 1000,
      withdrawalAmounts: [100, 500, 1000, 2000, 5000, 10000],
    });
  }
  return settings;
};

module.exports = mongoose.model('WithdrawalSettings', withdrawalSettingsSchema);
