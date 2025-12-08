const Task = require('../models/Task');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TaskSubmission = require('../models/TaskSubmission');
const { VIDEO_WATCH_PERCENTAGE } = require('../constants');
const { getCoinValue } = require('../utils/coinHelper');

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
          coins: task.coins,
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
          createdAt: task.createdAt,
        };
      })
    );

    res.json({
      success: true,
      data: tasksWithCompletion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
        coins: task.coins,
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

// @desc    Complete task
// @route   POST /api/tasks/:id/complete
// @access  Private
exports.completeTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Check if already completed
    if (task.isCompletedByUser(req.user._id)) {
      return res.status(400).json({
        success: false,
        error: 'Task already completed',
      });
    }

    // Verify task completion based on type
    if (task.type === 'watch_video') {
      const { watchDuration } = req.body;
      if (!watchDuration || task.videoDuration) {
        const percentage = (watchDuration / task.videoDuration) * 100;
        if (percentage < VIDEO_WATCH_PERCENTAGE) {
          return res.status(400).json({
            success: false,
            error: `You need to watch at least ${VIDEO_WATCH_PERCENTAGE}% of the video`,
          });
        }
      }
    }

    // Mark task as completed
    task.completedBy.push({
      user: req.user._id,
      completedAt: new Date(),
    });
    await task.save();

    // Add coins to user
    const user = await User.findById(req.user._id);
    user.coins += task.coins;
    user.totalEarned += task.coins;
    await user.save();

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'earned',
      amount: task.coins,
      description: `Completed task: ${task.title}`,
      task: task._id,
    });

    res.json({
      success: true,
      data: {
        coins: task.coins,
        message: 'Task completed successfully!',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Verify Instagram follow
// @route   POST /api/tasks/verify/instagram-follow
// @access  Private
exports.verifyInstagramFollow = async (req, res) => {
  try {
    // In a real implementation, you would verify with Instagram API
    // For now, we'll return true (assuming verification passed)
    res.json({
      success: true,
      data: {
        verified: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Verify YouTube subscribe
// @route   POST /api/tasks/verify/youtube-subscribe
// @access  Private
exports.verifyYouTubeSubscribe = async (req, res) => {
  try {
    // In a real implementation, you would verify with YouTube API
    // For now, we'll return true (assuming verification passed)
    res.json({
      success: true,
      data: {
        verified: true,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
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

    if (existingSubmission && existingSubmission.status === 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Task already approved',
      });
    }

    // If rejected, allow resubmission
    if (existingSubmission && existingSubmission.status === 'rejected') {
      existingSubmission.proofImage = req.file.path;
      existingSubmission.status = 'pending';
      existingSubmission.rejectionReason = null;
      existingSubmission.reviewedBy = null;
      existingSubmission.reviewedAt = null;
      await existingSubmission.save();

      return res.json({
        success: true,
        data: {
          message: 'Proof resubmitted successfully. Waiting for admin approval.',
          submissionStatus: 'pending',
        },
      });
    }

    // Create new submission
    const submission = await TaskSubmission.create({
      task: task._id,
      user: req.user._id,
      proofImage: req.file.path,
      status: 'pending',
    });

    res.json({
      success: true,
      data: {
        message: 'Proof submitted successfully. Waiting for admin approval.',
        submissionStatus: 'pending',
        submissionId: submission._id,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

