const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const Task = require('../models/Task');
const Post = require('../models/Post');
const CoinConfig = require('../models/CoinConfig');
const { COIN_VALUES } = require('../constants');
const { clearCoinCache } = require('../utils/coinHelper');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalWithdrawals,
      pendingWithdrawals,
      approvedWithdrawals,
      totalTransactions,
      totalTasks,
      totalPosts,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      Withdrawal.countDocuments(),
      Withdrawal.countDocuments({ status: 'pending' }),
      Withdrawal.countDocuments({ status: 'approved' }),
      Transaction.countDocuments(),
      Task.countDocuments(),
      Post.countDocuments(),
    ]);

    // Calculate total withdrawal amounts
    const withdrawalStats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalWithdrawalAmount = await Withdrawal.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Recent withdrawals
    const recentWithdrawals = await Withdrawal.find()
      .populate('user', 'name email username')
      .sort({ createdAt: -1 })
      .limit(10);

    // Recent users
    const recentUsers = await User.find()
      .select('name email username coins totalEarned createdAt isActive')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        stats: {
          users: {
            total: totalUsers,
            active: activeUsers,
            blocked: blockedUsers,
          },
          withdrawals: {
            total: totalWithdrawals,
            pending: pendingWithdrawals,
            approved: approvedWithdrawals,
            totalAmount: totalWithdrawalAmount[0]?.total || 0,
            byStatus: withdrawalStats,
          },
          transactions: totalTransactions,
          tasks: totalTasks,
          posts: totalPosts,
        },
        recentWithdrawals,
        recentUsers,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get all payment requests
// @route   GET /api/admin/payments
// @access  Private/Admin
exports.getAllPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'name email username coins')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Withdrawal.countDocuments(query);

    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update payment status
// @route   PUT /api/admin/payments/:id/status
// @access  Private/Admin
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: pending, approved, rejected, or completed',
      });
    }

    const withdrawal = await Withdrawal.findById(id).populate('user');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found',
      });
    }

    // If approving, deduct coins from user
    if (status === 'approved' && withdrawal.status === 'pending') {
      const user = await User.findById(withdrawal.user._id);
      if (user.coins < withdrawal.amount) {
        return res.status(400).json({
          success: false,
          error: 'User does not have enough coins',
        });
      }
      user.coins -= withdrawal.amount;
      user.totalWithdrawn += withdrawal.amount;
      await user.save();
    }

    // If rejecting after approval, refund coins
    if (status === 'rejected' && withdrawal.status === 'approved') {
      const user = await User.findById(withdrawal.user._id);
      user.coins += withdrawal.amount;
      user.totalWithdrawn -= withdrawal.amount;
      await user.save();
    }

    withdrawal.status = status;
    if (status === 'approved' || status === 'completed') {
      withdrawal.processedAt = new Date();
    }
    if (status === 'rejected' && rejectionReason) {
      withdrawal.rejectionReason = rejectionReason;
    }

    await withdrawal.save();

    res.json({
      success: true,
      data: {
        withdrawal: await Withdrawal.findById(id).populate('user', 'name email username'),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const { isActive, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get user details
// @route   GET /api/admin/users/:id
// @access  Private/Admin
exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const withdrawals = await Withdrawal.find({ user: id }).sort({ createdAt: -1 });
    const transactions = await Transaction.find({ user: id }).sort({ createdAt: -1 }).limit(50);

    res.json({
      success: true,
      data: {
        user,
        withdrawals,
        transactions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Block/Unblock user
// @route   PUT /api/admin/users/:id/block
// @access  Private/Admin
exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting admin users
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete admin users',
      });
    }

    // Delete user and related data
    await Withdrawal.deleteMany({ user: id });
    await Transaction.deleteMany({ user: id });
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Download payments as CSV
// @route   GET /api/admin/payments/download
// @access  Private/Admin
exports.downloadPayments = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'name email username')
      .sort({ createdAt: -1 });

    // Convert to CSV
    const csvHeader = 'ID,User Name,Email,Username,Amount,Status,Payment Method,Account Details,Created At,Processed At\n';
    const csvRows = withdrawals.map((w) => {
      return [
        w._id,
        w.user.name,
        w.user.email,
        w.user.username,
        w.amount,
        w.status,
        w.paymentMethod,
        w.accountDetails,
        w.createdAt.toISOString(),
        w.processedAt ? w.processedAt.toISOString() : '',
      ].join(',');
    });

    const csv = csvHeader + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payments-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get all coin configurations
// @route   GET /api/admin/coins
// @access  Private/Admin
exports.getCoinConfigs = async (req, res) => {
  try {
    let configs = await CoinConfig.find().sort({ key: 1 });

    // If no configs exist, initialize with default values
    if (configs.length === 0) {
      const defaultConfigs = [
        { key: 'WATCH_VIDEO', value: COIN_VALUES.WATCH_VIDEO, label: 'Watch Video', description: 'Coins earned for watching a video task' },
        { key: 'INSTAGRAM_FOLLOW', value: COIN_VALUES.INSTAGRAM_FOLLOW, label: 'Instagram Follow', description: 'Coins earned for following on Instagram' },
        { key: 'INSTAGRAM_LIKE', value: COIN_VALUES.INSTAGRAM_LIKE, label: 'Instagram Like', description: 'Coins earned for liking on Instagram' },
        { key: 'YOUTUBE_SUBSCRIBE', value: COIN_VALUES.YOUTUBE_SUBSCRIBE, label: 'YouTube Subscribe', description: 'Coins earned for subscribing on YouTube' },
        { key: 'REFERRAL_BONUS', value: COIN_VALUES.REFERRAL_BONUS, label: 'Referral Bonus', description: 'Coins earned for each successful referral' },
        { key: 'POST_UPLOAD', value: COIN_VALUES.POST_UPLOAD, label: 'Post Upload', description: 'Coins earned for uploading a post' },
        { key: 'DAILY_LOGIN', value: COIN_VALUES.DAILY_LOGIN, label: 'Daily Login', description: 'Coins earned for daily login bonus' },
        { key: 'POST_LIKE', value: 5, label: 'Post Like', description: 'Coins earned for liking a post' },
      ];

      configs = await CoinConfig.insertMany(defaultConfigs);
    }

    res.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('Error getting coin configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coin configurations',
    });
  }
};

// @desc    Update coin configuration
// @route   PUT /api/admin/coins/:key
// @access  Private/Admin
exports.updateCoinConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid coin value is required',
      });
    }

    const config = await CoinConfig.findOneAndUpdate(
      { key },
      {
        value,
        updatedBy: req.user.id,
        updatedAt: new Date(),
      },
      { new: true, upsert: true }
    );

    // Clear cache so new values are used immediately
    clearCoinCache();

    res.json({
      success: true,
      data: config,
      message: 'Coin configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating coin config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update coin configuration',
    });
  }
};

// @desc    Update multiple coin configurations
// @route   PUT /api/admin/coins
// @access  Private/Admin
exports.updateCoinConfigs = async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({
        success: false,
        error: 'Configs must be an array',
      });
    }

    const updatePromises = configs.map(({ key, value }) => {
      if (value < 0) {
        throw new Error(`Invalid value for ${key}`);
      }
      return CoinConfig.findOneAndUpdate(
        { key },
        {
          value,
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
        { new: true, upsert: true }
      );
    });

    const updatedConfigs = await Promise.all(updatePromises);

    // Clear cache so new values are used immediately
    clearCoinCache();

    res.json({
      success: true,
      data: updatedConfigs,
      message: 'Coin configurations updated successfully',
    });
  } catch (error) {
    console.error('Error updating coin configs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update coin configurations',
    });
  }
};

