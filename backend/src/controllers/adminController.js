const errorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const CreatorCoinRequest = require('../models/CreatorCoinRequest');
const Post = require('../models/Post');
const CoinConfig = require('../models/CoinConfig');
const WithdrawalSettings = require('../models/WithdrawalSettings');
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
    return errorResponse(res, error);
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
    return errorResponse(res, error);
  }
};

// @desc    Update payment status
// @route   PUT /api/admin/payments/:id/status
// @access  Private/Admin
exports.updatePaymentStatus = async (req, res) => {
  try {
    const withdrawal = await require('../services/withdrawals').review(req.params.id, req.body.status, req.body.rejectionReason);
    res.json({ success: true, data: { withdrawal } });
  } catch (error) { return errorResponse(res, error); }
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

    const literalSearch = search ? search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    if (search) {
      query.$or = [
        { name: { $regex: literalSearch, $options: 'i' } },
        { email: { $regex: literalSearch, $options: 'i' } },
        { username: { $regex: literalSearch, $options: 'i' } },
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
    return errorResponse(res, error);
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
    return errorResponse(res, error);
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
    return errorResponse(res, error);
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

    await require('mongoose').connection.transaction(async session => {
      const ownedTasks = await Task.find({ createdBy: id }).select('_id').session(session);
      await TaskSubmission.deleteMany({ $or: [{ user: id }, { task: { $in: ownedTasks.map(t => t._id) } }] }, { session });
      await Task.deleteMany({ createdBy: id }, { session });
      await Post.deleteMany({ user: id }, { session });
      await require('../models/Story').deleteMany({ user: id }, { session });
      await CreatorCoinRequest.deleteMany({ creator: id }, { session });
      await User.updateMany({}, { $pull: { followers: id, following: id } }, { session });
      await Withdrawal.deleteMany({ user: id }, { session });
      await Transaction.deleteMany({ user: id }, { session });
      await User.findByIdAndDelete(id, { session });
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    return errorResponse(res, error);
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
        w.user?.name || 'Deleted user',
        w.user?.email || '',
        w.user?.username || '',
        w.amount,
        w.status,
        w.paymentMethod,
        w.accountDetails,
        w.createdAt.toISOString(),
        w.processedAt ? w.processedAt.toISOString() : '',
      ].map(value => {
        let text = String(value ?? '');
        if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      }).join(',');
    });

    const csv = csvHeader + csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payments-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    return errorResponse(res, error);
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
    console.error('Error getting coin configs:');
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

    if (!CoinConfig.schema.path('key').enumValues.includes(key) || typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid coin value is required',
      });
    }

    const config = await CoinConfig.findOneAndUpdate(
      { key },
      {
        value,
        label: key.replace(/_/g, ' '),
        updatedBy: req.user.id,
        updatedAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true }
    );

    // Clear cache so new values are used immediately
    clearCoinCache();

    res.json({
      success: true,
      data: config,
      message: 'Coin configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating coin config:');
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

    if (!Array.isArray(configs) || configs.some(c => !c || !CoinConfig.schema.path('key').enumValues.includes(c.key) || typeof c.value !== 'number' || !Number.isSafeInteger(c.value) || c.value < 0)) {
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
          label: key.replace(/_/g, ' '),
          updatedBy: req.user.id,
          updatedAt: new Date(),
        },
        { new: true, upsert: true, runValidators: true }
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
    console.error('Error updating coin configs:');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update coin configurations',
    });
  }
};

// @desc    Get all pending task submissions (only admin tasks, not creator tasks)
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

    // Get all submissions
    const allSubmissions = await TaskSubmission.find(query)
      .populate('task', 'type title coins instagramUrl youtubeUrl isCreatorTask createdBy')
      .populate('user', 'name username email id')
      .sort({ createdAt: -1 });

    // Filter out creator task submissions (only show admin-created tasks)
    const submissions = allSubmissions.filter(
      (sub) => !sub.task?.isCreatorTask
    );

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
    return errorResponse(res, error);
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
    return errorResponse(res, error);
  }
};

// @desc    Approve task submission
// @route   PUT /api/admin/task-submissions/:id/approve
// @access  Private/Admin
exports.approveTaskSubmission = async (req, res) => {
  try {
    const data = await require('../services/rewards').review(req.params.id, req.user, 'approved', req.body.rejectionReason, false);
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Reject task submission
// @route   PUT /api/admin/task-submissions/:id/reject
// @access  Private/Admin
exports.rejectTaskSubmission = async (req, res) => {
  try {
    const data = await require('../services/rewards').review(req.params.id, req.user, 'rejected', req.body.rejectionReason, false);
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};


// @desc    Get all creator requests
// @route   GET /api/admin/creator-requests
// @access  Private/Admin
exports.getCreatorRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const query = { isCreator: true };
    if (status) {
      query.creatorStatus = status;
    }
    // If no status filter, show all (pending, approved, rejected)

    const creators = await User.find(query)
      .populate('creatorApprovedBy', 'name username')
      .select('name username email creatorStatus creatorYouTubeUrl creatorInstagramUrl creatorApprovedBy creatorApprovedAt createdAt')
      .sort({ createdAt: -1 });

    const formattedCreators = creators.map((creator) => ({
      id: creator._id,
      name: creator.name,
      username: creator.username,
      email: creator.email,
      status: creator.creatorStatus,
      youtubeUrl: creator.creatorYouTubeUrl,
      instagramUrl: creator.creatorInstagramUrl,
      approvedBy: creator.creatorApprovedBy
        ? {
          id: creator.creatorApprovedBy._id,
          name: creator.creatorApprovedBy.name,
          username: creator.creatorApprovedBy.username,
        }
        : null,
      approvedAt: creator.creatorApprovedAt,
      requestedAt: creator.createdAt,
    }));

    res.json({
      success: true,
      data: formattedCreators,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Approve creator request
// @route   PUT /api/admin/creator-requests/:id/approve
// @access  Private/Admin
exports.approveCreator = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.isCreator) {
      return res.status(400).json({
        success: false,
        error: 'User is not a creator',
      });
    }

    if (user.creatorStatus === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Creator already approved',
      });
    }

    user.creatorStatus = 'approved';
    user.creatorApprovedBy = req.user._id;
    user.creatorApprovedAt = new Date();
    user.role = 'creator';
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Creator approved successfully',
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Reject creator request
// @route   PUT /api/admin/creator-requests/:id/reject
// @access  Private/Admin
exports.rejectCreator = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.isCreator) {
      return res.status(400).json({
        success: false,
        error: 'User is not a creator',
      });
    }

    user.creatorStatus = 'rejected';
    user.isCreator = false;
    if (user.role === 'creator') user.role = 'user';
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Creator request rejected',
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get all creator coin requests
// @route   GET /api/admin/creator-coin-requests
// @access  Private/Admin
exports.getCreatorCoinRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    // If no status filter, show all requests (pending, approved, rejected)

    const requests = await CreatorCoinRequest.find(query)
      .populate('creator', 'name username email')
      .populate('reviewedBy', 'name username')
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map((req) => ({
      id: req._id,
      creator: {
        id: req.creator?._id,
        name: req.creator?.name,
        username: req.creator?.username,
        email: req.creator?.email,
      },
      coins: req.coins,
      amount: req.amount,
      paymentProof: req.paymentProof,
      status: req.status,
      rejectionReason: req.rejectionReason,
      reviewedBy: req.reviewedBy
        ? {
          id: req.reviewedBy._id,
          name: req.reviewedBy.name,
          username: req.reviewedBy.username,
        }
        : null,
      reviewedAt: req.reviewedAt,
      requestedAt: req.createdAt,
    }));

    res.json({
      success: true,
      data: formattedRequests,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Approve creator coin request
// @route   PUT /api/admin/creator-coin-requests/:id/approve
// @access  Private/Admin
exports.approveCreatorCoinRequest = async (req, res) => {
  try {
    const data = await require('mongoose').connection.transaction(async session => {
      const request = await CreatorCoinRequest.findById(req.params.id).session(session);
      if (!request) throw require('../utils/httpError')(404, 'Request not found');
      if (request.status !== 'pending') throw require('../utils/httpError')(400, 'Only pending requests can be reviewed');
      const creator = await User.findById(request.creator).session(session);
      if (!creator) throw require('../utils/httpError')(404, 'Creator not found');
      creator.creatorWallet += request.coins;
      await creator.save({ session });
      request.status = 'approved';
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      request.rejectionReason = null;
      await request.save({ session });
      return { message: 'Coin request approved', creatorWallet: creator.creatorWallet, reviewedAt: request.reviewedAt };
    });
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Reject creator coin request
// @route   PUT /api/admin/creator-coin-requests/:id/reject
// @access  Private/Admin
exports.rejectCreatorCoinRequest = async (req, res) => {
  try {
    const data = await require('mongoose').connection.transaction(async session => {
      const request = await CreatorCoinRequest.findById(req.params.id).session(session);
      if (!request) throw require('../utils/httpError')(404, 'Request not found');
      if (request.status !== 'pending') throw require('../utils/httpError')(400, 'Only pending requests can be reviewed');
      const creator = await User.findById(request.creator).session(session);
      if (!creator) throw require('../utils/httpError')(404, 'Creator not found');

      request.status = 'rejected';
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      request.rejectionReason = req.body.rejectionReason || 'Payment proof verification failed';
      await request.save({ session });
      return { message: 'Coin request rejected', creatorWallet: creator.creatorWallet, reviewedAt: request.reviewedAt };
    });
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Get withdrawal settings
// @route   GET /api/admin/withdrawal-settings
// @access  Private/Admin
exports.getWithdrawalSettings = async (req, res) => {
  try {
    const settings = await WithdrawalSettings.getSettings();
    res.json({
      success: true,
      data: {
        minimumWithdrawalAmount: settings.minimumWithdrawalAmount,
        withdrawalAmounts: settings.withdrawalAmounts,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Update withdrawal settings
// @route   PUT /api/admin/withdrawal-settings
// @access  Private/Admin
exports.updateWithdrawalSettings = async (req, res) => {
  try {
    const { minimumWithdrawalAmount, withdrawalAmounts } = req.body;

    if (minimumWithdrawalAmount !== undefined && (!Number.isSafeInteger(minimumWithdrawalAmount) || minimumWithdrawalAmount < 0)) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal amount must be a positive number',
      });
    }

    if (withdrawalAmounts !== undefined) {
      if (!Array.isArray(withdrawalAmounts) || withdrawalAmounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Withdrawal amounts must be a non-empty array',
        });
      }
      if (!withdrawalAmounts.every((amount) => Number.isSafeInteger(amount) && amount > 0)) {
        return res.status(400).json({
          success: false,
          error: 'All withdrawal amounts must be positive numbers',
        });
      }
    }

    let settings = await WithdrawalSettings.findOne();
    if (!settings) {
      settings = new WithdrawalSettings({
        minimumWithdrawalAmount: minimumWithdrawalAmount ?? 1000,
        withdrawalAmounts: withdrawalAmounts || [100, 500, 1000, 2000, 5000, 10000],
        updatedBy: req.user._id,
      });
    } else {
      if (minimumWithdrawalAmount !== undefined) {
        settings.minimumWithdrawalAmount = minimumWithdrawalAmount;
      }
      if (withdrawalAmounts !== undefined) {
        settings.withdrawalAmounts = withdrawalAmounts;
      }
      settings.updatedBy = req.user._id;
    }

    await settings.save();

    res.json({
      success: true,
      data: {
        minimumWithdrawalAmount: settings.minimumWithdrawalAmount,
        withdrawalAmounts: settings.withdrawalAmounts,
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy,
      },
      message: 'Withdrawal settings updated successfully',
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};
