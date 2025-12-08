const Task = require('../models/Task');
const User = require('../models/User');

// @desc    Create new task
// @route   POST /api/admin/tasks
// @access  Private/Admin
exports.createTask = async (req, res) => {
  try {
    const { type, title, description, coins, videoUrl, videoDuration, instagramUrl, youtubeUrl, thumbnail, isActive } = req.body;

    // Validation
    if (!type || !title || !description || coins === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, description, and coins are required',
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

    // Create task
    const taskData = {
      type,
      title,
      description,
      coins: parseInt(coins),
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
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
        coins: task.coins,
        videoUrl: task.videoUrl,
        videoDuration: task.videoDuration,
        instagramUrl: task.instagramUrl,
        youtubeUrl: task.youtubeUrl,
        thumbnail: task.thumbnail,
        isActive: task.isActive,
        completedBy: [],
        completionCount: 0,
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

// @desc    Get all tasks with completion stats
// @route   GET /api/admin/tasks
// @access  Private/Admin
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });

    const tasksWithStats = await Promise.all(
      tasks.map(async (task) => {
        const completionCount = task.completedBy.length;
        const totalCoinsGiven = completionCount * task.coins;

        return {
          id: task._id.toString(),
          type: task.type,
          title: task.title,
          description: task.description,
          coins: task.coins,
          videoUrl: task.videoUrl,
          videoDuration: task.videoDuration,
          instagramUrl: task.instagramUrl,
          youtubeUrl: task.youtubeUrl,
          thumbnail: task.thumbnail,
          isActive: task.isActive,
          completionCount,
          totalCoinsGiven,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
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

// @desc    Get single task with completion details
// @route   GET /api/admin/tasks/:id
// @access  Private/Admin
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const completionCount = task.completedBy.length;
    const totalCoinsGiven = completionCount * task.coins;

    // Get user details for completions
    const completionsWithUsers = await Promise.all(
      task.completedBy.map(async (completion) => {
        const user = await User.findById(completion.user).select('name username email');
        return {
          userId: completion.user.toString(),
          userName: user ? user.name : 'Unknown',
          userUsername: user ? user.username : 'unknown',
          userEmail: user ? user.email : null,
          completedAt: completion.completedAt,
          coinsEarned: task.coins,
        };
      })
    );

    res.json({
      success: true,
      data: {
        id: task._id.toString(),
        type: task.type,
        title: task.title,
        description: task.description,
        coins: task.coins,
        videoUrl: task.videoUrl,
        videoDuration: task.videoDuration,
        instagramUrl: task.instagramUrl,
        youtubeUrl: task.youtubeUrl,
        thumbnail: task.thumbnail,
        isActive: task.isActive,
        completionCount,
        totalCoinsGiven,
        completions: completionsWithUsers,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update task
// @route   PUT /api/admin/tasks/:id
// @access  Private/Admin
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const { type, title, description, coins, videoUrl, videoDuration, instagramUrl, youtubeUrl, thumbnail, isActive } = req.body;

    // Update fields
    if (type) task.type = type;
    if (title) task.title = title;
    if (description) task.description = description;
    if (coins !== undefined) task.coins = parseInt(coins);
    if (videoUrl !== undefined) task.videoUrl = videoUrl;
    if (videoDuration !== undefined) task.videoDuration = videoDuration ? parseInt(videoDuration) : null;
    if (instagramUrl !== undefined) task.instagramUrl = instagramUrl;
    if (youtubeUrl !== undefined) task.youtubeUrl = youtubeUrl;
    if (thumbnail !== undefined) task.thumbnail = thumbnail;
    if (isActive !== undefined) task.isActive = isActive;

    await task.save();

    const completionCount = task.completedBy.length;
    const totalCoinsGiven = completionCount * task.coins;

    res.json({
      success: true,
      data: {
        id: task._id.toString(),
        type: task.type,
        title: task.title,
        description: task.description,
        coins: task.coins,
        videoUrl: task.videoUrl,
        videoDuration: task.videoDuration,
        instagramUrl: task.instagramUrl,
        youtubeUrl: task.youtubeUrl,
        thumbnail: task.thumbnail,
        isActive: task.isActive,
        completionCount,
        totalCoinsGiven,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/admin/tasks/:id
// @access  Private/Admin
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Hard delete
    await Task.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get task completions
// @route   GET /api/admin/tasks/:id/completions
// @access  Private/Admin
exports.getTaskCompletions = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('completedBy.user', 'name username email');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const completions = task.completedBy.map((completion) => {
      const user = completion.user;
      return {
        userId: user._id.toString(),
        userName: user.name,
        userUsername: user.username,
        userEmail: user.email,
        completedAt: completion.completedAt,
        coinsEarned: task.coins,
      };
    });

    res.json({
      success: true,
      data: {
        taskId: task._id.toString(),
        taskTitle: task.title,
        completionCount: completions.length,
        totalCoinsGiven: completions.length * task.coins,
        completions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

