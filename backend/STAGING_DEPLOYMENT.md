# Staging deployment attempt — 2026-09-27

## Current configuration-only preparation

Latest instruction requires a local backend staging commit, no deployment, and no automatic repository change. Local intended repository is sandeepMasai/Earn-Task-Platform, branch main. Render was last verified as sandeepMasai/Earn-Task-Platform-backend, branch main; the mismatch remains a deployment blocker. The Dashboard must be manually changed to the tested repository before deployment. Remote database/environment setup stops at this mismatch.

The local Blueprint now uses `/health` for Render's health check, as explicitly requested. `/ready` remains the dependency-readiness endpoint and still returns failure for unavailable MongoDB. Earlier `/ready` hosting configuration instructions below are superseded. Local intended build is `npm ci --omit=dev`, start is `npm start`, root directory backend and Node 22. Remote settings have not been changed.

The backend staging commit excludes Android modifications, secret environment files and private reconciliation reports. Its SHA is recorded in the completion response; obtain it locally with `git log -1 --format=%H --grep='chore: prepare backend for staging deployment'`. A commit cannot embed its own hash. Android changes remain separate and must be coordinated before watch-session rollout.

No dedicated staging credentials or empty transaction-capable staging database have been verified. No Render configuration, database mutation, Cloudinary mutation, deployment or load test was performed in this preparation phase.


## Latest verification — deployment explicitly prohibited

Only read-only remote checks were performed. No remote settings changed, no deployment triggered, automatic deployment remains disabled, and no database, wallet, load or Cloudinary mutation tests ran.

| Area | Status | Evidence |
| --- | --- | --- |
| Repository | BLOCKED | Live service listing still reports sandeepMasai/Earn-Task-Platform-backend; intended local origin is sandeepMasai/Earn-Task-Platform. Mismatch unresolved. |
| Branch | PASS | Both local checkout and service configuration report main; this does not resolve the repository mismatch. |
| Commit | BLOCKED | Local HEAD 5127fa9b78e76cb5444c3bf01b92680c1feeb640; 70 modified/untracked entries. Tested changes are not a committed revision. Fresh deployment history retrieval timed out. Last observed live revision ff6ba477123ea83c9e2d4035d1b6f14b8a925a75 is historical evidence only. |
| Staging database | BLOCKED | No verified empty earn_task_platform_staging database with staging-only credentials. No production credentials reused to create one. |
| Transactions | BLOCKED | Staging database topology/permissions not checked. |
| Environment variables | BLOCKED | Redacted read-only environment inspection timed out (curl exit 28). Current secret presence, strength and separation cannot be confirmed. |
| Cloudinary isolation | BLOCKED | Dedicated staging account/prefix and credential scope unverified. Deployed behavior NOT TESTED. |
| Node 22 | BLOCKED | Local Blueprint and .node-version request 22; remote setting could not be verified. |
| Render configuration | BLOCKED | rootDir=backend, start=npm start, autoDeploy=no verified. Actual build=npm install and health path empty; required npm ci --omit=dev and /ready not configured. |

Local index startup gate is present: connectDB, await all registered model.init calls, then listen. No syncIndexes or startup seed/reconciliation call was added. This change is uncommitted and cannot be asserted present in Render's live revision. HOST defaults to 0.0.0.0; a remote override could not be inspected.

Dashboard route returned HTTP 200 at https://dashboard.render.com/web/srv-d4vs537gi27c73dbdf00. This establishes web-page reachability only, not authenticated Dashboard access. This session has no authenticated browser-control tool, so it cannot execute Dashboard edits. API environment retrieval timed out; deployment-history retrieval returned net/http: TLS handshake timeout.

Manual handoff: in the authenticated Dashboard verify the intended repository mapping before editing service settings. Keep automatic deployment off and do not deploy. Configure a dedicated staging-only MongoDB user restricted to earn_task_platform_staging, then supply its URI securely in Render; do not reuse production credentials. Verify the database is empty and transaction-capable before any tests. Configure distinct strong JWT secrets, NODE_ENV=production, NODE_VERSION=22, staging Cloudinary credentials, and exact staging browser origins. No staging frontend origin or dedicated database credentials were supplied in this session. A shared Cloudinary folder alone is not a credential permission boundary; prefer a separate product environment/account. Save only through a workflow that does not trigger deployment.

Do not treat these manual steps as completed. Repository resolution, a committed tested revision, database isolation and environment verification remain required. Stop before deployment as instructed.


## Current staging continuation

The user explicitly selected **Earn-Task-Platform-backend**, service `srv-d4vs537gi27c73dbdf00`, with a separate staging database. Target selection is resolved; database isolation is not yet verified.

- Selected service currently points to `sandeepMasai/Earn-Task-Platform-backend`, branch `main`, while this working tree uses `sandeepMasai/Earn-Task-Platform`. Do not deploy the old repository revision accidentally. Staging automatic deployment is disabled.
- Recorded Render live revision: `ff6ba477123ea83c9e2d4035d1b6f14b8a925a75`, deployment `dep-d517kfje5dus73fi7ti0`. This is a rollback candidate, not a health-verified known-good release.
- Previous successful secret-redacted settings inspection found no explicit database name in staging MONGODB_URI and no JWT_REFRESH_SECRET. Strong separate secrets and Node 22 still need to be set and verified on the service.
- Proposed database `earn_task_platform_staging` has NOT been verified, created, or selected remotely. Subsequent read-only isolation checks failed at Render settings retrieval (`RENDER_CURL_28`, curl timeout), before connecting to MongoDB. No private prepared environment file was produced.
- Blueprint validation again failed: `POST https://api.render.com/v1/blueprints/validate`: `net/http: TLS handshake timeout`. This is not a YAML rejection.
- Local `src/server.js` now awaits registered Mongoose models' index initialization before opening the HTTP listener. No index-dropping synchronization is used; financial logic is unchanged.
- Regression after that change: 33 tests, 28 passed, 0 failed, 5 skipped; `git diff --check` passed. Actual staging index creation remains NOT TESTED.
- The earlier execution approval usage-limit rejection cleared on continuation; it is not the current blocker.

Current blocker: intermittent Render API TLS/timeouts prevent inspection/configuration of the isolated database and environment. No remote configuration, deployment, database mutation, Cloudinary mutation, or production promotion occurred.

Manual route if API connectivity remains unavailable: open https://dashboard.render.com/web/srv-d4vs537gi27c73dbdf00 and inspect Environment. Configure MONGODB_URI securely for a dedicated empty transaction-capable staging database, distinct strong JWT_SECRET/JWT_REFRESH_SECRET, NODE_VERSION=22 and NODE_ENV=production. Do not paste credentials in chat. Keep automatic deployment disabled and do not trigger a deployment until the tested revision, repository mapping and remaining staging prerequisites are verified. Database backup location and Cloudinary staging isolation are still outstanding.

The older attempts below are historical; their requests to select a staging service are superseded.


## Latest retest — supersedes the authentication blocker below

Render CLI service listing now succeeds: authentication and service-list access **PASS**. The earlier expired-token/login blocker no longer describes the current result. Connectivity remains intermittent; remote Blueprint validation still exits 1 with `net/http: TLS handshake timeout` on `POST https://api.render.com/v1/blueprints/validate`. An unauthenticated HTTPS diagnostic also returned `curl: (28) SSL connection timeout`. No Blueprint configuration rejection was received.

Two matching services were found, neither with an environment label identifying it as staging:

| Service | ID | Automatic deployment |
| --- | --- | --- |
| Earn-Task-Platform | srv-d51891tactks73f44ok0 | Enabled |
| Earn-Task-Platform-backend | srv-d4vs537gi27c73dbdf00 | Disabled |

Both use root directory `backend`. A staging target and dedicated non-production database must be identified before deployment or mutating tests. No service settings were changed.

Read-only smoke retest:

| Target | /health | /ready | /api/tasks | /not-a-route | Overall |
| --- | --- | --- | --- | --- | --- |
| https://earn-task-platform.onrender.com | Connection failed | Connection failed | HTTP 401, security-header check failed | HTTP 404, security-header check failed | BLOCKED |
| https://earn-task-platform-backend.onrender.com | Connection failed | Connection failed | Connection failed | HTTP 404, security-header check failed | BLOCKED |

The smoke script requires `X-Content-Type-Options: nosniff` as well as the expected HTTP status. Consequently, the returned 401/404 responses are not passing checks. Response origins/revisions have not been established; do not infer that these services contain the current code. Connection failures do not prove an application crash.

No deployment, Cloudinary mutation, database change, production promotion or staging load run occurred. Remaining staging feature checks are NOT TESTED. Next required input: intended staging service and confirmation of isolated staging database. Authentication does not need to be repeated based on this retest.

## Previous attempt (historical)

Stopped at phase 3 as requested: secure CLI login could not complete. No service was selected or deployed, and no database or Cloudinary assets were modified in this attempt. Prior local test results are not staging verification.

## Authentication blocker

Installed CLI: Render v2.21.0. Ran `render login` with network access requested through the execution environment. It exited 1 before presenting a browser authorization flow:

```text
Error: Post "https://api.render.com/v1/device-grant": net/http: TLS handshake timeout
```

Category: TLS/network connection failure during authentication, not an application or YAML validation failure. This error does not establish whether the cause is local network routing, a proxy, or Render's endpoint. Authentication, current workspace and intended staging service could not be verified. No credentials were printed. Blueprint validation was not retried because the explicit stop-at-authentication condition applied.

Required manual action: run `render login` in your own terminal and complete Render's browser authorization flow. If it also times out, resolve connectivity to `api.render.com:443` through your network/proxy and retry; do not disable TLS verification. Once login succeeds, provide only the staging service name/ID and workspace, not the token. Staging database and Cloudinary isolation must then be verified before deployment.

## Pre-deployment inspection

- `render.yaml` declares a Node web service, `rootDir: backend`, build `npm ci --omit=dev`, start `npm start`, readiness check `/ready`, and automatic deployment disabled.
- `.node-version` and Blueprint select Node 22. The current terminal actually runs Node v20.20.0; package engines allow >=20.20 <25. This is not proof of a deployed Node 22 runtime.
- `npm start` invokes existing `node src/server.js`. Package-lock v3 root dependencies match package.json. No Dockerfile was found in the file listing.
- Render supplies PORT; code defaults to port 3000 and HOST `0.0.0.0`. Verify no staging HOST override changes that binding.
- Required secret variable names are declared using `sync: false`; no secret values are in the Blueprint. CORS uses an explicit origin list. Production configuration checks required settings and distinct JWT secrets.
- `/health` reports process health; `/ready` pings MongoDB and rejects unavailable/shutting-down state. Startup connects to MongoDB and checks transaction-capable topology before listening.
- Shutdown drains HTTP before disconnecting MongoDB, with a 25-second deadline. Startup does not execute seed/reconciliation scripts.
- Watch unique partial and TTL indexes, rate TTL index and reconciliation transaction unique partial index are declared. Actual staging indexes are unverified. Startup currently does not explicitly await all model index builds before listening; address this deployment gate before enabling staging traffic.
- Blueprint service name is `earn-task-platform`, not an identified staging target. It must not be blindly applied to an existing production service.
- HEAD: `5127fa9b78e76cb5444c3bf01b92680c1feeb640`. Inspection found 69 changed/untracked status entries containing the readiness implementation. HEAD alone therefore does not identify the tested working tree. No commit or push was performed.
- Rollback revision, backup location, dedicated staging database and Cloudinary environment remain unidentified. Current HEAD is not asserted to be the known-good deployed revision.

## Verification status

| Area | Status | Evidence | Remaining issue |
| --- | --- | --- | --- |
| Render authentication | BLOCKED | Login exited 1 with TLS handshake timeout | Complete secure local login; verify workspace |
| Blueprint validation | PARTIAL | Local configuration inspected | Remote validation pending authentication |
| Staging deployment | BLOCKED | No deployment attempted | Identify staging service and commit tested revision |
| /health | NOT TESTED | Route inspected locally | Reach deployed staging URL |
| /ready | NOT TESTED | MongoDB ping/shutdown check inspected | Verify deployed dependency readiness |
| MongoDB connection | NOT TESTED | No staging URI selected | Dedicated staging database required |
| MongoDB transactions | NOT TESTED | Startup checks topology | Verify staging transactions and permissions |
| Indexes | PARTIAL | Index declarations inspected | Await creation and inspect staging indexes |
| Cloudinary | NOT TESTED | Previous local live result remains documented separately | Verify credentials from deployed staging |
| Authentication | NOT TESTED | Previous disposable regression suite passed | Staging registration/login/refresh/blocking |
| Watch sessions | NOT TESTED | Previous disposable regression suite passed | Staging playback/replay/completion tests |
| Wallet/withdrawal | NOT TESTED | Previous disposable regression suite passed | Controlled staging accounts only |
| Creator rewards | NOT TESTED | Previous disposable regression suite passed | Controlled staging funding/review flow |
| CORS | PARTIAL | Explicit origins configured in source | Review staging values and response headers |
| Rate limiting | PARTIAL | MongoDB rate limiter present | Verify deployed enforcement |
| Graceful shutdown | PARTIAL | Code and earlier local test available | Verify actual host signal/drain behavior |
| Android compatibility | NOT TESTED | Earlier TypeScript check passed | No device/emulator acceptance run in this attempt |
| Smoke tests | NOT TESTED | Existing script inspected: four read-only probes | Staging URL and extended controlled flows required |
| Staging load test | NOT TESTED | Earlier load test was disposable loopback only | Remote staging harness/metrics needed; existing load script does not target URLs |
| Production deployment status | NOT TESTED | No production deployment or promotion attempted | Explicitly outside this staging attempt |

Production promotion remains prohibited until the requested staging gates pass. Keep the performance warning from PRODUCTION_READINESS.md: near-15-second upload p95 at 250 concurrency and substantial recovered transaction contention. Do not reuse those local results as staging capacity evidence.

Existing rollback guidance remains in PRODUCTION_READINESS.md. Populate actual revisions, backup location and environment snapshot before deploying. Reverting code must never delete ledger or reconciliation audit history.
