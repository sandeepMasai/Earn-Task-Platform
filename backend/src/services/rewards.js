const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskSubmission = require('../models/TaskSubmission');
const Transaction = require('../models/Transaction');
const fail = require('../utils/httpError');

async function creditTask(task, userId, session) {
  if (!task.isActive) throw fail(400, 'Task is not active');
  if (task.isCompletedByUser(userId)) throw fail(400, 'Task already completed');
  const amount = task.isCreatorTask ? task.rewardPerUser : task.coins;
  if (!Number.isSafeInteger(amount) || amount < 0) throw fail(400, 'Invalid task reward');
  if (task.isCreatorTask) {
    if (task.createdBy.equals(userId)) throw fail(400, 'You cannot earn rewards from your own task');
    if (task.completedBy.length >= task.maxUsers || task.coinsUsed + amount > task.totalBudget) {
      throw fail(400, 'Task budget or user limit exhausted');
    }
    task.coinsUsed += amount;
  }
  task.completedBy.push({ user: userId });
  if (task.isCreatorTask && (task.coinsUsed >= task.totalBudget || task.completedBy.length >= task.maxUsers)) task.isActive = false;
  await task.save({ session });
  const user = await User.findOneAndUpdate({ _id: userId, isActive: true }, {
    $inc: { coins: amount, totalEarned: amount },
  }, { session, new: true });
  if (!user) throw fail(404, 'Active user not found');
  await Transaction.create([{ user: userId, type: 'earned', amount, description: `Completed task: ${task.title}`, task: task._id }], { session });
  return amount;
}

exports.complete = (taskId, userId, sessionId) => mongoose.connection.transaction(async session => {
  const task = await Task.findById(taskId).session(session);
  if (!task) throw fail(404, 'Task not found');
  if (task.type !== 'watch_video') throw fail(400, 'This task requires proof review or a post upload');
  if (!task.isActive) throw fail(400, 'Task is not active');
  if (task.isCompletedByUser(userId)) throw fail(400, 'Task already completed');
  if (typeof sessionId !== 'string') throw fail(400, 'A watch session is required; client duration is not proof');
  const watch = await require('../models/WatchSession').findOne({ _id: sessionId, user: userId, task: taskId }).session(session);
  if (!watch) throw fail(404, 'Watch session not found');
  if (watch.status !== 'active' || watch.expiresAt.getTime() <= Date.now()) throw fail(409, 'Watch session expired or already consumed');
  if (watch.videoId !== require('./watchSessions').videoId(task)) throw fail(409, 'Task video changed; start a new session');
  if (watch.accumulatedSeconds < watch.requiredWatchSeconds) throw fail(400, 'Insufficient verified watch time');
  watch.status = 'completed';
  await watch.save({ session });
  return creditTask(task, userId, session);
});

exports.review = (submissionId, reviewer, status, reason, creatorReview) => mongoose.connection.transaction(async session => {
  const submission = await TaskSubmission.findById(submissionId).session(session);
  if (!submission) throw fail(404, 'Submission not found');
  const task = await Task.findById(submission.task).session(session);
  if (!task) throw fail(404, 'Task not found');
  if (creatorReview) {
    if (!reviewer.isCreator || reviewer.creatorStatus !== 'approved' || !task.isCreatorTask || !task.createdBy?.equals(reviewer._id)) throw fail(403, 'You cannot review this submission');
  } else if (task.isCreatorTask) throw fail(403, 'Creator must review this submission');
  if (submission.status !== 'pending') throw fail(400, 'Only pending submissions can be reviewed');
  let coins = 0;
  if (status === 'approved') coins = await creditTask(task, submission.user, session);
  submission.status = status;
  submission.reviewedBy = reviewer._id;
  submission.reviewedAt = new Date();
  submission.rejectionReason = status === 'rejected' ? reason || 'Proof verification failed' : null;
  await submission.save({ session });
  return { coins, message: status === 'approved' ? 'Task approved and coins credited successfully' : 'Task submission rejected' };
});
