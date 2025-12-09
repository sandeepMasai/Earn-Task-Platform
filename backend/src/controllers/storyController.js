const Story = require('../models/Story');
const User = require('../models/User');
const { getFileUrl } = require('../middleware/upload');

// @desc    Get active stories
// @route   GET /api/stories
// @access  Private
exports.getStories = async (req, res) => {
  try {
    const stories = await Story.find({
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate('user', 'name username')
      .sort({ createdAt: -1 });

    // Group stories by user
    const storiesByUser = {};
    stories.forEach((story) => {
      const userId = story.user._id.toString();
      if (!storiesByUser[userId]) {
        storiesByUser[userId] = {
          user: {
            id: story.user._id,
            name: story.user.name,
            username: story.user.username,
          },
          stories: [],
        };
      }
      storiesByUser[userId].stories.push({
        id: story._id,
        type: story.type,
        mediaUrl: story.mediaUrl,
        videoDuration: story.videoDuration,
        thumbnailUrl: story.thumbnailUrl,
        views: story.views.length,
        hasViewed: story.views.some((v) => v.user.toString() === req.user._id.toString()),
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      });
    });

    res.json({
      success: true,
      data: Object.values(storiesByUser),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Upload story
// @route   POST /api/stories
// @access  Private
exports.uploadStory = async (req, res) => {
  try {
    const { type, videoDuration } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file',
      });
    }

    // Validate video duration (max 2 minutes = 120 seconds)
    if (type === 'video' && videoDuration) {
      const duration = parseFloat(videoDuration);
      if (duration > 120) {
        return res.status(400).json({
          success: false,
          error: 'Story video duration cannot exceed 2 minutes (120 seconds)',
        });
      }
    }

    // Get file URL from Cloudinary or local storage
    const mediaUrl = getFileUrl(file);
    if (!mediaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process uploaded media',
      });
    }

    const story = await Story.create({
      user: req.user._id,
      type: type || (file.mimetype.startsWith('image/') ? 'image' : 'video'),
      mediaUrl,
      videoDuration: videoDuration ? parseFloat(videoDuration) : null,
    });

    await story.populate('user', 'name username');

    res.status(201).json({
      success: true,
      data: {
        id: story._id,
        userId: story.user._id,
        userName: story.user.name,
        type: story.type,
        mediaUrl: story.mediaUrl,
        videoDuration: story.videoDuration,
        thumbnailUrl: story.thumbnailUrl,
        views: 0,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    View story
// @route   POST /api/stories/:id/view
// @access  Private
exports.viewStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);

    if (!story) {
      return res.status(404).json({
        success: false,
        error: 'Story not found',
      });
    }

    // Check if already viewed
    const alreadyViewed = story.views.some(
      (v) => v.user.toString() === req.user._id.toString()
    );

    if (!alreadyViewed) {
      story.views.push({
        user: req.user._id,
        viewedAt: new Date(),
      });
      await story.save();
    }

    res.json({
      success: true,
      message: 'Story viewed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

