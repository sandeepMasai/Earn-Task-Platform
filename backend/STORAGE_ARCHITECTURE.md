# Media storage preparation — 2026-09-28

Cloudinary remains the default. Existing production assets, URLs and database records are not migrated or rewritten. R2 is implemented but **live R2 acceptance is BLOCKED** until dedicated private staging/test credentials are available. This phase does not certify capacity for any user-count target.

## Components

- `src/services/storage/storage.service.js` provides upload, delete, getUrl, exists and getMetadata; supplementary methods support direct uploads, bounded signature inspection and legacy URL deletion.
- `cloudinary.provider.js` preserves the existing uploader and deletion utilities. Stored public IDs continue to determine deletion identity. Legacy URL deletion retains its prior parsing behavior.
- `r2.provider.js` uses AWS SDK v3 S3 commands and presigning against the configured Cloudflare account endpoint. Dependencies added: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- `config.js`, `storage.errors.js`, `mediaPolicy.js` validate provider selection, environment settings, safe keys, content types and limits; provider error payloads are suppressed.
- Existing embedded media metadata can additionally hold provider, storageKey, MIME, size, format, secureUrl and version. Legacy records without provider continue to mean Cloudinary; no identifier is invented or backfilled.
- `src/models/Media.js` stores owner, opaque media ID, key, metadata, checksum, expiry and lifecycle only. No file bytes are stored in MongoDB. The unique provider/key index prevents duplicate identity; status/expiry index supports explicit cleanup. No automatic TTL deletion can orphan object storage.
- `src/controllers/mediaController.js` and `src/routes/mediaRoutes.js` implement authenticated direct upload and private media access. Post deletion and multipart middleware now call the storage abstraction.

## Configuration

Keep the production default:

```dotenv
MEDIA_STORAGE_PROVIDER=cloudinary
CLOUDINARY_FOLDER_PREFIX=earn-task-platform/production
```

For an isolated staging environment, keep images on Cloudinary and enable R2 originals selectively:

```dotenv
MEDIA_STORAGE_PROVIDER=cloudinary
MEDIA_STORAGE_PROVIDER_VIDEOS=r2
MEDIA_STORAGE_PROVIDER_REELS=r2
MEDIA_STORAGE_PROVIDER_DOCUMENTS=r2
CLOUDINARY_FOLDER_PREFIX=earn-task-platform/staging
R2_ACCOUNT_ID=<configure securely>
R2_ACCESS_KEY_ID=<configure securely>
R2_SECRET_ACCESS_KEY=<configure securely>
R2_BUCKET=app-media-staging
R2_PRIVATE_BUCKET=true
R2_PUBLIC_BASE_URL=
```

`MEDIA_STORAGE_PROVIDER=r2` selects R2 for every category. Category overrides also support `MEDIA_STORAGE_PROVIDER_IMAGES`. Invalid provider names or missing selected-R2 credentials fail startup. Credentials must be scoped to the dedicated bucket. `R2_PRIVATE_BUCKET=true` is an operator assertion, not an API audit of bucket ACLs: disable public r2.dev/custom-domain delivery and verify bucket policy independently. Private direct-upload initialization rejects a configured public base URL so unvalidated content is not intentionally published through the application. `R2_PUBLIC_BASE_URL` is validated configuration reserved for future public/CDN delivery, not used to bypass ownership checks.

No environment credentials were changed by this implementation. No production provider was switched.

## Direct upload contract

All routes are under `/api/media` and require a valid active-account access token. Responses containing signed URLs use `Cache-Control: no-store`.

1. `POST /upload/init` with JSON `category`, `mimeType`, integer `size` in bytes, and base64 SHA-256 `checksum` of the file. The client computes the checksum before requesting an upload. Filenames are not accepted as keys.
2. Receive an opaque media ID, a PUT URL, required headers and five-minute expiry. Upload bytes directly to that URL. Do not send the application bearer token to storage. Browsers set Content-Length from the Blob; do not use an indeterminate/chunked request body.
3. `POST /:id/complete` after successful upload. Backend checks stored size/MIME and reads at most 8 KiB for a signature check; it never buffers the full video. Pending/expired/rejected media cannot be downloaded through the API.
4. `GET /:id` returns application metadata; `GET /:id/download` issues a five-minute, attachment-disposition direct GET URL for a ready object owned by the caller.
5. `DELETE /:id` revokes application access first. Before upload expiry it returns 202; physical deletion is deferred so a still-valid PUT URL cannot recreate the object. After expiry it deletes the exact recorded key. Repeated deletion is safe; a storage failure leaves an inaccessible retryable `deleting` state.

Categories/limits: JPEG/PNG/WebP images 10 MiB; PDF documents 20 MiB; MP4/WebM videos 512 MiB; MP4/WebM reels 100 MiB. Legacy Cloudinary multipart types/limits remain unchanged. Direct-video limits bound a single PUT; multipart/resumable direct uploads are a future phase.

Keys look like `originals/videos/<random-namespace>/<year>/<month>/<uuid>.mp4`. Internal user IDs and client filenames are absent. Ownership exists in MongoDB, not in a client-supplied path. Users cannot submit arbitrary keys for deletion/download, mutate another user's metadata, or finalize another user's upload.

PUT signatures bind Content-Type, Content-Length, SHA-256 checksum and `If-None-Match: *`. The checksum plus write-once condition protect validation from content replacement while the URL is valid. Offline signing tests verify these signed headers; **real R2 enforcement of size/checksum/expiry/write-once still requires the blocked integration run**. Signed URLs are bearer capabilities until expiry: a caller can share one, and a previously issued GET can remain valid briefly after application access is revoked. Never log signed URLs. MIME signatures are not malware scanning or proof of benign file contents.

Cloudflare documents direct PUT/GET signing and MIME binding at [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/); compatibility of conditional operations is documented in [R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

## Existing application compatibility

Existing Cloudinary multipart uploads and existing media URLs continue unchanged. When a category is switched to R2, its old multipart endpoint returns a clear direct-upload-required error rather than proxying large media. New R2 records use the media API; **Android/web upload screens and post/story attachment-by-media-ID integration are not implemented in this phase**. Do not switch a deployed client category until that client adopts the direct flow. Private media sharing/feed access policies also require a later explicit design; the current download endpoint deliberately permits the owner only.

No wallet/reward/watch transaction logic was changed. No external network calls were moved into financial transactions.

## Cleanup and operations

Schedule `MEDIA_CLEANUP_ENABLED=true npm run media:cleanup` only in the intended environment after reviewing its MongoDB and R2 settings. The script never runs on application startup. Each batch considers at most 100 expired pending/rejected/deleting records, waits one minute past upload expiry, marks them inaccessible, deletes only recorded keys, then marks them deleted. Failed operations are retryable. Ready assets are never selected. No bucket-wide delete/list operation is used. Monitor stuck records and quota growth; application-level per-user media quotas, lifecycle-policy automation and distributed cleanup scheduling remain future work.

Storage logs contain provider, operation, success, duration and generated request ID. They exclude filenames, keys, signed URLs, tokens, credentials and provider error payloads. Initialization/completion/download/deletion share the route's request ID through provider operations. Correlate it with `X-Request-ID`.

## Test commands and results

```sh
npm test
CLOUDINARY_INTEGRATION_TEST=true npm run test:cloudinary
R2_INTEGRATION_TEST=true R2_TEST_BUCKET_CONFIRM=app-media-staging npm run test:r2
R2_LOAD_TEST=true R2_TEST_BUCKET_CONFIRM=app-media-staging npm run test:storage-load
```

R2 tests require complete credentials, `R2_PRIVATE_BUCKET=true`, an empty public base URL, a bucket name containing a staging/test component, and exact test-bucket confirmation. Missing credentials produce explicitly BLOCKED skips, not evidence of success. The tests use only random `test/<uuid>/...` keys and always attempt cleanup, including after assertions fail. They test upload, exists, metadata, byte-for-byte direct retrieval, overwrite rejection, deletion and expired URLs.

The controlled R2 harness implements concurrency 10, 25 and 50 using tiny disposable objects. It records signing initialization, direct PUT and total p50/p95/p99, failures/error rate and process memory, and stops increasing concurrency on failure. It is **provider-only**: deployed API latency and large-video memory behavior are NOT TESTED. No load run occurred because credentials are missing. The direct architecture avoids routing video bodies through Express, but this does not substitute for measured end-to-end acceptance.

Local tests include every declared media route, unauthorized/blocked users, cross-user metadata/download/delete/complete denial, invalid categories/MIME/size/checksum, expiry, duplicate completion/delete, spoofed bytes, metadata mismatch, provider failure sanitation and retryable delete failures. Provider unit tests use synthetic nonfunctional signing fixtures and mock SDK transport, never real credentials. R2 bucket/auth/download/upload/delete failures are mocked coverage, not live R2 results.

Cloudinary live compatibility passed with disposable image and raw assets only under `earn-task-platform/test/<run-id>`; the test verified retrieval, identity and deletion and completed cleanup. Existing production media was not touched.

## Video processing architecture (not implemented)

Retain original objects under `originals/`. A future queue/worker can create separate `derived/<media-id>/<generation>/...` renditions (360p, 480p, 720p, 1080p) and HLS manifests, then update processingStatus/renditions after validation. No transcoder, queue, HLS packaging or CDN rollout was added. Never overwrite originals with generated outputs; store only metadata and keys in MongoDB. Duration remains optional worker-provided metadata, not a trusted client assertion.

## Migration

The executable read-only inventory is now `npm run migrate:media -- --dry-run`. See R2_STAGING_VALIDATION.md for current safety gates, resume behavior and validation results. Production migration and automatic Cloudinary deletion remain disabled. The plan below describes the later metadata/cutover phase, which is not implemented.

### Future metadata migration plan — do not execute

1. Export a read-only inventory of Cloudinary identity, URL, owner, resource type, size and references. Flag uncertain/missing identity for review instead of guessing.
2. Identify active references and decide the category-specific destination. Keep transformed images/thumbnails on Cloudinary where useful.
3. Copy selected originals into unique R2 keys using a resumable, auditable job. Retain original provider metadata and URLs.
4. Verify size and content checksum; do not treat multipart ETags as universal content checksums. Revalidate content delivery and permissions.
5. Update one record's provider/key using an idempotent reviewed migration operation only after verification. Keep a legacy URL fallback and rollback manifest.
6. Observe canary traffic and compare error/latency/cost and CDN behavior before widening the migration.
7. Only after retention, reference checks, verified backups and separate deletion approval may legacy assets be removed. Reverting code is not a substitute for a migration rollback plan.

No migration, inventory of production records, production URL change, deployment, commit or push was performed by this phase.

## Final acceptance report

| Area | Status | Evidence | Remaining issue |
| --- | --- | --- | --- |
| Storage abstraction | PASS | Existing multipart/deletion flows use provider service; regression and legacy-schema tests pass | Additional providers can extend the same contract |
| Cloudinary | PASS | Live disposable image/raw upload, retrieval and deletion passed; existing workflow tests pass | No production migration performed |
| R2 | BLOCKED | Provider implemented; SDK transport/signature/configuration unit tests pass | No configured R2 credentials or verified private test bucket; real R2 has not been contacted |
| Direct upload | PARTIAL | Authenticated init/complete APIs, signed constraints, bounded signature validation and HTTP tests pass | Real R2 and client adoption not verified |
| Direct download | PARTIAL | Owner-only ready-media endpoint, signed GET URL unit/HTTP tests pass | Real R2 retrieval blocked; shared-feed policy not implemented |
| Delete | PARTIAL | Stored-key deletion, deferred expiry handling and failure/retry tests pass | Live R2 deletion and scheduled cleanup operations unverified |
| Authorization | PASS | Cross-user complete/metadata/download/delete denied; unauthorized and blocked accounts rejected in HTTP tests | Staging deployment acceptance still required |
| Security | PARTIAL | Size/MIME/checksum/expiry/key validation, safe error tests and signed-header assertions pass | Real provider constraint enforcement, bucket ACL audit, malware scanning and quotas remain |
| Performance | BLOCKED | Guarded 10/25/50 provider harness created | R2 credentials missing; API/large-video memory measurements not run |
| Tests | PASS | npm test: 48 tests, 43 passed, 0 failed, 5 pre-existing social skips; 86 JavaScript syntax checks and diff whitespace check pass; Cloudinary live 1 passed | R2 integration separately reports 2 BLOCKED skips |
| Migration readiness | PARTIAL | Inventory/copy/checksum/canary/fallback/rollback plan documented | No inventory, copy, migration, production deletion or transcoding executed |

Overall phase acceptance is BLOCKED by real R2 verification. A passing mocked suite is not proof of R2 connectivity, permission scope or scale.
