const mongoose = require('mongoose');
const { randomUUID, createHash } = require('node:crypto');
const WatchSession = require('../models/WatchSession');
const Task = require('../models/Task');
const fail = require('../utils/httpError');
const videoId = task => createHash('sha256').update(`${task.videoUrl}|${task.videoDuration}`).digest('hex');
const MIN_INTERVAL_MS = 2000;
const MAX_CREDIT_SECONDS = 10;
function createService(now = () => Date.now()) {
  return {
    async start(taskId, userId) {
      return mongoose.connection.transaction(async session => {
        const task = await Task.findById(taskId).session(session);
        if (!task || !task.isActive) throw fail(404, 'Active task not found');
        if (task.type !== 'watch_video' || !Number.isFinite(task.videoDuration) || task.videoDuration <= 0) throw fail(400, 'Task does not support video sessions');
        const host = new URL(task.videoUrl).hostname;
        if (/(^|\.)(youtube\.com|youtu\.be|instagram\.com|instagr\.am)$/.test(host)) throw fail(400, 'External playback cannot be verified by this player');
        if (task.isCompletedByUser(userId)) throw fail(400, 'Task already completed');
        const timestamp = now();
        await WatchSession.updateMany({ user: userId, status: 'active', expiresAt: { $lte: new Date(timestamp) } }, { status: 'expired' }, { session });
        const existing = await WatchSession.findOne({ user: userId, status: 'active' }).session(session);
        if (existing) {
          if (existing.task.equals(taskId) && existing.videoId === videoId(task)) return { sessionId: existing.id, videoId: existing.videoId, startedAt: existing.startedAt, expiresAt: existing.expiresAt, requiredWatchSeconds: existing.requiredWatchSeconds, sequence: existing.sequence, playbackPosition: existing.playbackPosition, accumulatedSeconds: existing.accumulatedSeconds };
          throw fail(409, 'Another watch session is already active');
        }
        const [watch] = await WatchSession.create([{
          _id: randomUUID(), user: userId, task: taskId, videoId: videoId(task), startedAt: new Date(timestamp),
          lastHeartbeatAt: new Date(timestamp), expiresAt: new Date(timestamp + Math.max(task.videoDuration * 2, 120) * 1000),
          duration: task.videoDuration, requiredWatchSeconds: task.videoDuration * 0.8,
        }], { session });
        return { sessionId: watch.id, videoId: watch.videoId, startedAt: watch.startedAt, expiresAt: watch.expiresAt, requiredWatchSeconds: watch.requiredWatchSeconds, heartbeatIntervalSeconds: 5, sequence: 0, playbackPosition: 0, accumulatedSeconds: 0 };
      });
    },
    async heartbeat(taskId, userId, body) {
      const { sessionId, playbackPosition, clientTimestamp, sequence } = body;
      if (typeof sessionId !== 'string' || typeof playbackPosition !== 'number' || !Number.isFinite(playbackPosition) || playbackPosition < 0 || !Number.isSafeInteger(sequence) || sequence < 1 || !Number.isFinite(clientTimestamp) || clientTimestamp <= 0) throw fail(400, 'Invalid heartbeat');
      return mongoose.connection.transaction(async session => {
        const watch = await WatchSession.findOne({ _id: sessionId, user: userId, task: taskId }).session(session);
        if (!watch) throw fail(404, 'Watch session not found');
        const timestamp = now();
        if (watch.status !== 'active' || watch.expiresAt.getTime() <= timestamp) throw fail(409, 'Watch session expired or completed');
        if (sequence !== watch.sequence + 1 || clientTimestamp <= watch.lastClientTimestamp) throw fail(409, 'Duplicate or out-of-order heartbeat');
        const elapsed = (timestamp - watch.lastHeartbeatAt.getTime()) / 1000;
        if (elapsed * 1000 < MIN_INTERVAL_MS) throw fail(429, 'Heartbeat arrived too quickly');
        const progress = playbackPosition - watch.playbackPosition;
        if (progress < 0 || progress > Math.min(elapsed + 1, MAX_CREDIT_SECONDS + 1) || playbackPosition > watch.duration + 0.5) throw fail(400, 'Implausible playback position');
        // Client position bounds progress; only server elapsed time grants credit.
        // Long offline gaps cannot accumulate unlimited credit.
        watch.accumulatedSeconds += Math.min(elapsed, progress, MAX_CREDIT_SECONDS);
        watch.playbackPosition = playbackPosition;
        watch.lastHeartbeatAt = new Date(timestamp);
        watch.lastClientTimestamp = clientTimestamp;
        watch.sequence = sequence;
        await watch.save({ session });
        return { sequence, accumulatedSeconds: watch.accumulatedSeconds, requiredWatchSeconds: watch.requiredWatchSeconds, canComplete: watch.accumulatedSeconds >= watch.requiredWatchSeconds };
      });
    },
  };
}
module.exports = { ...createService(), createService, videoId };
