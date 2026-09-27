#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
async function main() {
  const applying = args.includes('--apply');
  if (applying && (process.env.RECONCILE_APPLY !== 'true' || !args.includes('--confirm') || !value('--report'))) throw new Error('Apply requires RECONCILE_APPLY=true, --apply --confirm and --report PATH');
  if (applying && args.includes('--dry-run')) throw new Error('Choose either dry-run or apply');
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  // Dry-run must not implicitly create collections or indexes.
  await mongoose.connect(process.env.MONGODB_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const reconciliation = require('../src/services/reconciliation');
  if (applying) {
    const report = JSON.parse(fs.readFileSync(value('--report'), 'utf8'));
    if (report.version !== 1 || !Array.isArray(report.accounts)) throw new Error('Invalid report');
    await require('../src/models/Transaction').createIndexes();
    for (const account of report.accounts) {
      if (!account.eligible || account.recommendedAction === 'NO_CHANGE') continue;
      console.log(JSON.stringify({ userId: account.userId, ...(await reconciliation.apply(account, true)) }));
    }
  } else {
    const evidence = value('--evidence') ? JSON.parse(fs.readFileSync(value('--evidence'), 'utf8')) : [];
    if (!Array.isArray(evidence)) throw new Error('Evidence must be an array of account attestations');
    const accounts = [];
    for await (const user of require('../src/models/User').find().select('_id').lean().cursor()) {
      accounts.push(await reconciliation.inspect(user._id, evidence.find(e => e.userId === String(user._id))));
    }
    const output = value('--out') || `wallet-report-${Date.now()}.json`;
    fs.writeFileSync(output, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), mode: 'READ_ONLY', accounts }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Read-only report saved; accounts=${accounts.length}, eligible=${accounts.filter(a => a.eligible).length}. No balances changed.`);
  }
}
if (require.main === module) main().catch(error => { console.error(`Reconciliation stopped (${error.status || error.code || error.name}); no secret values logged`); process.exitCode = 1; }).finally(() => mongoose.disconnect());
module.exports = { main };
