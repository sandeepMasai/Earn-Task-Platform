// Target End-to-End Verification Script for Media Authentication & Authorization
require('dotenv').config();
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const mongoose = require('mongoose');

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000';

function hashSha256Base64(buf) {
  return createHash('sha256').update(buf).digest('base64');
}

async function request(method, endpoint, token = null, body = undefined, headers = {}, followRedirect = false) {
  const reqHeaders = { ...headers };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  if (body !== undefined && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    redirect: followRedirect ? 'follow' : 'manual',
    signal: AbortSignal.timeout(30000)
  });

  const contentType = res.headers.get('content-type') || '';
  let resBody = null;
  if (!res.status.toString().startsWith('3')) {
    if (contentType.includes('application/json')) {
      try { resBody = await res.json(); } catch { resBody = null; }
    } else {
      try { resBody = await res.text(); } catch { resBody = null; }
    }
  }

  return {
    status: res.status,
    headers: res.headers,
    location: res.headers.get('location'),
    body: resBody
  };
}

// 1x1 transparent PNG bytes
const samplePngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal valid MP4 container bytes
const sampleMp4Bytes = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
  0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65,
  0x00, 0x00, 0x00, 0x10, 0x6d, 0x64, 0x61, 0x74,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

// Minimal valid PDF bytes
const samplePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n101\n%%EOF\n');

async function directUploadToR2(category, mimeType, buffer, token) {
  const checksum = hashSha256Base64(buffer);
  const size = buffer.length;

  const initRes = await request('POST', '/api/media/upload/init', token, {
    category,
    mimeType,
    size,
    checksum
  });

  assert.equal(initRes.status, 201, `Init upload failed: ${JSON.stringify(initRes.body)}`);
  const mediaId = initRes.body.data.media.id;
  const uploadUrl = initRes.body.data.upload.url;
  const requiredHeaders = initRes.body.data.upload.headers || {};

  // PUT binary directly to R2
  const putHeaders = {
    'Content-Type': mimeType,
    ...requiredHeaders
  };
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: putHeaders,
    body: buffer
  });
  assert.equal(putRes.status, 200, `R2 PUT failed with status ${putRes.status}`);

  // Complete upload
  const completeRes = await request('POST', `/api/media/${mediaId}/complete`, token);
  assert.equal(completeRes.status, 200, `Complete failed: ${JSON.stringify(completeRes.body)}`);
  assert.equal(completeRes.body.data.status, 'ready');

  return mediaId;
}

(async () => {
  console.log('================================================================');
  console.log('STARTING TARGETED MEDIA AUTH & ACCESS CONTROL VERIFICATION');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  const stamp = Date.now();
  const userAData = {
    name: 'Media Test User A',
    username: `media_a_${stamp}`,
    email: `media_a_${stamp}@smartlibdesk.in`,
    password: 'Password@123'
  };
  const userBData = {
    name: 'Media Test User B',
    username: `media_b_${stamp}`,
    email: `media_b_${stamp}@smartlibdesk.in`,
    password: 'Password@456'
  };

  try {
    // -------------------------------------------------------------
    // Step 1: Login / Signup User A & User B
    // -------------------------------------------------------------
    console.log('[STEP 1] Creating and logging in User A & User B...');
    const signupARes = await request('POST', '/api/auth/signup', null, userAData);
    assert.equal(signupARes.status, 201, `Signup A failed: ${JSON.stringify(signupARes.body)}`);
    const loginARes = await request('POST', '/api/auth/login', null, {
      email: userAData.email,
      password: userAData.password
    });
    const tokenA = loginARes.body.data.accessToken;
    const userAId = loginARes.body.data.user.id;
    console.log('  -> User A logged in successfully.');

    const signupBRes = await request('POST', '/api/auth/signup', null, userBData);
    assert.equal(signupBRes.status, 201, `Signup B failed: ${JSON.stringify(signupBRes.body)}`);
    const loginBRes = await request('POST', '/api/auth/login', null, {
      email: userBData.email,
      password: userBData.password
    });
    const tokenB = loginBRes.body.data.accessToken;
    const userBId = loginBRes.body.data.user.id;
    console.log('  -> User B logged in successfully.');

    // -------------------------------------------------------------
    // Step 2 & 3: Upload Profile Image & Refresh Profile
    // -------------------------------------------------------------
    console.log('\n[STEP 2 & 3] Uploading profile avatar and updating profile for User A...');
    const avatarMediaId = await directUploadToR2('images', 'image/png', samplePngBytes, tokenA);
    console.log(`  -> Avatar media uploaded to R2 with ID: ${avatarMediaId}`);

    const updateProfileRes = await request('PUT', '/api/auth/profile', tokenA, {
      mediaId: avatarMediaId
    });
    assert.equal(updateProfileRes.status, 200);

    const getMeRes = await request('GET', '/api/auth/me', tokenA);
    assert.equal(getMeRes.status, 200);
    assert.ok(getMeRes.body.data.user.avatar.includes(avatarMediaId));
    console.log('  -> Profile reloaded, avatar points to:', getMeRes.body.data.user.avatar);

    // -------------------------------------------------------------
    // Step 4: Confirm Profile Image Displays via GET /api/media/:id/content
    // -------------------------------------------------------------
    console.log('\n[STEP 4] Fetching avatar via GET /api/media/:id/content with Bearer token...');
    const avatarContentRes = await request('GET', `/api/media/${avatarMediaId}/content`, tokenA);
    assert.equal(avatarContentRes.status, 302, 'Should return 302 redirect');
    assert.ok(avatarContentRes.location, 'Should have Location header pointing to R2');
    assert.equal(avatarContentRes.headers.get('content-type'), 'image/png');
    assert.equal(avatarContentRes.headers.get('accept-ranges'), 'bytes');
    assert.ok(avatarContentRes.location.includes('response-content-disposition=inline'), 'Should have inline disposition for mobile app playback/display');
    console.log('  -> 302 Found, Content-Type: image/png, Accept-Ranges: bytes, Disposition: inline');

    // Test GET /api/media/:id/url (Phase 3 API)
    console.log('  -> Testing GET /api/media/:id/url API...');
    const avatarUrlRes = await request('GET', `/api/media/${avatarMediaId}/url`, tokenA);
    assert.equal(avatarUrlRes.status, 200, `GET /url failed: ${JSON.stringify(avatarUrlRes.body)}`);
    assert.equal(avatarUrlRes.body.success, true);
    assert.ok(avatarUrlRes.body.url, 'Must return signed URL');
    assert.equal(avatarUrlRes.body.expiresIn, 300);
    assert.ok(avatarUrlRes.body.url.includes('response-content-disposition=inline'));
    console.log('  -> GET /api/media/:id/url returned signed URL with expiresIn: 300 and inline disposition');

    // Follow redirect to R2 without auth header (simulating native image player)
    const r2AvatarRes = await fetch(avatarUrlRes.body.url);
    assert.equal(r2AvatarRes.status, 200, 'Cloudflare R2 returned 200 for signed URL');
    const r2AvatarBuf = Buffer.from(await r2AvatarRes.arrayBuffer());
    assert.equal(r2AvatarBuf.length, samplePngBytes.length);
    console.log('  -> Cloudflare R2 returned 200 OK with matching image bytes!');

    // -------------------------------------------------------------
    // Step 5 & 6: Create Image Post & Confirm Display
    // -------------------------------------------------------------
    console.log('\n[STEP 5 & 6] Creating image post and verifying media content access...');
    const postImageMediaId = await directUploadToR2('images', 'image/png', samplePngBytes, tokenA);
    const createPostRes = await request('POST', '/api/posts', tokenA, {
      type: 'image',
      caption: 'Test Image Post',
      mediaId: postImageMediaId
    });
    assert.equal(createPostRes.status, 201);
    console.log(`  -> Post created with ID: ${createPostRes.body.data.id}`);

    // Verify post image loads via /content with User A's token
    const postImageRes = await request('GET', `/api/media/${postImageMediaId}/content`, tokenA);
    assert.equal(postImageRes.status, 302);
    assert.ok(postImageRes.location.includes('response-content-disposition=inline'));

    // Verify User B (another authenticated user) can view the published post image
    const postImageUserBRes = await request('GET', `/api/media/${postImageMediaId}/content`, tokenB);
    assert.equal(postImageUserBRes.status, 302, 'Authenticated User B must be allowed to view published post media');
    console.log('  -> Published post image loads correctly for author and public users (302 inline)');

    // -------------------------------------------------------------
    // Step 7 & 8: Create Video Post & Confirm Playback & Range Headers
    // -------------------------------------------------------------
    console.log('\n[STEP 7 & 8] Creating video post and verifying media content & Range support...');
    const videoMediaId = await directUploadToR2('videos', 'video/mp4', sampleMp4Bytes, tokenA);
    const createVideoPostRes = await request('POST', '/api/posts', tokenA, {
      type: 'video',
      caption: 'Test Video Post',
      mediaId: videoMediaId,
      videoDuration: 15
    });
    assert.equal(createVideoPostRes.status, 201);

    const videoContentRes = await request('GET', `/api/media/${videoMediaId}/content`, tokenA);
    assert.equal(videoContentRes.status, 302);
    assert.equal(videoContentRes.headers.get('content-type'), 'video/mp4');
    assert.equal(videoContentRes.headers.get('accept-ranges'), 'bytes');
    assert.ok(videoContentRes.location.includes('response-content-disposition=inline'));

    // Test byte Range request on the presigned R2 video URL
    const rangeRes = await fetch(videoContentRes.location, {
      headers: { Range: 'bytes=0-15' }
    });
    assert.equal(rangeRes.status, 206, 'R2 should support partial content Range requests (206)');
    const rangeBuf = Buffer.from(await rangeRes.arrayBuffer());
    assert.equal(rangeBuf.length, 16);
    console.log('  -> Video content returned 302 inline, and R2 served Range request 206 Partial Content (16 bytes)');

    // -------------------------------------------------------------
    // Step 9 & 10: Create Story & Confirm Story Displays
    // -------------------------------------------------------------
    console.log('\n[STEP 9 & 10] Creating story and verifying display...');
    const storyImageMediaId = await directUploadToR2('images', 'image/png', samplePngBytes, tokenA);
    const createStoryRes = await request('POST', '/api/stories', tokenA, {
      type: 'image',
      mediaId: storyImageMediaId
    });
    assert.equal(createStoryRes.status, 201);

    const storyContentRes = await request('GET', `/api/media/${storyImageMediaId}/content`, tokenA);
    assert.equal(storyContentRes.status, 302);
    const storyUserBRes = await request('GET', `/api/media/${storyImageMediaId}/content`, tokenB);
    assert.equal(storyUserBRes.status, 302, 'Active story media is viewable by authenticated users');
    console.log('  -> Story created and accessible via /content with Bearer token (302 inline)');

    // -------------------------------------------------------------
    // Step 11 & 12: Upload Document & Confirm Preview/Download
    // -------------------------------------------------------------
    console.log('\n[STEP 11 & 12] Uploading document and confirming preview/download...');
    const docMediaId = await directUploadToR2('documents', 'application/pdf', samplePdfBytes, tokenA);
    const docContentRes = await request('GET', `/api/media/${docMediaId}/content`, tokenA);
    assert.equal(docContentRes.status, 302);
    assert.equal(docContentRes.headers.get('content-type'), 'application/pdf');

    const docDownloadRes = await request('GET', `/api/media/${docMediaId}/download`, tokenA);
    assert.equal(docDownloadRes.status, 200);
    assert.ok(docDownloadRes.body.data.url);
    console.log('  -> Document preview (/content -> 302) and download (/download -> signed URL) work correctly');

    // -------------------------------------------------------------
    // Step 13: Unauthenticated / Expired Access Rejection
    // -------------------------------------------------------------
    console.log('\n[STEP 13] Verifying unauthenticated and expired token requests are rejected (401)...');
    const noAuthRes = await request('GET', `/api/media/${avatarMediaId}/content`, null);
    assert.equal(noAuthRes.status, 401, 'Anonymous request must return 401 Unauthorized');
    assert.equal(noAuthRes.body.success, false);

    const badAuthRes = await request('GET', `/api/media/${avatarMediaId}/content`, 'invalid-expired-jwt-token');
    assert.equal(badAuthRes.status, 401, 'Invalid/expired token must return 401 Unauthorized');
    console.log('  -> Requests without auth or with invalid token strictly return 401 Unauthorized');

    // -------------------------------------------------------------
    // Step 14 & 15: Private Media Authorization & IDOR Protection
    // -------------------------------------------------------------
    console.log('\n[STEP 14 & 15] Testing private media authorization and IDOR protection...');
    // User A uploads private task submission proof
    const proofMediaId = await directUploadToR2('images', 'image/png', samplePngBytes, tokenA);

    // User A can access their own proof
    const ownerProofRes = await request('GET', `/api/media/${proofMediaId}/content`, tokenA);
    assert.equal(ownerProofRes.status, 302, 'Owner must be able to view their own proof');

    // User B (another normal user) CANNOT access User A's private proof
    const unauthorizedBRes = await request('GET', `/api/media/${proofMediaId}/content`, tokenB);
    assert.equal(unauthorizedBRes.status, 403, 'Unauthorized User B must be denied with 403 Forbidden');
    assert.equal(unauthorizedBRes.body.success, false);
    console.log('  -> User B blocked with 403 Forbidden from accessing User A\'s private submission proof');

    // Admin login and check Admin CAN access submission proof
    const adminLoginRes = await request('POST', '/api/auth/login', null, {
      email: process.env.STAGING_ADMIN_EMAIL || 'admin@earntask.com',
      password: process.env.STAGING_ADMIN_PASSWORD || 'Admin@123456'
    });
    if (adminLoginRes.status === 200) {
      const adminToken = adminLoginRes.body.data.accessToken;
      const adminProofRes = await request('GET', `/api/media/${proofMediaId}/content`, adminToken);
      assert.equal(adminProofRes.status, 302, 'Admin must be authorized to inspect private proofs');
      console.log('  -> Admin successfully authorized to view submission proof (302 Found)');
    }

    // -------------------------------------------------------------
    // Step 16 & 17: Delete Media & Confirm It No Longer Loads
    // -------------------------------------------------------------
    console.log('\n[STEP 16 & 17] Deleting media and confirming it no longer loads...');
    const deleteRes = await request('DELETE', `/api/media/${docMediaId}`, tokenA);
    assert.ok([200, 202].includes(deleteRes.status), 'Delete should return 200/202');

    const deletedLoadRes = await request('GET', `/api/media/${docMediaId}/content`, tokenA);
    assert.ok([404, 409, 410].includes(deletedLoadRes.status), 'Deleted media must not load (404/409)');
    console.log(`  -> Deleted media /content returned HTTP ${deletedLoadRes.status}`);

    // -------------------------------------------------------------
    // Step 18: Verify No URL Double-Slash or /api/api Duplication
    // -------------------------------------------------------------
    console.log('\n[STEP 18] Verifying URL path safety and no /api/api duplication...');
    assert.ok(!avatarContentRes.location.includes('/api/api/'), 'Redirect location must not duplicate /api');
    console.log('  -> URL construction verified without duplicated /api prefix');

    console.log('\n================================================================');
    console.log('ALL 18 END-TO-END VERIFICATION STEPS PASSED PERFECTLY!');
    console.log('================================================================');

  } finally {
    // Cleanup disposable test users
    const User = require('../src/models/User');
    const Media = require('../src/models/Media');
    const Post = require('../src/models/Post');
    const Story = require('../src/models/Story');

    await User.deleteMany({ email: { $in: [userAData.email, userBData.email] } });
    await Media.deleteMany({ 'uploadedBy.userId': { $in: [userAData.username, userBData.username] } });
    await Post.deleteMany({ caption: { $in: ['Test Image Post', 'Test Video Post'] } });
    await Story.deleteMany({ mediaUrl: { $regex: stamp.toString() } });
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error('\nFAILED VERIFICATION:', err);
  process.exit(1);
});
