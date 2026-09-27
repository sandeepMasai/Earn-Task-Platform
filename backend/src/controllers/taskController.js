const errorResponse = require('../utils/errorResponse');
const Task = require('../models/Task');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TaskSubmission = require('../models/TaskSubmission');
const { VIDEO_WATCH_PERCENTAGE } = require('../constants');
const { getCoinValue } = require('../utils/coinHelper');
const { getFileUrl } = require('../middleware/upload');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ isActive: true }).sort({ createdAt: -1 });

    const tasksWithCompletion = await Promise.all(
      tasks.map(async (task) => {
        const isCompleted = task.isCompletedByUser(req.user._id);

        // For Instagram and YouTube tasks, check submission status
        let submissionStatus = null;
        if (task.type === 'instagram_follow' || task.type === 'instagram_like' || task.type === 'youtube_subscribe') {
          const submission = await TaskSubmission.findOne({
            task: task._id,
            user: req.user._id,
          });
          if (submission) {
            submissionStatus = submission.status; // 'pending', 'approved', 'rejected'
          } else {
            submissionStatus = 'available'; // Not submitted yet
          }
        }

        return {
          id: task._id,
          type: task.type,
          title: task.title,
          description: task.description,
          coins: task.coins || task.rewardPerUser || 0, // Use rewardPerUser for creator tasks
          videoUrl: task.videoUrl,
          videoDuration: task.videoDuration,
          instagramUrl: task.instagramUrl,
          youtubeUrl: task.youtubeUrl,
          thumbnail: task.thumbnail,
          isCompleted,
          completedAt: isCompleted
            ? task.completedBy.find((c) => c.user.toString() === req.user._id.toString())
              ?.completedAt
            : null,
          submissionStatus, // For Instagram tasks: 'available', 'pending', 'approved', 'rejected'
          // Creator task fields
          isCreatorTask: task.isCreatorTask || false,
          rewardPerUser: task.rewardPerUser,
          maxUsers: task.maxUsers,
          totalBudget: task.totalBudget,
          coinsUsed: task.coinsUsed,
          createdAt: task.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithCompletion,
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const isCompleted = task.isCompletedByUser(req.user._id);

    // For Instagram and YouTube tasks, check submission status
    let submissionStatus = null;
    let submission = null;
    if (task.type === 'instagram_follow' || task.type === 'instagram_like' || task.type === 'youtube_subscribe') {
      submission = await TaskSubmission.findOne({
        task: task._id,
        user: req.user._id,
      });
      if (submission) {
        submissionStatus = submission.status;
      } else {
        submissionStatus = 'available';
      }
    }

    res.json({
      success: true,
      data: {
        id: task._id,
        type: task.type,
        title: task.title,
        description: task.description,
        coins: task.coins || task.rewardPerUser || 0, // Use rewardPerUser for creator tasks
        videoUrl: task.videoUrl,
        videoDuration: task.videoDuration,
        instagramUrl: task.instagramUrl,
        youtubeUrl: task.youtubeUrl,
        thumbnail: task.thumbnail,
        isCompleted,
        completedAt: isCompleted
          ? task.completedBy.find((c) => c.user.toString() === req.user._id.toString())
            ?.completedAt
          : null,
        submissionStatus,
        rejectionReason: submission?.rejectionReason || null,
        // Creator task fields
        isCreatorTask: task.isCreatorTask || false,
        rewardPerUser: task.rewardPerUser,
        maxUsers: task.maxUsers,
        totalBudget: task.totalBudget,
        coinsUsed: task.coinsUsed,
        createdAt: task.createdAt,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

// @desc    Complete task
// @route   POST /api/tasks/:id/complete
// @access  Private
exports.completeTask = async (req, res) => {
  try {
    const coins = await require('../services/rewards').complete(req.params.id, req.user._id, req.body.sessionId);
    res.json({ success: true, data: { coins, message: 'Task completed successfully!' } });
  } catch (error) { return errorResponse(res, error); }
};

// @desc    Verify Instagram follow
// @route   POST /api/tasks/verify/instagram-follow
// @access  Private
exports.verifyInstagramFollow = async (req, res) => {
  const data = await require('../services/social').verify('instagram', 'instagram_follow');
  res.json({ success: true, data });
};

// @desc    Verify YouTube subscribe
// @route   POST /api/tasks/verify/youtube-subscribe
// @access  Private
exports.verifyYouTubeSubscribe = async (req, res) => {
  const data = await require('../services/social').verify('youtube', 'youtube_subscribe');
  res.json({ success: true, data });
};

// @desc    Submit task proof (for Instagram tasks)
// @route   POST /api/tasks/:id/submit-proof
// @access  Private
exports.submitTaskProof = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Only Instagram and YouTube tasks require proof
    if (task.type !== 'instagram_follow' && task.type !== 'instagram_like' && task.type !== 'youtube_subscribe') {
      return res.status(400).json({
        success: false,
        error: 'This task does not require proof submission',
      });
    }

    if (!task.isActive || task.isCompletedByUser(req.user._id)) return res.status(400).json({ success: false, error: 'Task is inactive or already completed' });

    // Check if proof image is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Proof screenshot is required',
      });
    }

    // Check if already submitted
    const existingSubmission = await TaskSubmission.findOne({
      task: task._id,
      user: req.user._id,
    });

    if (existingSubmission && existingSubmission.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Task already submitted or approved',
      });
    }

    // Get file URL from Cloudinary or local storage
    const proofImageUrl = getFileUrl(req.file);
    if (!proofImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process proof image',
      });
    }

    // If rejected, allow resubmission
    if (existingSubmission && existingSubmission.status === 'rejected') {
      existingSubmission.proofImage = proofImageUrl;
      existingSubmission.proofAsset = req.file.asset || null;
      existingSubmission.status = 'pending';
      existingSubmission.rejectionReason = null;
      existingSubmission.reviewedBy = null;
      existingSubmission.reviewedAt = null;
      await existingSubmission.save();

      const reviewer = task.isCreatorTask ? 'creator' : 'admin';
      return res.json({
        success: true,
        data: {
          message: `Proof resubmitted successfully. Waiting for ${reviewer} approval.`,
          submissionStatus: 'pending',
        },
      });
    }

    // Create new submission
    const submission = await TaskSubmission.create({
      task: task._id,
      user: req.user._id,
      proofImage: proofImageUrl,
      proofAsset: req.file.asset || null,
      status: 'pending',
    });

    const reviewer = task.isCreatorTask ? 'creator' : 'admin';
    res.json({
      success: true,
      data: {
        message: `Proof submitted successfully. Waiting for ${reviewer} approval.`,
        submissionStatus: 'pending',
        submissionId: submission._id,
      },
    });
  } catch (error) {
    return errorResponse(res, error);
  }
};

