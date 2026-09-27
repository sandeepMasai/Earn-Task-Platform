const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const Audit = require('../models/ReconciliationAudit');
const fail = require('../utils/httpError');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = value => String(value);

function analyze(user, transactions, withdrawals, evidence) {
  const issues = [];
  const economic = transactions.filter(t => t.type !== 'reconciliation');
  const credits = economic.filter(t => ['earned', 'bonus', 'referral'].includes(t.type)).reduce((n, t) => n + t.amount, 0);
  const knownTypes = ['earned', 'bonus', 'referral', 'withdrawn', 'refund', 'reconciliation'];
  if (transactions.some(t => !knownTypes.includes(t.type) || !Number.isSafeInteger(t.amount) || t.amount < 0)) issues.push('invalid_ledger_entry');
  if (!evidence || evidence.userId !== id(user._id) || !Number.isSafeInteger(evidence.openingBalance) || evidence.openingBalance < 0 || typeof evidence.source !== 'string' || !evidence.source.trim() || evidence.completeHistoryConfirmed !== true) issues.push('opening_balance_and_complete_history_not_attested');
  if (credits !== user.totalEarned) issues.push('earnings_ledger_does_not_match_totalEarned');
  let reserved = 0;
  const seenTasks = new Set();
  for (const t of economic) {
    if (t.type === 'earned' && t.task) {
      if (seenTasks.has(id(t.task))) issues.push('duplicate_task_reward');
      seenTasks.add(id(t.task));
    }
    if (['withdrawn', 'refund'].includes(t.type) && (!t.withdrawal || !withdrawals.some(w => id(w._id) === id(t.withdrawal)))) issues.push('orphan_withdrawal_ledger_entry');
  }
  for (const w of withdrawals) {
    if (!Number.isSafeInteger(w.amount) || w.amount <= 0 || !['pending', 'approved', 'completed', 'rejected'].includes(w.status)) issues.push('invalid_withdrawal');
    const debits = economic.filter(t => t.type === 'withdrawn' && id(t.withdrawal) === id(w._id));
    const refunds = economic.filter(t => t.type === 'refund' && id(t.withdrawal) === id(w._id));
    if (debits.length !== 1 || debits[0]?.amount !== w.amount) issues.push('missing_or_duplicate_withdrawal_debit');
    if (refunds.length > 1 || refunds.some(t => t.amount !== w.amount) || (refunds.length && w.status !== 'rejected')) issues.push('inconsistent_refund_ledger');
    if (w.status !== 'rejected') reserved += w.amount;
  }
  const expectedBalance = evidence && Number.isSafeInteger(evidence.openingBalance) ? evidence.openingBalance + credits - reserved : null;
  if (expectedBalance !== null && (!Number.isSafeInteger(expectedBalance) || expectedBalance < 0)) issues.push('invalid_expected_balance');
  const snapshot = {
    user: { id: id(user._id), coins: user.coins, totalEarned: user.totalEarned, totalWithdrawn: user.totalWithdrawn },
    transactions: transactions.map(t => ({ id: id(t._id), type: t.type, amount: t.amount, task: t.task ? id(t.task) : null, withdrawal: t.withdrawal ? id(t.withdrawal) : null, reconciliationId: t.reconciliationId || null })).sort((a, b) => a.id.localeCompare(b.id)),
    withdrawals: withdrawals.map(w => ({ id: id(w._id), amount: w.amount, status: w.status })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  const difference = expectedBalance === null ? null : expectedBalance - user.coins;
  return { userId: id(user._id), storedBalance: user.coins, expectedBalance, difference, expectedTotalWithdrawn: reserved,
    withdrawalIds: withdrawals.map(w => id(w._id)), transactionIds: transactions.map(t => id(t._id)),
    issues: [...new Set(issues)], eligible: issues.length === 0,
    recommendedAction: issues.length ? 'MANUAL_REVIEW_REQUIRED' : difference === 0 && reserved === user.totalWithdrawn ? 'NO_CHANGE' : 'REVIEW_REPORT_BEFORE_REPAIR',
    evidence: evidence || null, snapshot, snapshotHash: hash(snapshot),
  };
}
async function inspect(userId, evidence, session = null) {
  const user = await User.findById(userId).session(session).lean();
  if (!user) throw fail(404, 'User not found');
  const transactions = await Transaction.find({ user: userId }).session(session).lean();
  const withdrawals = await Withdrawal.find({ user: userId }).session(session).lean();
  return analyze(user, transactions, withdrawals, evidence);
}
async function apply(report, confirmation) {
  if (!confirmation || process.env.RECONCILE_APPLY !== 'true') throw fail(403, 'Both RECONCILE_APPLY=true and --confirm are required');
  if (!report.eligible || !report.evidence) throw fail(400, 'Ambiguous records cannot be automatically repaired');
  const reportHash = hash({ snapshotHash: report.snapshotHash, evidence: report.evidence });
  const auditId = `wallet-v1-${report.userId}-${reportHash}`;
  if (await Transaction.exists({ reconciliationId: auditId })) return { status: 'ALREADY_APPLIED', auditId };
  const current = await inspect(report.userId, report.evidence);
  if (current.snapshotHash !== report.snapshotHash || current.expectedBalance !== report.expectedBalance || current.difference !== report.difference || !current.eligible) throw fail(409, 'Report is stale or modified; create a new dry-run report');
  if (current.recommendedAction === 'NO_CHANGE') return { status: 'NO_CHANGE' };
  // Immutable intent survives a failed repair and supports forensic review.
  try { await Audit.create({ _id: auditId, user: report.userId, reportHash, snapshot: current.snapshot, evidence: current.evidence }); }
  catch (error) { if (error.code !== 11000) throw error; }
  return mongoose.connection.transaction(async session => {
    if (await Transaction.exists({ reconciliationId: auditId }).session(session)) return { status: 'ALREADY_APPLIED', auditId };
    const fresh = await inspect(report.userId, report.evidence, session);
    if (fresh.snapshotHash !== report.snapshotHash) throw fail(409, 'Account changed after report creation');
    await User.updateOne({ _id: report.userId, coins: fresh.storedBalance }, { $set: { coins: fresh.expectedBalance, totalWithdrawn: fresh.expectedTotalWithdrawn } }, { session });
    // This repairs a projection discrepancy, not new earnings. Excluded from
    // economic credits in subsequent reconciliation; preserves all old entries.
    await Transaction.create([{ user: report.userId, type: 'reconciliation', amount: Math.abs(fresh.difference), direction: fresh.difference >= 0 ? 'credit' : 'debit', reconciliationId: auditId, description: 'Reviewed historical wallet projection correction' }], { session });
    return { status: 'APPLIED', auditId, difference: fresh.difference };
  });
}
module.exports = { analyze, inspect, apply, hash };
