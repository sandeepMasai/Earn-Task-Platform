const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  reportHash: { type: String, required: true, immutable: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  evidence: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { versionKey: false });
for (const method of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  schema.pre(method, function () { throw new Error('Reconciliation audit records are append-only'); });
}
schema.pre('save', function () { if (!this.isNew) throw new Error('Reconciliation audit records are append-only'); });
module.exports = mongoose.model('ReconciliationAudit', schema);
