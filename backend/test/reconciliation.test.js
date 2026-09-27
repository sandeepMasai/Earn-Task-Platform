const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../src/services/reconciliation');
const user = { _id: 'user1', coins: 4000, totalEarned: 5000, totalWithdrawn: 1000 };
const credits = { _id: 't1', type: 'earned', amount: 5000 };
const debit = { _id: 't2', type: 'withdrawn', amount: 1000, withdrawal: 'w1' };
const withdrawal = { _id: 'w1', amount: 1000, status: 'approved' };
const evidence = { userId: 'user1', openingBalance: 0, completeHistoryConfirmed: true, source: 'Reviewed fixture initial account and full ledger' };
for (const state of ['pending', 'approved', 'completed']) {
  test(`${state} withdrawal reserves exactly once`, () => {
    const r = analyze(user, [credits, debit], [{ ...withdrawal, status: state }], evidence);
    assert.equal(r.expectedBalance, 4000); assert.equal(r.difference, 0); assert.equal(r.eligible, true);
  });
}
test('old double deduction is a reviewable discrepancy, never an automatic repair', () => {
  const r = analyze({ ...user, coins: 3000 }, [credits, debit], [withdrawal], evidence);
  assert.equal(r.difference, 1000); assert.equal(r.recommendedAction, 'REVIEW_REPORT_BEFORE_REPAIR');
});
test('rejected withdrawal missing historical refund projects reserved coins back', () => {
  const r = analyze(user, [credits, debit], [{ ...withdrawal, status: 'rejected' }], evidence);
  assert.equal(r.expectedBalance, 5000); assert.equal(r.difference, 1000);
});
test('missing and duplicate records block repair', () => {
  for (const tx of [[credits], [credits, debit, { ...debit, _id: 'duplicate' }]]) assert.equal(analyze(user, tx, [withdrawal], evidence).eligible, false);
  assert.equal(analyze(user, [credits, debit], [withdrawal]).expectedBalance, null);
});
test('compensating projection records do not mint new economic earnings on rerun', () => {
  const r = analyze(user, [credits, debit, { _id: 'repair', type: 'reconciliation', amount: 1000 }], [withdrawal], evidence);
  assert.equal(r.expectedBalance, 4000); assert.equal(r.difference, 0);
});
