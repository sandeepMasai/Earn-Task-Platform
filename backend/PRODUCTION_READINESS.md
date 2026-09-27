# Production readiness — 2026-09-27

The implementation is ready for staging review, **not verified as deployed to production**. This report supplements the earlier [API audit](API_AUDIT.md). Existing transactional wallet and reward protections are retained.

## Actual results

| Area | Status | Evidence and limits |
| --- | --- | --- |
| Backend regression | PASS | Final run: 33 tests, 28 passed, 0 failed, 5 explicitly skipped social-provider scenarios. All 82 declared route/method endpoints have successful isolated HTTP coverage. Temporary MongoDB replica set only. |
| Node compatibility | PASS | Earlier full 31-test suite passed on Node 20.20 and an actual npm-provided Node 22 runtime. Final two additional tests passed on Node 20.20. Render has not run this revision. |
| Cloudinary | PASS | Live disposable image and raw-file upload, identity, HTTPS retrieval, deletion and absence checks passed. Initial run encountered a transient 502; cleanup ran and the second run passed. URL parsing tests cover nested/versioned/transformed image and raw URLs. |
| YouTube automatic verification | NOT IMPLEMENTED | No configured official OAuth integration or authorized user identity. Provider abstraction returns manual-proof fallback, never fabricated success. |
| Instagram automatic verification | NOT IMPLEMENTED | No configured official integration establishing requested actions. Manual review remains required; no scraping or password collection. |
| Social fallback | PASS | Missing credentials and unsupported-action cases tested. Five live scenarios (verified, unverified, revoked, provider error, rate limit) are explicitly skipped, not represented as passing. |
| Watch sessions | PASS | Server elapsed-time credit, owner/task binding, ordered heartbeats, jump/frequency checks, expiry, one active session per account, and transactional reward consumption tested. Old client duration alone cannot earn rewards. |
| Human viewing evidence | PARTIAL | Heartbeats strengthen abuse resistance; a scripted client can still imitate plausible playback. No DRM, trusted device attestation, signed streaming infrastructure or proof of human attention. |
| Reconciliation dry run | PASS | Read-only configured-database run inspected 7 accounts; 0 eligible for automatic correction without reviewed historical evidence. No balances changed. Private report saved outside repository. |
| Reconciliation repair | PARTIAL | Guards, stale-report rejection, immutable application audit, compensating ledger entry, rollback and idempotency tested on disposable data. No real repair applied. |
| Render | BLOCKED | CLI token expired. Remote Blueprint validation encountered TLS timeout; read-only deployed-URL smoke requests failed to connect. No deployment or production readiness success claimed. |
| Load | PASS within stated criteria | 39 scenarios, 5,200 requests at concurrency 50/100/250; 24 financial invariant checks passed. No unexpected responses or timeouts. See [full results](reports/load-test.json). |
| Sustained capacity | PARTIAL | Short local bursts, not a production soak. Upload p95 reached 14,779.72 ms at 250 concurrency, close to the 15-second test limit. MongoDB recorded 38,428 write conflicts and 39,468 transaction aborts, recovered by transactional retries. Investigate contention before scaling. |
| Dependency audit | PASS | Last npm audit reported zero known vulnerabilities for installed dependency graph; this is not a security guarantee. |

## Changes and new components

Changed existing backend files: `package.json`/lockfile, environment example/ignore rules, server and database setup, Cloudinary configuration, upload middleware, media-owning models/controllers, Transaction model, task controller/routes, reward service and maintenance logging. Existing audit changes to authentication, validation, withdrawals and concurrency remain in place.

New readiness components:

- `src/config/production.js`: required production settings and separate strong JWT secrets.
- `src/middleware/security.js`, `src/models/RateLimitBucket.js`: security headers and shared MongoDB rate counters with TTL cleanup. Authentication allows 30 requests/minute/IP; API allows 600. Database failures fail closed.
- `src/models/mediaAsset.js`, `src/utils/retry.js`: stable media identity and bounded provider retry/backoff.
- `src/services/social/index.js`: explicit provider abstraction with safe manual fallback.
- `src/models/WatchSession.js`, `src/services/watchSessions.js`, `src/controllers/watchController.js`: watch protocol and transactional consumption.
- `src/models/ReconciliationAudit.js`, `src/services/reconciliation.js`, `scripts/reconcile-wallets.js`: evidence-based inspection and guarded correction.
- `src/utils/lifecycle.js`: drain HTTP before disconnecting MongoDB on SIGTERM/SIGINT, with a 25-second shutdown deadline.
- `test/production.test.js`, `test/social.test.js`, `test/reconciliation.test.js`, `test/integration/cloudinary.test.js`, shared disposable database support and expanded HTTP tests.
- `scripts/load-test.js`, `scripts/smoke.js`, `reports/load-test*.json`, `.node-version` and repository-root `render.yaml`.

Android task service/player now use watch sessions and server-authorized completion. Player resume handles load timing. Axios refresh retry typing and recursive refresh rejection were corrected; request bodies, response bodies and Axios objects are no longer logged by that service because they can contain passwords/tokens.

Android `tsc --noEmit` also passed after the client changes. No physical-device acceptance run was performed.

## Environment and local commands

Use Node 22 and MongoDB Atlas or a local **replica set**, not standalone MongoDB. From the repository root:

```sh
cd backend
npm ci
cp -n .env.example .env
# Configure .env locally; do not paste secrets into logs or source control.
npm start
```

Required in production: `NODE_ENV=production`, `MONGODB_URI`, distinct random `JWT_SECRET` and `JWT_REFRESH_SECRET` of at least 32 characters, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Render supplies `PORT`; bind to `0.0.0.0`. Configure exact HTTPS `CORS_ORIGINS` for browser clients; native Android needs no browser origin. Optional: `JWT_EXPIRE`, `JWT_REFRESH_EXPIRE`, `MAX_FILE_SIZE=50mb`, `MAX_VIDEO_SIZE=100mb`. Do not set `RATE_LIMIT_DISABLED=true` in production.

No automated payment gateway integration was established in this work. Existing withdrawal administration is not proof of external payment settlement; reconcile against actual payment evidence before repairs. No OAuth environment settings imply an implemented provider.

From `backend`:

```sh
npm test
CLOUDINARY_INTEGRATION_TEST=true npm run test:cloudinary
npm run reconcile -- --out /tmp/wallet-report-review.json
LOAD_CONCURRENCY=50 npm run test:load
LOAD_CONCURRENCY=50,100,250 LOAD_ALLOW_HIGH=true npm run test:load
SMOKE_BASE_URL=https://YOUR-STAGING-SERVICE.onrender.com npm run test:smoke
```

Cloudinary tests skip without explicit opt-in/credentials. They create only owned random assets in `backend-integration-tests/integration/`. Load tests start their own loopback application and disposable replica set, override database settings and use local uploads; they cannot target production through a URL argument. They require a locally installed `mongod` and permission to open local sockets. The load report records expected 400/409 contention rejections and 429 throttling separately from unexpected failures. CPU measurements cover Node, not the MongoDB process. Memory snapshots/GC measurements do not establish absence of a long-term leak. The initial failed load report remains available; its profile throttling regression was fixed and retested.

## Reconciliation workflow

Default dry run does not create indexes or collections. A missing trustworthy opening balance/history attestation results in `expectedBalance: null`, ineligibility and manual review, rather than guessing. Compare all withdrawal statuses and ledger links against independent payment records. Duplicate or missing economic records block correction.

The private dry-run output from this session is `/tmp/earn-wallet-reconciliation-readonly.json` (mode 0600). Do not commit or share its account-level contents. An evidence file is an array of reviewed attestations:

```json
[{"userId":"REVIEWED_ACCOUNT_ID","openingBalance":0,"completeHistoryConfirmed":true,"source":"Reference to independently reviewed opening balance and complete history"}]
```

Do not copy this example with guessed zero balances. With verified evidence, generate a fresh report:

```sh
node scripts/reconcile-wallets.js --dry-run --evidence /secure/path/reconciliation-evidence.json --out /secure/path/wallet-report-reviewed.json
```

**Only after account-by-account review and explicit approval**, apply that report:

```sh
RECONCILE_APPLY=true node scripts/reconcile-wallets.js --apply --confirm --report /secure/path/wallet-report-reviewed.json
```

The script rechecks snapshots, writes an audit intent, and commits each eligible correction and compensating transaction atomically. Historical ledger entries are not edited. Re-running an applied correction does not double-credit. Database administrators can bypass application-level audit immutability; restrict database roles and retain independent backups. Repair rollback requires another reviewed compensating operation, never deleting ledger history.

## Deployment checklist and rollback

1. Authenticate locally with `render login`; identify the intended service and staging service. The current token is expired. Do not share credentials in chat.
2. Review this working tree, commit the tested changes and make that exact revision available to Render. No commit or push was performed here.
3. Back up the database and record the last known-good image/revision and environment configuration. Configure separate staging database and Cloudinary test assets.
4. Validate `render.yaml` through Render. Build `npm ci --omit=dev`, start `npm start`, Node 22, health check path `/health` and separate dependency-readiness probe `/ready`, automatic deployment disabled. Remote Blueprint validation has not succeeded yet.
5. Ensure the database role can create required collections/indexes. New indexes include the unique partial active-watch index, watch/rate-limit TTL indexes and unique partial reconciliation transaction ID. Verify indexes finish building before enabling traffic; do not use `syncIndexes` to drop existing indexes. No historical backfill or balance migration runs at startup.
6. Set production secrets and exact browser origins. Verify Atlas network access, transaction support and Cloudinary credentials. Process startup waits for MongoDB connection/topology checks. `/health` checks process health; `/ready` pings MongoDB and returns 503 during shutdown/unavailability. Readiness does not probe Cloudinary or guarantee all external services.
7. Deploy staging, run the read-only smoke command, then exercise login/refresh/protected routes, watch completion, proof upload/review, wallet/withdrawal and creator approval using disposable accounts. Check allowed/disallowed browser CORS, throttling and SIGTERM behavior in the actual hosting environment. Local isolated coverage does not replace this step.
8. Coordinate the Android watch-session release. Older clients submitting only duration will be rejected. Require sign-in again because pre-audit JWTs lack the required token type.
9. Promote the tested revision and run read-only production smoke checks. Any mutating production smoke requires explicitly controlled test accounts and payment isolation. None were run here.

On deployment failure, stop rollout and restore the recorded known-good revision/environment through Render. Keep backups and inspect `/ready`, logs and index state. Disable affected earning flows before reverting to a revision with the old duration-only video contract or unsafe financial logic. Do not undo wallet corrections by restoring code, deleting audits, or replaying withdrawals. The new collections can remain when rolling code back; deleting them is not a rollback requirement.

## Remaining limitations

- Production reachability and signup timeouts remain unverified until the deployed service can be accessed; local tests cannot prove the Render issue is resolved.
- Official social verification and staging/production smoke flows remain incomplete.
- Watch sessions reject backwards playback and long gaps; user recovery, very short clips and physical-device background/resume playback need device acceptance testing. No Android device test was run in this phase.
- Upload validation checks signatures and size, not malware. Legacy binary `.doc` files are currently rejected because the detector identifies the generic compound container rather than a verified Word document; DOCX/PDF/text support remains. A safe compound-document parser is needed before enabling legacy DOC again.
- Local files are for development/tests; production requires Cloudinary. Failed-request cleanup is best effort; monitor provider cleanup failures for orphan assets.
- All database mutation tests used disposable fixtures. Real historical balances and provider/payment records were not changed.
