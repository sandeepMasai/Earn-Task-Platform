const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { COIN_VALUES } = require('../constants');

// @desc    Get referral stats
// @route   GET /api/referrals/stats
// @access  Private
exports.getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Count referrals
    const referralCount = await User.countDocuments({ referredBy: user._id });
    
    // Get total referral earnings
    const referralTransactions = await Transaction.find({
      user: user._id,
      type: 'referral',
    });
    
    const totalReferralEarnings = referralTransactions.reduce(
      (sum, t) => sum + t.amount,
      0
    );

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralCount,
        totalReferralEarnings,
        referrals: await User.find({ referredBy: user._id })
          .select('username email createdAt')
          .sort({ createdAt: -1 }),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Check if referral code is valid
// @route   GET /api/referrals/check/:code
// @access  Public
exports.checkReferralCode = async (req, res) => {
  try {
    const { code } = req.params;
    const referrer = await User.findOne({ 
      referralCode: code.toUpperCase().trim() 
    });

    if (referrer) {
      res.json({
        success: true,
        data: {
          valid: true,
          referrerName: referrer.name,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          valid: false,
        },
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

