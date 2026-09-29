#!/usr/bin/env node
// Read-only bucket configuration audit; no credentials or provider payloads logged.
require('dotenv').config();
const fs = require('node:fs');
const { S3Client, GetBucketCorsCommand, GetBucketLocationCommand } = require('@aws-sdk/client-s3');
async function audit() {
  const env = process.env;
  const report = { bucket: env.R2_BUCKET, privacy: 'BLOCKED', location: null, cors: {} };
  const client = new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }, maxAttempts: 1, requestHandler: { connectionTimeout: 10000, requestTimeout: 15000 } });
  for (const [name, Command] of [['cors', GetBucketCorsCommand], ['location', GetBucketLocationCommand]]) {
    try { const r = await client.send(new Command({ Bucket: env.R2_BUCKET })); report[name] = name === 'cors' ? { status: 'PASS', rules: r.CORSRules || [] } : r.LocationConstraint || 'auto'; }
    catch (e) { report[name] = { status: 'BLOCKED', httpStatus: e.$metadata?.httpStatusCode || null, networkCode: ['ENOTFOUND','EACCES','EPERM','ECONNREFUSED'].includes(e.code) ? e.code : undefined }; }
  }
  client.destroy();
  if (!env.CLOUDFLARE_API_TOKEN) report.privacyReason = 'Management API token unavailable; S3 keys do not establish public-domain state';
  else {
    const base = `https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/buckets/${encodeURIComponent(env.R2_BUCKET)}`;
    try {
      async function get(suffix) { const r = await fetch(base + suffix, { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Object.assign(new Error('Management API denied'), { status: r.status }); const b = await r.json(); if (!b.success) throw new Error('Management API failed'); return b.result; }
      const managed = await get('/domains/managed'), custom = await get('/domains/custom');
      report.managedPublic = managed.enabled;
      report.customDomains = custom.domains.map(d => ({ domain: d.domain, enabled: d.enabled }));
      report.privacy = managed.enabled === false && custom.domains.every(d => d.enabled === false) ? 'PASS' : 'BLOCKED';
    } catch (e) { report.privacyReason = 'Management API inspection failed'; report.managementStatus = e.status || null; }
  }
  fs.writeFileSync('/tmp/earn-r2-bucket-audit.json', JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  return report;
}
if (require.main === module) audit().catch(() => { console.error('Bucket audit failed; details suppressed'); process.exitCode = 1; });
module.exports = audit;
