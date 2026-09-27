const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const fail = require('../utils/httpError');

function validate(task) {
  if (!Number.isSafeInteger(task.rewardPerUser) || task.rewardPerUser <= 0 || !Number.isSafeInteger(task.maxUsers) || task.maxUsers <= 0 || !Number.isSafeInteger(task.rewardPerUser * task.maxUsers)) throw fail(400, 'Reward and maximum users must be positive whole numbers');
  if (task.maxUsers < task.completedBy.length) throw fail(400, 'Maximum users cannot be less than completed users');
  if (task.type === 'watch_video' && (!task.videoUrl || !Number.isFinite(task.videoDuration) || task.videoDuration <= 0)) throw fail(400, 'Video URL and positive duration are required');
  if (['instagram_follow', 'instagram_like'].includes(task.type) && !task.instagramUrl) throw fail(400, 'Instagram URL required');
  if (task.type === 'youtube_subscribe' && !task.youtubeUrl) throw fail(400, 'YouTube URL required');
}

exports.save = (userId, id, body) => mongoose.connection.transaction(async session => {
  const creator = await User.findById(userId).session(session);
  if (!creator?.isCreator || creator.creatorStatus !== 'approved') throw fail(403, 'You are not an approved creator');
  const task = id ? await Task.findById(id).session(session) : new Task({ isCreatorTask: true, createdBy: userId, coinsUsed: 0 });
  if (!task) throw fail(404, 'Task not found');
  if (!task.isCreatorTask || !task.createdBy?.equals(userId)) throw fail(403, 'You can only update your own creator tasks');
  const oldBudget = task.totalBudget || 0;
  for (const key of ['type', 'title', 'description', 'rewardPerUser', 'maxUsers', 'videoUrl', 'videoDuration', 'instagramUrl', 'youtubeUrl', 'thumbnail']) {
    if (body[key] !== undefined) task[key] = body[key];
  }
  validate(task);
  task.coins = task.rewardPerUser;
  task.totalBudget = task.rewardPerUser * task.maxUsers;
  if (task.totalBudget < task.coinsUsed) throw fail(400, 'Budget cannot be less than coins already used');
  const difference = task.totalBudget - oldBudget;
  if (creator.creatorWallet < difference) throw fail(400, 'Insufficient creator wallet balance');
  creator.creatorWallet -= difference;
  task.isActive = task.completedBy.length < task.maxUsers && task.totalBudget - task.coinsUsed >= task.rewardPerUser;
  await task.save({ session });
  await creator.save({ session });
  return { task, creatorWallet: creator.creatorWallet };
});

exports.remove = (userId, id) => mongoose.connection.transaction(async session => {
  const creator = await User.findById(userId).session(session);
  if (!creator?.isCreator || creator.creatorStatus !== 'approved') throw fail(403, 'You are not an approved creator');
  const task = await Task.findById(id).session(session);
  if (!task) throw fail(404, 'Task not found');
  if (!task.isCreatorTask || !task.createdBy?.equals(userId)) throw fail(403, 'You can only delete your own creator tasks');
  const refundedCoins = Math.max(0, task.totalBudget - task.coinsUsed);
  creator.creatorWallet += refundedCoins;
  await creator.save({ session });
  await TaskSubmission.deleteMany({ task: id }, { session });
  await task.deleteOne({ session });
  return { refundedCoins };
});
