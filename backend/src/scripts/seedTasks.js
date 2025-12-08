const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Task = require('../models/Task');
const { getAllCoinValues } = require('../utils/coinHelper');

dotenv.config();

const seedTasks = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/earn-task-platform');
    console.log('✅ Connected to MongoDB');

    // Get dynamic coin values
    const coinValues = await getAllCoinValues();

    const tasks = [
      {
        type: 'watch_video',
        title: 'Watch Product Demo Video',
        description: 'Watch this 2-minute product demo video to earn coins',
        coins: coinValues.WATCH_VIDEO || 10,
        videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        videoDuration: 120,
        thumbnail: 'https://via.placeholder.com/400x300',
      },
      {
        type: 'instagram_follow',
        title: 'Follow Our Instagram',
        description: 'Follow our Instagram account @earntaskplatform',
        coins: coinValues.INSTAGRAM_FOLLOW || 50,
        instagramUrl: 'https://instagram.com/earntaskplatform',
        thumbnail: 'https://via.placeholder.com/400x300',
      },
      {
        type: 'instagram_like',
        title: 'Like Our Latest Post',
        description: 'Like our latest Instagram post to earn coins',
        coins: coinValues.INSTAGRAM_LIKE || 20,
        instagramUrl: 'https://instagram.com/earntaskplatform',
        thumbnail: 'https://via.placeholder.com/400x300',
      },
      {
        type: 'youtube_subscribe',
        title: 'Subscribe to Our YouTube Channel',
        description: 'Subscribe to our YouTube channel for exclusive content',
        coins: coinValues.YOUTUBE_SUBSCRIBE || 100,
        youtubeUrl: 'https://youtube.com/@earntaskplatform',
        thumbnail: 'https://via.placeholder.com/400x300',
      },
      {
        type: 'watch_video',
        title: 'Learn About Earning Rewards',
        description: 'Watch this tutorial video about how to earn more coins',
        coins: coinValues.WATCH_VIDEO || 10,
        videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        videoDuration: 180,
        thumbnail: 'https://via.placeholder.com/400x300',
      },
    ];

    // Clear existing tasks
    await Task.deleteMany({});
    console.log('✅ Cleared existing tasks');

    // Insert new tasks
    await Task.insertMany(tasks);
    console.log('✅ Seeded tasks successfully with dynamic coin values');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding tasks:', error);
    process.exit(1);
  }
};

seedTasks();

