// Opt-in R2 test bucket only. No production application or database connection.
require('dotenv').config();
const fs = require('node:fs');
const { configured, verifyTestBucket, disposable } = require('../test/support/r2-live');
(async () => {
  if (process.env.R2_LOAD_TEST !== 'true' || !configured()) throw new Error('BLOCKED: R2_LOAD_TEST=true and test bucket credentials required');
  verifyTestBucket();
  const provider = new (require('../src/services/storage/r2.provider'))();
  const scenarios = [];
  try {
    for (const concurrency of [10, 25, 50]) {
      const memoryBefore = process.memoryUsage();
      const results = await Promise.allSettled(Array.from({ length: concurrency }, () => disposable(provider)));
      const good = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      const metric = key => {
        const values = good.map(r => r[key]).sort((a, b) => a - b);
        return Object.fromEntries([50, 95, 99].map(p => [`p${p}`, values.length ? values[Math.ceil(values.length * p / 100) - 1] : null]));
      };
      scenarios.push({ concurrency, failures: concurrency - good.length, errorRate: (concurrency - good.length) / concurrency, initializationMs: metric('initMs'), directUploadMs: metric('uploadMs'), totalMs: metric('totalMs'), memoryBefore, memoryAfter: process.memoryUsage(), apiLatency: 'NOT TESTED: provider-only test; no deployed staging API configured' });
      if (good.length !== concurrency) break; // Do not escalate on failures.
    }
  } finally { provider.client.destroy(); }
  fs.writeFileSync(process.env.R2_LOAD_REPORT || '/tmp/earn-r2-load-report.json', JSON.stringify({ scenarios, limitations: 'Tiny object transfer only. Does not establish large-video memory bounds or production capacity.' }, null, 2), { flag: 'wx', mode: 0o600 });
  if (scenarios.some(s => s.failures)) process.exitCode = 1;
})().catch(() => { console.error('R2 load test BLOCKED or failed; no secrets logged'); process.exitCode = 1; });
