const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const generateReferralCode = require('../utils/generateReferralCode');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    instagramId: {
      type: String,
      default: null,
    },
    avatar: {
      type: String,
      default: null,
    },
    coins: {
      type: Number,
      default: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    referralCode: {
      type: String,
      unique: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'creator'],
      default: 'user',
    },
    // Creator fields
    isCreator: {
      type: Boolean,
      default: false,
    },
    creatorStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: null,
    },
    creatorApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creatorApprovedAt: {
      type: Date,
      default: null,
    },
    creatorWallet: {
      type: Number,
      default: 0,
    },
    // Creator links
    creatorYouTubeUrl: {
      type: String,
      default: null,
    },
    creatorInstagramUrl: {
      type: String,
      default: null,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Generate referral code before saving
userSchema.pre('save', async function (next) {
  if (!this.referralCode) {
    let code;
    do {
      code = generateReferralCode(this._id.toString());
    } while (await mongoose.model('User').findOne({ referralCode: code }));
    this.referralCode = code;
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

