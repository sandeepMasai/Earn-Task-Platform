const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Task type is required'],
      enum: ['watch_video', 'instagram_follow', 'instagram_like', 'youtube_subscribe', 'upload_post'],
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
    },
    coins: {
      type: Number,
      required: [true, 'Coins reward is required'],
      min: 0,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    videoDuration: {
      type: Number,
      default: null,
    },
    instagramUrl: {
      type: String,
      default: null,
    },
    youtubeUrl: {
      type: String,
      default: null,
    },
    thumbnail: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    completedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        completedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Check if user has completed this task
taskSchema.methods.isCompletedByUser = function (userId) {
  return this.completedBy.some(
    (completion) => completion.user.toString() === userId.toString()
  );
};

module.exports = mongoose.model('Task', taskSchema);

