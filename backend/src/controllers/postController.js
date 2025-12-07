const Post = require('../models/Post');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { COIN_VALUES } = require('../constants');

// @desc    Get feed
// @route   GET /api/posts/feed
// @access  Private
exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isActive: true })
      .populate('user', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ isActive: true });
    const hasMore = skip + posts.length < totalPosts;

    res.json({
      success: true,
      data: {
        posts: posts.map((post) => ({
          id: post._id,
          userId: post.user._id,
          userName: post.user.name,
          userAvatar: null, // Add avatar field to User model if needed
          imageUrl: post.imageUrl,
          caption: post.caption,
          likes: post.likes.length,
          comments: post.comments.length,
          isLiked: post.isLikedByUser(req.user._id),
          createdAt: post.createdAt,
        })),
        hasMore,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Upload post
// @route   POST /api/posts
// @access  Private
exports.uploadPost = async (req, res) => {
  try {
    const { caption } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an image',
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const post = await Post.create({
      user: req.user._id,
      imageUrl,
      caption: caption || '',
    });

    await post.populate('user', 'name username');

    // Add coins to user
    const user = await User.findById(req.user._id);
    user.coins += COIN_VALUES.POST_UPLOAD;
    user.totalEarned += COIN_VALUES.POST_UPLOAD;
    await user.save();

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'earned',
      amount: COIN_VALUES.POST_UPLOAD,
      description: 'Post upload reward',
    });

    res.status(201).json({
      success: true,
      data: {
        id: post._id,
        userId: post.user._id,
        userName: post.user.name,
        userAvatar: null,
        imageUrl: post.imageUrl,
        caption: post.caption,
        likes: 0,
        comments: 0,
        isLiked: false,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Like post
// @route   POST /api/posts/:id/like
// @access  Private
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    const alreadyLiked = post.isLikedByUser(req.user._id);

    if (alreadyLiked) {
      return res.status(400).json({
        success: false,
        error: 'Post already liked',
      });
    }

    post.likes.push({
      user: req.user._id,
      likedAt: new Date(),
    });

    await post.save();

    res.json({
      success: true,
      message: 'Post liked',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Unlike post
// @route   POST /api/posts/:id/unlike
// @access  Private
exports.unlikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    post.likes = post.likes.filter(
      (like) => like.user.toString() !== req.user._id.toString()
    );

    await post.save();

    res.json({
      success: true,
      message: 'Post unliked',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Private
exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('user', 'name username');

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    res.json({
      success: true,
      data: {
        id: post._id,
        userId: post.user._id,
        userName: post.user.name,
        userAvatar: null,
        imageUrl: post.imageUrl,
        caption: post.caption,
        likes: post.likes.length,
        comments: post.comments.length,
        isLiked: post.isLikedByUser(req.user._id),
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment text is required',
      });
    }

    post.comments.push({
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date(),
    });

    await post.save();
    await post.populate('comments.user', 'name username');

    const newComment = post.comments[post.comments.length - 1];

    res.json({
      success: true,
      data: {
        id: newComment._id,
        user: {
          id: newComment.user._id,
          name: newComment.user.name,
          username: newComment.user.username,
        },
        text: newComment.text,
        createdAt: newComment.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get comments for post
// @route   GET /api/posts/:id/comments
// @access  Private
exports.getComments = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('comments.user', 'name username');

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    res.json({
      success: true,
      data: post.comments.map((comment) => ({
        id: comment._id,
        user: {
          id: comment.user._id,
          name: comment.user.name,
          username: comment.user.username,
        },
        text: comment.text,
        createdAt: comment.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

