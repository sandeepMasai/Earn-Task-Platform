const Post = require('../models/Post');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { getCoinValue } = require('../utils/coinHelper');
const fs = require('fs');
const path = require('path');
const { getFileUrl, useCloudinary } = require('../middleware/upload');
const { deleteFromCloudinary } = require('../config/cloudinary');

// @desc    Get feed
// @route   GET /api/posts/feed
// @access  Private
exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ isActive: true })
      .populate('user', 'name username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments({ isActive: true });
    const hasMore = skip + posts.length < totalPosts;

    res.json({
      success: true,
      data: {
        posts: await Promise.all(
          posts.map(async (post) => {
            const postOwner = await User.findById(post.user._id).select('followers');
            // Check if current user is following the post owner
            // The post owner's followers array contains users who follow them
            // But we need to check if current user is following the post owner
            // So we check if current user's ID is in the post owner's followers array
            const isFollowing = postOwner && postOwner.followers
              ? postOwner.followers.some(
                (id) => id.toString() === req.user._id.toString()
              )
              : false;

            return {
              id: post._id.toString(),
              userId: post.user._id.toString(),
              userName: post.user.name,
              userAvatar: post.user.avatar || null,
              type: post.type,
              imageUrl: post.imageUrl,
              videoUrl: post.videoUrl,
              documentUrl: post.documentUrl,
              documentType: post.documentType,
              videoDuration: post.videoDuration,
              thumbnailUrl: post.thumbnailUrl,
              caption: post.caption,
              likes: post.likes.length,
              comments: post.comments.length,
              isLiked: post.isLikedByUser(req.user._id),
              followersCount: postOwner && postOwner.followers ? postOwner.followers.length : 0,
              isFollowing: isFollowing,
              createdAt: post.createdAt,
            };
          })
        ),
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
    const { caption, type, videoDuration } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file',
      });
    }

    // Get file URL from Cloudinary or local storage
    const fileUrl = getFileUrl(file);
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: 'Failed to process uploaded file',
      });
    }

    const postType = type || (file.mimetype.startsWith('image/') ? 'image' :
      file.mimetype.startsWith('video/') ? 'video' : 'document');

    // Validate video duration (10 seconds minimum, 2 minutes maximum = 120 seconds)
    if (postType === 'video' && videoDuration) {
      const duration = parseFloat(videoDuration);

      if (duration < 10) {
        return res.status(400).json({
          success: false,
          error: 'Video duration must be at least 10 seconds',
        });
      }

      if (duration > 120) {
        return res.status(400).json({
          success: false,
          error: 'Video duration cannot exceed 2 minutes (120 seconds). Please trim your video.',
        });
      }
    }

    const postData = {
      user: req.user._id,
      type: postType,
      caption: caption || '',
    };

    if (postType === 'image') {
      postData.imageUrl = fileUrl;
    } else if (postType === 'video') {
      postData.videoUrl = fileUrl;
      postData.videoDuration = videoDuration ? parseFloat(videoDuration) : null;
    } else if (postType === 'document') {
      postData.documentUrl = fileUrl;
      // Determine document type
      if (file.mimetype === 'application/pdf') {
        postData.documentType = 'pdf';
      } else if (file.mimetype === 'text/plain') {
        postData.documentType = 'text';
      } else if (file.mimetype.includes('word')) {
        postData.documentType = file.mimetype.includes('openxml') ? 'docx' : 'doc';
      }
    }

    const post = await Post.create(postData);
    await post.populate('user', 'name username avatar');

    // Get dynamic coin value for post upload
    const postUploadCoins = await getCoinValue('POST_UPLOAD');

    // Add coins to user
    const user = await User.findById(req.user._id);
    user.coins += postUploadCoins;
    user.totalEarned += postUploadCoins;
    await user.save();

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'earned',
      amount: postUploadCoins,
      description: 'Post upload reward',
    });

    res.status(201).json({
      success: true,
      data: {
        id: post._id,
        userId: post.user._id,
        userName: post.user.name,
        userAvatar: post.user.avatar || null,
        type: post.type,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        documentUrl: post.documentUrl,
        documentType: post.documentType,
        videoDuration: post.videoDuration,
        thumbnailUrl: post.thumbnailUrl,
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

    // Award coins to user who liked the post (if enabled)
    const postLikeCoins = await getCoinValue('POST_LIKE');
    if (postLikeCoins > 0) {
      const user = await User.findById(req.user._id);
      user.coins += postLikeCoins;
      user.totalEarned += postLikeCoins;
      await user.save();

      // Create transaction
      await Transaction.create({
        user: req.user._id,
        type: 'earned',
        amount: postLikeCoins,
        description: 'Post like reward',
      });
    }

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
    const post = await Post.findById(req.params.id).populate('user', 'name username avatar');

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
        userAvatar: post.user.avatar || null,
        type: post.type,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        documentUrl: post.documentUrl,
        documentType: post.documentType,
        videoDuration: post.videoDuration,
        thumbnailUrl: post.thumbnailUrl,
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
    const post = await Post.findById(req.params.id).populate('comments.user', 'name username avatar');

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

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption } = req.body;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this post',
      });
    }

    post.caption = caption || post.caption;
    await post.save();

    res.json({
      success: true,
      data: {
        id: post._id.toString(),
        userId: post.user.toString(),
        caption: post.caption,
        type: post.type,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        documentUrl: post.documentUrl,
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

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
      });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this post',
      });
    }

    // Delete associated files
    const filesToDelete = [
      post.imageUrl,
      post.videoUrl,
      post.documentUrl,
      post.thumbnailUrl,
    ].filter(Boolean);

    for (const fileUrl of filesToDelete) {
      if (!fileUrl) continue;

      if (useCloudinary && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
        // Delete from Cloudinary
        try {
          await deleteFromCloudinary(fileUrl);
        } catch (error) {
          console.error('Error deleting from Cloudinary:', error);
        }
      } else if (fileUrl.startsWith('/uploads/')) {
        // Delete from local storage
        const fileFullPath = path.join(__dirname, '../../', fileUrl);
        try {
          if (fs.existsSync(fileFullPath)) {
            fs.unlinkSync(fileFullPath);
          }
        } catch (fileError) {
          console.error('Error deleting local file:', fileError);
        }
      }
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

