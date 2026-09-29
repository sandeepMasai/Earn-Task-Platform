# R2 validation — 2026-09-28

## Current result

R2-only staging is **BLOCKED**. Production storage remains Cloudinary. No Cloudinary assets were uploaded, changed, migrated or deleted; no production database was accessed. The migration inventory read the configured Cloudinary account through its read-only resources API.

| Check | Result | Evidence / blocker |
| --- | --- | --- |
| R2 configuration | BLOCKED | Private mode is required; local R2_PRIVATE_BUCKET remains false because actual privacy has not been confirmed. |
| Bucket privacy | BLOCKED | Bucket `myapp-staging-media`, location `APAC`; no Cloudflare management API token is available to inspect r2.dev and custom domains. |
| Public URL configuration | PASS | Removed the S3 API endpoint from local R2_PUBLIC_BASE_URL. It is now empty; startup rejects every nonempty public URL when R2 is selected. |
| Direct upload initialization | BLOCKED | Live test stops at startup with R2_PRIVATE_BUCKET_REQUIRED. The previous request-time 503 had the same private-mode cause, plus the incompatible URL. No seeded fallback remains. |
| Browser CORS | BLOCKED | Live GetBucketCors returns HTTP 403. Bucket configuration access is denied; the exact token policy cannot be inspected with the available S3 credentials. |
| Browser image upload | BLOCKED | Browser suite attempted; private-mode startup guard stops it before Chrome/upload. CORS also remains unverified. |
| Browser video upload | BLOCKED | Same prerequisites as image upload. |
| Signed download | BLOCKED | No current full application live run, pending confirmed private bucket. Historical provider tests are not current certification. |
| Authorization | BLOCKED | Local mocked-provider regression passes; live owner/non-owner/anonymous checks await private bucket confirmation. |
| Delete | BLOCKED | Local lifecycle regression passes; current live object deletion and metadata checks await private bucket confirmation. |
| Migration dry-run | PASS | 358 assets, 358 eligible, 0 skipped, 0 conflicts, 611,243,220 estimated bytes, 358 would migrate, 0 migrated. |
| Regression tests | PASS | npm test: 51 passed, 5 skipped, 0 failed; syntax checks passed. Optional external integration tests are separate. |

## Configuration contract and changes

`src/services/storage/config.js` is the only parser of R2_PUBLIC_BASE_URL. Its returned publicBaseUrl property had no consumer. `mediaController.js` checks the environment variable to reject public direct uploads. No client or CDN code uses it. `R2Provider.getUrl` always signs a GetObject request against the S3 API endpoint. The S3 endpoint is correct *inside signed URLs*, but cannot be a public delivery URL.

The implemented R2 model is private only. An authenticated owner initializes a server-selected key, uploads with a checksum-bound signed PUT, confirms metadata/content, and obtains short-lived signed downloads. Published post/story/avatar content can be read by other authenticated users through `/api/media/:id/content`; publication does not expose a public bucket. `R2_PRIVATE_BUCKET=true` is an operator assertion, not a Cloudflare privacy change.

Startup already calls r2Config for every selected R2 category. It now fails with safe codes R2_PUBLIC_URL_UNSUPPORTED or R2_PRIVATE_BUCKET_REQUIRED. Cloudinary remains the default. The local flag has deliberately not been set to true without privacy evidence. Oversized direct-upload initialization now returns 400, matching other invalid input and the requested contract; multipart upload limits are unchanged.

## Cloudflare access needed

The read-only audit is `node scripts/r2-bucket-audit.js`; report: `/tmp/earn-r2-bucket-audit.json`. It reads S3 location/CORS and, when `CLOUDFLARE_API_TOKEN` is available locally, management endpoints `/domains/managed` and `/domains/custom`. It logs no credentials or signed URLs.

Cloudflare documents **Admin Read only / Workers R2 Storage Read** for viewing bucket configuration and **Admin Read & Write / Workers R2 Storage Write** for changing configuration. Object Read & Write allows object operations, not bucket configuration. Current 403 is consistent with insufficient configuration permission, but token scope itself is unverified. Do not expand the runtime application credential. Prefer the dashboard or a separate short-lived configuration credential for the required account. Cloudflare's configuration permission is account-scoped; it is broader than bucket-scoped object access.

Confirm r2.dev public access and all enabled custom-domain access are disabled before setting the existing R2_PRIVATE_BUCKET flag true. Do not make the bucket public.

`scripts/r2-cors.staging.json` is a prepared, **unapplied** S3 CORS policy for the only configured application origin, `http://localhost:8081`. It permits PUT/GET/HEAD and Content-Type, If-None-Match, x-amz-checksum-sha256. Browsers set Content-Length automatically. No wildcard origins or POST/DELETE are included. No production web origin was supplied, so none was invented. Native mobile HTTP requests do not require browser CORS.

References: [Cloudflare token permissions](https://developers.cloudflare.com/r2/api/tokens/), [CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/), [public bucket controls](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## Reproduce validation after prerequisites are supplied

```sh
npm test
node scripts/r2-bucket-audit.js
R2_STAGING_TEST=true node scripts/r2-staging-validation.js
R2_INTEGRATION_TEST=true R2_TEST_BUCKET_CONFIRM=myapp-staging-media npm run test:r2
npm run test:r2:browser
npm run migrate:media -- --dry-run
```

Private configuration must be verified first. Do not override false merely to pass tests. Both application scripts use a disposable local MongoDB and remove production DB and Cloudinary credentials from their process. Live reports are `/tmp/earn-r2-app-report.json` and `/tmp/earn-r2-browser-report.json`. The provider suite and browser suite were invoked this session and blocked by the private-bucket guard; they did not pass.

The browser harness uses Playwright with installed Chrome and the configured browser origin (optionally R2_BROWSER_ORIGIN). Only the empty test HTML is fulfilled locally: backend and R2 traffic are real. Initialization, signed PUT and completion use page fetch; CDP requires successful actual R2 OPTIONS responses. It verifies image/video/reel content, MIME, size, owner and DB status, invalid inputs, unauthorized calls, signed URL tampering/expiry/wrong keys, and deletion. No seeded ready-record fallback is allowed. Additional explicitly injected recovery cases are separate from successful initialization coverage.

Deletion revokes application access first and returns 202 while a PUT could recreate the object. The test advances only its isolated record's expiry before running cleanup. Production cleanup must wait for actual expiry plus skew; already issued signed downloads remain valid until expiry or object removal. Reports must not describe the test's artificial expiry as a real five-minute wait.

## Migration command and safety

`npm run migrate:media -- --dry-run` (also the default without flags) inventories paginated image/video/raw Cloudinary originals of upload/private/authenticated delivery types. Restricted sources are reported as skipped. Each destination key hashes cloud/resource type/delivery type/asset ID/version. HEAD checks detect R2 conflicts; duplicate source identities and source issues are reported. Destination failures make the process fail, never report a successful inventory. Dry-run uses only source listing and destination HEAD requests: no remote writes, deletes, journal writes, downloads or database connection. JSON output includes totals and per-asset destination keys; save stdout if a durable inventory is needed.

Execution is implemented but **was not run**. It requires all of:

- `--execute --confirm --journal PATH`, without --dry-run.
- MEDIA_MIGRATION_EXECUTE=true and MEDIA_MIGRATION_BUCKET_CONFIRM matching R2_BUCKET.
- A staging/test destination, a staging/test CLOUDINARY_FOLDER_PREFIX, and MEDIA_MIGRATION_SOURCE_CONFIRM matching that prefix. Execution only inventories that prefix.
- Private R2 configuration. NODE_ENV=production is refused entirely in this validation phase.

The explicit environment/flag/confirmation pattern follows the project's reconciliation command. Production migration remains unavailable. Originals are never deleted. There is no database metadata update phase; therefore no duplicate media records or partial DB migration can occur. Database failure handling is inapplicable until a separately reviewed metadata update phase is implemented.

Execution streams source bytes to a restricted temporary file with timeout and size bound, uploads with If-None-Match, downloads the destination for SHA-256 and size verification, then atomically saves a verified journal entry. Intent is saved before upload; retries/resumes verify an already claimed object instead of overwriting it. Unclaimed destinations conflict. Failures remain retryable; checksum mismatches never update metadata. Temporary files are removed. A lock prevents concurrent use of one journal; after an abrupt process kill, verify that no migration process is running before manually removing its stale `.lock`. Journal write failures stop execution. Copy verification, read-only behavior, conflicts, safeguards and failure/resume paths have local tests.

No execute, production provider switch, deployment or Cloudinary deletion was performed. Stop here until the bucket privacy and CORS prerequisites are resolved.
