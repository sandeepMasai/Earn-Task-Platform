const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  videoId: { type: String, required: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  lastHeartbeatAt: { type: Date, required: true },
  lastClientTimestamp: { type: Number, default: 0 },
  sequence: { type: Number, default: 0 },
  playbackPosition: { type: Number, default: 0 },
  accumulatedSeconds: { type: Number, default: 0 },
  requiredWatchSeconds: { type: Number, required: true },
  duration: { type: Number, required: true },
  status: { type: String, enum: ['active', 'completed', 'expired'], default: 'active' },
}, { timestamps: true });
// One active watch per account, including across devices/tasks.
schema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
module.exports = mongoose.model('WatchSession', schema);
