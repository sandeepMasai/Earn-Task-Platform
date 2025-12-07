const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      default: '',
    },
    likes: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        text: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Check if user has liked the post
postSchema.methods.isLikedByUser = function (userId) {
  return this.likes.some((like) => like.user.toString() === userId.toString());
};

// Get likes count
postSchema.virtual('likesCount').get(function () {
  return this.likes.length;
});

// Get comments count
postSchema.virtual('commentsCount').get(function () {
  return this.comments.length;
});

module.exports = mongoose.model('Post', postSchema);

