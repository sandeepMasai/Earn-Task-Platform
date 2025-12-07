const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const Task = require('../models/Task');
const Post = require('../models/Post');

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

