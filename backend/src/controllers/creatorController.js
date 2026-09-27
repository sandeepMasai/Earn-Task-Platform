const errorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Task = require('../models/Task');
const CreatorCoinRequest = require('../models/CreatorCoinRequest');
const TaskSubmission = require('../models/TaskSubmission');
const Transaction = require('../models/Transaction');
const { getFileUrl } = require('../middleware/upload');

// @desc    Register as creator
// @route   POST /api/creator/register
// @access  Private
exports.registerAsCreator = async (req, res) => {
  try {
    const { youtubeUrl, instagramUrl } = req.body;

    if (!youtubeUrl && !instagramUrl) {
      return res.status(400).json({
        success: false,
        error: 'At least one URL (YouTube or Instagram) is required',
      });
    }

    const user = await User.findById(req.user._id);

    if (user.isCreator && user.creatorStatus === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'You are already an approved creator',
      });
    }

    if (user.creatorStatus === 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Your creator request is already pending approval',
      });
    }

    // Update user as creator
    user.isCreator = true;
    user.creatorStatus = 'pending';
    user.creatorYouTubeUrl = youtubeUrl || null;
    user.creatorInstagramUrl = instagramUrl || null;
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Creator registration submitted. Waiting for admin approval.',
        creatorStatus: 'pending',
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get creator dashboard stats
// @route   GET /api/creator/dashboard
// @access  Private/Creator
exports.getCreatorDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

    // Get all tasks created by this creator
    const tasks = await Task.find({ createdBy: req.user._id });

    // Calculate stats
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter((t) => t.isActive).length;
    const totalCompletions = tasks.reduce((sum, task) => sum + task.completedBy.length, 0);
    const totalCoinsSpent = tasks.reduce((sum, task) => sum + (task.coinsUsed || 0), 0);

    // Get unique users who completed tasks
    const uniqueUsers = new Set();
    tasks.forEach((task) => {
      task.completedBy.forEach((completion) => {
        uniqueUsers.add(completion.user.toString());
      });
    });

    // Get YouTube subscribers count (from YouTube subscribe tasks)
    const youtubeTasks = tasks.filter((t) => t.type === 'youtube_subscribe');
    const youtubeSubscribers = youtubeTasks.reduce(
      (sum, task) => sum + task.completedBy.length,
      0
    );

    // Get total watch time (from watch_video tasks)
    const videoTasks = tasks.filter((t) => t.type === 'watch_video');
    const totalWatchTime = videoTasks.reduce((sum, task) => {
      const watchTime = task.videoDuration * task.completedBy.length;
      return sum + (watchTime || 0);
    }, 0);

    // Get recent completions with user details
    const recentCompletions = await Task.aggregate([
      { $match: { createdBy: req.user._id } },
      { $unwind: '$completedBy' },
      { $sort: { 'completedBy.completedAt': -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: 'completedBy.user',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      {
        $project: {
          taskTitle: '$title',
          taskType: '$type',
          userName: { $arrayElemAt: ['$userDetails.name', 0] },
          userUsername: { $arrayElemAt: ['$userDetails.username', 0] },
          completedAt: '$completedBy.completedAt',
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        creatorWallet: user.creatorWallet,
        stats: {
          totalTasks,
          activeTasks,
          totalCompletions,
          totalCoinsSpent,
          uniqueUsers: uniqueUsers.size,
          youtubeSubscribers,
          totalWatchTime, // in seconds
        },
        links: {
          youtubeUrl: user.creatorYouTubeUrl,
          instagramUrl: user.creatorInstagramUrl,
        },
        recentCompletions,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Request coins for creator wallet
// @route   POST /api/creator/request-coins
// @access  Private/Creator
exports.requestCoins = async (req, res) => {
  try {
    const coins = Number(req.body.coins);
    if (!Number.isSafeInteger(coins)) return res.status(400).json({ success: false, error: 'Coins must be a whole number' });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Payment proof screenshot is required',
      });
    }

    const MIN_COINS = 1000;
    const MAX_COINS = 100000;

    if (!coins || coins < MIN_COINS) {
      return res.status(400).json({
        success: false,
        error: `Minimum ${MIN_COINS} coins required`,
      });
    }

    if (coins > MAX_COINS) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_COINS} coins allowed`,
      });
    }

    const user = await User.findById(req.user._id);

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

    // Calculate amount (1000 coins = 10 rupees)
    const amount = (coins / 100).toFixed(2);

    // Get file URL from Cloudinary or local storage
    const paymentProofUrl = getFileUrl(req.file);
    if (!paymentProofUrl) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process payment proof image',
      });
    }

    // Create coin request
    const coinRequest = await CreatorCoinRequest.create({
      creator: req.user._id,
      coins,
      amount,
      paymentProof: paymentProofUrl,
      proofAsset: req.file.asset || null,
      status: 'pending',
    });

    res.json({
      success: true,
      data: {
        message: 'Coin request submitted. Waiting for admin approval.',
        requestId: coinRequest._id,
        coins,
        amount,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get creator coin requests
// @route   GET /api/creator/coin-requests
// @access  Private/Creator
exports.getCoinRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

    const requests = await CreatorCoinRequest.find({ creator: req.user._id })
      .populate('reviewedBy', 'name username')
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map((req) => ({
      id: req._id,
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

// @desc    Create task using creator wallet
// @route   POST /api/creator/tasks
// @access  Private/Creator
exports.createTask = async (req, res) => {
  try {
    const { task, creatorWallet } = await require('../services/creatorTasks').save(req.user._id, null, req.body);
    res.status(201).json({ success: true, data: { ...task.toObject(), id: task._id, creatorWallet } });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Get all tasks created by the creator
// @route   GET /api/creator/tasks
// @access  Private/Creator
exports.getCreatorTasks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

    // Get all tasks created by this creator
    const tasks = await Task.find({ createdBy: req.user._id, isCreatorTask: true })
      .sort({ createdAt: -1 }); // Newest first

    // Calculate completions for each task
    const tasksWithStats = await Promise.all(
      tasks.map(async (task) => {
        const completions = await TaskSubmission.countDocuments({
          task: task._id,
          status: 'approved',
        });

        return {
          id: task._id,
          _id: task._id,
          type: task.type,
          title: task.title,
          description: task.description,
          coins: task.rewardPerUser || task.coins || 0, // For compatibility
          rewardPerUser: task.rewardPerUser,
          maxUsers: task.maxUsers,
          coinsUsed: task.coinsUsed || 0,
          totalBudget: task.totalBudget,
          videoUrl: task.videoUrl,
          videoDuration: task.videoDuration,
          instagramUrl: task.instagramUrl,
          youtubeUrl: task.youtubeUrl,
          thumbnail: task.thumbnail,
          createdAt: task.createdAt,
          isActive: task.isActive,
          completions: task.completedBy.length,
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithStats,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Update creator task
// @route   PUT /api/creator/tasks/:id
// @access  Private/Creator
exports.updateCreatorTask = async (req, res) => {
  try {
    const data = await require('../services/creatorTasks').save(req.user._id, req.params.id, req.body);
    res.json({ success: true, data, message: 'Task updated successfully' });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Delete creator task
// @route   DELETE /api/creator/tasks/:id
// @access  Private/Creator
exports.deleteCreatorTask = async (req, res) => {
  try {
    const data = await require('../services/creatorTasks').remove(req.user._id, req.params.id);
    res.json({ success: true, data, message: 'Task deleted successfully' });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Get creator request history
// @route   GET /api/creator/request-history
// @access  Private
exports.getCreatorRequestHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('creatorApprovedBy', 'name username');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        isCreator: user.isCreator,
        creatorStatus: user.creatorStatus,
        creatorApprovedBy: user.creatorApprovedBy
          ? {
            id: user.creatorApprovedBy._id,
            name: user.creatorApprovedBy.name,
            username: user.creatorApprovedBy.username,
          }
          : null,
        creatorApprovedAt: user.creatorApprovedAt,
        creatorYouTubeUrl: user.creatorYouTubeUrl,
        creatorInstagramUrl: user.creatorInstagramUrl,
        requestedAt: user.createdAt, // When user first registered (approximation)
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get task submissions for creator's tasks
// @route   GET /api/creator/task-submissions
// @access  Private/Creator
exports.getTaskSubmissions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

    const { status, taskId } = req.query;

    // Get all tasks created by this creator
    const tasksQuery = { createdBy: req.user._id, isCreatorTask: true };
    if (taskId) {
      tasksQuery._id = taskId;
    }
    const creatorTasks = await Task.find(tasksQuery).select('_id');
    const taskIds = creatorTasks.map(t => t._id);

    if (taskIds.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const query = { task: { $in: taskIds } };
    if (status) {
      query.status = status;
    } else {
      query.status = 'pending'; // Default to pending
    }

    const submissions = await TaskSubmission.find(query)
      .populate('task', 'type title coins rewardPerUser instagramUrl youtubeUrl')
      .populate('user', 'name username email id')
      .sort({ createdAt: -1 });

    const formattedSubmissions = submissions.map((sub) => ({
      id: sub._id,
      task: {
        id: sub.task?._id,
        type: sub.task?.type,
        title: sub.task?.title,
        coins: sub.task?.coins || sub.task?.rewardPerUser || 0,
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

// @desc    Get single task submission details for creator
// @route   GET /api/creator/task-submissions/:id
// @access  Private/Creator
exports.getTaskSubmissionById = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

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

    // Verify this submission is for a task created by this creator
    if (!submission.task) return res.status(404).json({ success: false, error: 'Task not found' });
    const task = await Task.findById(submission.task._id);
    if (!task.isCreatorTask || task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this submission',
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
          coins: submission.task?.coins || submission.task?.rewardPerUser || 0,
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

// @desc    Approve task submission (creator reviews their own tasks)
// @route   PUT /api/creator/task-submissions/:id/approve
// @access  Private/Creator
exports.approveTaskSubmission = async (req, res) => {
  try {
    const data = await require('../services/rewards').review(req.params.id, req.user, 'approved', req.body.rejectionReason, true);
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Reject task submission (creator reviews their own tasks)
// @route   PUT /api/creator/task-submissions/:id/reject
// @access  Private/Creator
exports.rejectTaskSubmission = async (req, res) => {
  try {
    const data = await require('../services/rewards').review(req.params.id, req.user, 'rejected', req.body.rejectionReason, true);
    res.json({ success: true, data });
  } catch (error) { return errorResponse(res, error); }
};
