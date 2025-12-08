const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
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

// @desc    Get all pending task submissions
// @route   GET /api/admin/task-submissions
// @access  Private/Admin
exports.getTaskSubmissions = async (req, res) => {
  try {
    const { status, taskType } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    } else {
      query.status = 'pending'; // Default to pending
    }

    const submissions = await TaskSubmission.find(query)
      .populate('task', 'type title coins instagramUrl youtubeUrl')
      .populate('user', 'name username email id')
      .sort({ createdAt: -1 });

    // Filter by task type if provided
    let filteredSubmissions = submissions;
    if (taskType) {
      filteredSubmissions = submissions.filter(
        (sub) => sub.task && (sub.task.type === taskType)
      );
    }

    const formattedSubmissions = filteredSubmissions.map((sub) => ({
      id: sub._id,
      task: {
        id: sub.task?._id,
        type: sub.task?.type,
        title: sub.task?.title,
        coins: sub.task?.coins,
        instagramUrl: sub.task?.instagramUrl,
        youtubeUrl: sub.task?.youtubeUrl,
      },
      user: {
        id: sub.user?._id,
        name: sub.user?.name,
        username: sub.user?.username,
        email: sub.user?.email,
      },
      proofImage: sub.proofImage,
      status: sub.status,
      rejectionReason: sub.rejectionReason,
      reviewedBy: sub.reviewedBy,
      reviewedAt: sub.reviewedAt,
      submittedAt: sub.createdAt,
    }));

    res.json({
      success: true,
      data: formattedSubmissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single task submission details
// @route   GET /api/admin/task-submissions/:id
// @access  Private/Admin
exports.getTaskSubmissionById = async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.id)
      .populate('task')
      .populate('user', 'name username email id coins')
      .populate('reviewedBy', 'name username');

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: submission._id,
        task: {
          id: submission.task?._id,
          type: submission.task?.type,
          title: submission.task?.title,
          description: submission.task?.description,
          coins: submission.task?.coins,
          instagramUrl: submission.task?.instagramUrl,
          youtubeUrl: submission.task?.youtubeUrl,
        },
        user: {
          id: submission.user?._id,
          name: submission.user?.name,
          username: submission.user?.username,
          email: submission.user?.email,
          coins: submission.user?.coins,
        },
        proofImage: submission.proofImage,
        status: submission.status,
        rejectionReason: submission.rejectionReason,
        reviewedBy: submission.reviewedBy
          ? {
              id: submission.reviewedBy._id,
              name: submission.reviewedBy.name,
              username: submission.reviewedBy.username,
            }
          : null,
        reviewedAt: submission.reviewedAt,
        submittedAt: submission.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Approve task submission
// @route   PUT /api/admin/task-submissions/:id/approve
// @access  Private/Admin
exports.approveTaskSubmission = async (req, res) => {
  try {
    const submission = await TaskSubmission.findById(req.params.id)
      .populate('task')
      .populate('user');

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    if (submission.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Submission already approved',
      });
    }

    // Update submission status
    submission.status = 'approved';
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    await submission.save();

    // Mark task as completed for user
    const task = await Task.findById(submission.task._id);
    if (!task.isCompletedByUser(submission.user._id)) {
      task.completedBy.push({
        user: submission.user._id,
        completedAt: new Date(),
      });
      await task.save();
    }

    // Add coins to user
    const user = await User.findById(submission.user._id);
    user.coins += task.coins;
    user.totalEarned += task.coins;
    await user.save();

    // Create transaction
    await Transaction.create({
      user: submission.user._id,
      type: 'earned',
      amount: task.coins,
      description: `Completed task: ${task.title}`,
      task: task._id,
    });

    res.json({
      success: true,
      data: {
        message: 'Task approved and coins credited successfully',
        coins: task.coins,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Reject task submission
// @route   PUT /api/admin/task-submissions/:id/reject
// @access  Private/Admin
exports.rejectTaskSubmission = async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    const submission = await TaskSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    if (submission.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Cannot reject an approved submission',
      });
    }

    // Update submission status
    submission.status = 'rejected';
    submission.rejectionReason = rejectionReason || 'Proof verification failed';
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    await submission.save();

    res.json({
      success: true,
      data: {
        message: 'Task submission rejected',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

