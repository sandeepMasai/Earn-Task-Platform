# Backend API audit — 2026-09-27

This records the initial audit. See [production readiness results](PRODUCTION_READINESS.md) for subsequent watch-session, live Cloudinary, reconciliation, load and deployment work.

Reviewed every backend source file, model, route, middleware, utility, startup
configuration, and maintenance script. Secret values were not copied into reports.

## Verification

- 80 declared route/method endpoints each have a successful isolated HTTP test,
  plus the health endpoint. A test enumerates the actual Express routers and fails
  if an endpoint lacks successful coverage.
- 125 concrete method/path combinations exercised, including authorization,
  validation, nonexistent records, uploads and invalid requests.
- 10 test groups pass via `npm test` against a temporary MongoDB replica set.
- All 50 JavaScript source/test files pass `node --check`.
- Read-only connection to the configured database succeeded and confirmed support
  for transactions. An initial connection attempt failed transiently; this does
  not establish continuous network availability.

## Fixes

| Area | Problem | Result |
| --- | --- | --- |
| Withdrawal | Request deducted coins and approval deducted them again; pending rejection lost reserved coins | Reserve once, refund once, enforce status transitions; wallet, request and ledger changes are transactional |
| Concurrency | Multiple balance updates could overspend or award twice | Transactions protect withdrawals, task rewards, proof review, creator funding/budgets, referrals, post rewards and follows |
| Authentication | Blocked accounts still authenticated; refresh/access tokens interchangeable with shared secret | Blocking enforced on login, refresh and protected routes; token types and algorithms checked; no default signing secret |
| Expiry | Returned expiry could disagree with signed JWT | `expiresAt` is derived from the signed token |
| Task rewards | Missing duration passed validation; social completion bypassed review | Video timing is validated; social rewards require reviewed proof; inactive tasks cannot pay |
| Task proofs | Pending resubmissions caused duplicate-key server errors | Pending/approved submissions return a clear client error; rejected proof can be resubmitted |
| Creator budget | Edits increased budget without charging wallet; deletion could refund unreserved coins | Budget differences debit/refund the creator wallet in the same transaction as the task change |
| Creator review | Funding/reward requests could be processed repeatedly | Only pending requests can be reviewed; concurrent review credits once |
| Social rewards | Like/unlike cycling repeatedly earned coins | A durable per-post rewarded-user list allows one like reward per user |
| Validation | Invalid IDs, nested queries, malformed profile input and invalid pagination caused errors or unsafe queries | Client errors are returned before the corresponding database operations |
| Coin configuration | Invalid values and keys accepted; incomplete cache returned as complete | Configuration validation, labels for upserts, cache completion/expiry corrected |
| Deleted records | Missing populated users caused story/comment/task history crashes | Missing users are handled; user deletion removes owned records and follow references transactionally |
| Media | Cloudinary deletion included URL version/transformation segments; raw file extensions were lost | Asset IDs are parsed with cloud/host checks; local storage is isolated in tests |
| CSV | Commas/newlines/formula prefixes corrupted payment exports | Cells are quoted, escaped and formula prefixes neutralized |
| Operations | Tests referenced missing Jest; startup reported success before database readiness; passwords logged in requests | Built-in Node test runner, database-first startup/readiness, request bodies no longer logged |
| Maintenance | Seed script deleted all tasks; admin script used a default password and printed it | Seed is additive; explicit admin password required and not printed |

Rollback tests inject ledger-write failures and verify neither a wallet debit nor
a task completion remains committed. Concurrent tests cover withdrawal limits,
task completion, proof approval, creator coin approval, and follows.

## Rollout and limits

- Restart the backend and sign in again. Old tokens lack the new type claim.
- MongoDB must support transactions: Atlas, a replica set, or a sharded cluster.
- Existing historical balances affected by the old withdrawal logic were not
  altered. Reconcile them separately against payment and transaction records.
- All API mutations ran only against disposable test data, never real accounts.
- Upload HTTP tests use local storage. Cloudinary deletion has mocked unit
  coverage; live Cloudinary upload/delete credentials and service behavior were
  not exercised.
- Instagram/YouTube verification endpoints now explicitly return
  `verified: false, requiresProof: true`. No external verification integration is
  implemented; the existing manual proof-review flow is required.
- Video duration is client-reported. Validating its range is not independent
  evidence that someone actually watched the video.
- This is functional regression coverage, not a load test or a guarantee against
  every possible input, outage, or abuse scenario. No Render deployment was made.
