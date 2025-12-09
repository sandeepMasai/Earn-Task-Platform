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
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Request coins for creator wallet
// @route   POST /api/creator/request-coins
// @access  Private/Creator
exports.requestCoins = async (req, res) => {
  try {
    const { coins } = req.body;

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
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create task using creator wallet
// @route   POST /api/creator/tasks
// @access  Private/Creator
exports.createTask = async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      rewardPerUser,
      maxUsers,
      videoUrl,
      videoDuration,
      instagramUrl,
      youtubeUrl,
      thumbnail,
    } = req.body;

    // Fetch fresh user data to ensure we have the latest wallet balance
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

    // Validation
    if (!type || !title || !description || !rewardPerUser || !maxUsers) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, description, reward per user, and max users are required',
      });
    }

    // Parse and validate numeric values
    const rewardPerUserNum = parseInt(rewardPerUser);
    const maxUsersNum = parseInt(maxUsers);

    if (isNaN(rewardPerUserNum) || rewardPerUserNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Reward per user must be a positive number',
      });
    }

    if (isNaN(maxUsersNum) || maxUsersNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Max users must be a positive number',
      });
    }

    // Calculate total cost
    const totalCost = rewardPerUserNum * maxUsersNum;

    // Ensure creatorWallet is a number (handle undefined/null)
    const currentWallet = user.creatorWallet || 0;

    // Check if creator has enough coins
    if (currentWallet < totalCost) {
      return res.status(400).json({
        success: false,
        error: `Insufficient balance. You need ${totalCost} coins but have ${currentWallet} coins.`,
      });
    }

    // Validate task type
    const validTypes = ['watch_video', 'instagram_follow', 'instagram_like', 'youtube_subscribe', 'upload_post'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task type',
      });
    }

    // Validate type-specific fields
    if (type === 'watch_video' && !videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Video URL is required for watch_video tasks',
      });
    }

    if ((type === 'instagram_follow' || type === 'instagram_like') && !instagramUrl) {
      return res.status(400).json({
        success: false,
        error: 'Instagram URL is required for Instagram tasks',
      });
    }

    if (type === 'youtube_subscribe' && !youtubeUrl) {
      return res.status(400).json({
        success: false,
        error: 'YouTube URL is required for YouTube subscribe tasks',
      });
    }

    // Deduct coins from creator wallet
    user.creatorWallet = currentWallet - totalCost;
    await user.save();

    // Create task
    const taskData = {
      type,
      title,
      description,
      coins: rewardPerUserNum, // Store reward per user
      isActive: true,
      createdBy: req.user._id,
      isCreatorTask: true,
      rewardPerUser: rewardPerUserNum,
      maxUsers: maxUsersNum,
      totalBudget: totalCost,
      coinsUsed: 0,
    };

    if (videoUrl) taskData.videoUrl = videoUrl;
    if (videoDuration) taskData.videoDuration = parseInt(videoDuration);
    if (instagramUrl) taskData.instagramUrl = instagramUrl;
    if (youtubeUrl) taskData.youtubeUrl = youtubeUrl;
    if (thumbnail) taskData.thumbnail = thumbnail;

    const task = await Task.create(taskData);

    res.status(201).json({
      success: true,
      data: {
        id: task._id,
        type: task.type,
        title: task.title,
        description: task.description,
        rewardPerUser: task.rewardPerUser,
        maxUsers: task.maxUsers,
        totalBudget: task.totalBudget,
        coinsUsed: task.coinsUsed,
        videoUrl: task.videoUrl,
        videoDuration: task.videoDuration,
        instagramUrl: task.instagramUrl,
        youtubeUrl: task.youtubeUrl,
        thumbnail: task.thumbnail,
        isActive: task.isActive,
        creatorWallet: user.creatorWallet,
        createdAt: task.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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
          completions: completions,
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update creator task
// @route   PUT /api/creator/tasks/:id
// @access  Private/Creator
exports.updateCreatorTask = async (req, res) => {
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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if task belongs to this creator
    if (task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own tasks',
      });
    }

    // Update allowed fields
    const {
      type,
      title,
      description,
      rewardPerUser,
      maxUsers,
      videoUrl,
      videoDuration,
      instagramUrl,
      youtubeUrl,
      thumbnail,
    } = req.body;

    if (type) task.type = type;
    if (title) task.title = title;
    if (description) task.description = description;
    if (videoUrl !== undefined) task.videoUrl = videoUrl;
    if (videoDuration !== undefined) task.videoDuration = videoDuration;
    if (instagramUrl !== undefined) task.instagramUrl = instagramUrl;
    if (youtubeUrl !== undefined) task.youtubeUrl = youtubeUrl;
    if (thumbnail !== undefined) task.thumbnail = thumbnail;

    // If rewardPerUser or maxUsers changed, recalculate budget
    if (rewardPerUser !== undefined || maxUsers !== undefined) {
      const newRewardPerUser = rewardPerUser !== undefined ? parseInt(rewardPerUser) : task.rewardPerUser;
      const newMaxUsers = maxUsers !== undefined ? parseInt(maxUsers) : task.maxUsers;

      if (isNaN(newRewardPerUser) || newRewardPerUser <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Reward per user must be a positive number',
        });
      }

      if (isNaN(newMaxUsers) || newMaxUsers <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Max users must be a positive number',
        });
      }

      task.rewardPerUser = newRewardPerUser;
      task.maxUsers = newMaxUsers;
      task.totalBudget = newRewardPerUser * newMaxUsers;

      // Check if new budget is less than coins already used
      if (task.coinsUsed > task.totalBudget) {
        return res.status(400).json({
          success: false,
          error: `Cannot reduce budget below coins already used (${task.coinsUsed} coins)`,
        });
      }
    }

    await task.save();

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: {
        task: task,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete creator task
// @route   DELETE /api/creator/tasks/:id
// @access  Private/Creator
exports.deleteCreatorTask = async (req, res) => {
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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if task belongs to this creator
    if (task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own tasks',
      });
    }

    // Calculate refund (unused coins)
    const refundedCoins = (task.totalBudget || 0) - (task.coinsUsed || 0);

    // Refund unused coins to creator wallet
    if (refundedCoins > 0) {
      user.creatorWallet = (user.creatorWallet || 0) + refundedCoins;
      await user.save();
    }

    // Delete task submissions related to this task
    await TaskSubmission.deleteMany({ task: task._id });

    // Delete the task
    await Task.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Task deleted successfully',
      data: {
        refundedCoins: refundedCoins > 0 ? refundedCoins : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Approve task submission (creator reviews their own tasks)
// @route   PUT /api/creator/task-submissions/:id/approve
// @access  Private/Creator
exports.approveTaskSubmission = async (req, res) => {
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
      .populate('user');

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    // Verify this submission is for a task created by this creator
    const task = await Task.findById(submission.task._id);
    if (!task.isCreatorTask || task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to approve this submission',
      });
    }

    if (submission.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Submission already approved',
      });
    }

    // Check if task is still active and has budget
    if (!task.isActive) {
      return res.status(400).json({
        success: false,
        error: 'This task is no longer active. Budget has been exhausted.',
      });
    }

    const rewardAmount = task.rewardPerUser || task.coins;
    const remainingBudget = task.totalBudget - (task.coinsUsed || 0);
    if (remainingBudget < rewardAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient budget to approve this submission',
      });
    }

    // Update submission status
    submission.status = 'approved';
    submission.reviewedBy = req.user._id;
    submission.reviewedAt = new Date();
    await submission.save();

    // Mark task as completed for user
    if (!task.isCompletedByUser(submission.user._id)) {
      task.completedBy.push({
        user: submission.user._id,
        completedAt: new Date(),
      });

      // Update coins used
      task.coinsUsed = (task.coinsUsed || 0) + rewardAmount;

      // Check if budget is exhausted or max users reached
      if (task.coinsUsed >= task.totalBudget || task.completedBy.length >= task.maxUsers) {
        task.isActive = false;
      }

      await task.save();
    }

    // Add coins to user
    const userToReward = await User.findById(submission.user._id);
    userToReward.coins += rewardAmount;
    userToReward.totalEarned += rewardAmount;
    await userToReward.save();

    // Create transaction
    await Transaction.create({
      user: submission.user._id,
      type: 'earned',
      amount: rewardAmount,
      description: `Completed task: ${task.title}`,
      task: task._id,
    });

    res.json({
      success: true,
      data: {
        message: 'Task approved and coins credited successfully',
        coins: rewardAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Reject task submission (creator reviews their own tasks)
// @route   PUT /api/creator/task-submissions/:id/reject
// @access  Private/Creator
exports.rejectTaskSubmission = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.isCreator || user.creatorStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'You are not an approved creator',
      });
    }

    const { rejectionReason } = req.body;

    const submission = await TaskSubmission.findById(req.params.id).populate('task');

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found',
      });
    }

    // Verify this submission is for a task created by this creator
    const task = await Task.findById(submission.task._id);
    if (!task.isCreatorTask || task.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to reject this submission',
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
