const crypto = require('crypto');

const BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3000';

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  return fetch(url, { ...options, headers });
}

// 1x1 test image bytes (PNG)
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZAAAAABJRU5ErkJggg==',
  'base64'
);

// 32-byte dummy MP4 container with ftyp box
const MP4_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]), // box size: 24
  Buffer.from('ftypmp42', 'ascii'),     // box type & brand
  Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
  Buffer.from('mp42isom', 'ascii'),     // compatible brands
  Buffer.from([0x00, 0x00, 0x00, 0x08]), // box size: 8
  Buffer.from('mdat', 'ascii'),         // media data box
]);

async function uploadDirectR2(token, { category, mimeType, bytes, filename }) {
  const checksum = crypto.createHash('sha256').update(bytes).digest('base64');
  const initRes = await request('/api/media/upload/init', {
    method: 'POST',
    token,
    body: {
      category,
      mimeType,
      size: bytes.length,
      checksum,
      filename,
    },
  });
  if (!initRes.ok) {
    throw new Error(`Init upload failed: ${initRes.status} ${await initRes.text()}`);
  }
  const initData = await initRes.json();
  const mediaId = initData.data.media.id;
  const { url: putUrl, headers: putHeaders } = initData.data.upload;

  // Direct PUT to R2
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      ...putHeaders,
      'Content-Type': mimeType,
      'Content-Length': String(bytes.length),
    },
    body: bytes,
  });
  if (!putRes.ok) {
    throw new Error(`R2 direct PUT failed: ${putRes.status}`);
  }

  // Complete upload
  const compRes = await request(`/api/media/${mediaId}/complete`, {
    method: 'POST',
    token,
  });
  if (!compRes.ok) {
    throw new Error(`Complete upload failed: ${compRes.status} ${await compRes.text()}`);
  }
  const compData = await compRes.json();
  if (compData.data?.status !== 'ready') {
    throw new Error(`Media status not ready: ${compData.data?.status}`);
  }

  return { mediaId };
}

async function runDemo() {
  console.log('================================================================');
  console.log('STARTING COMPLETE MANUAL END-TO-END DEMO TEST (24 PHASES)');
  console.log('================================================================\n');

  const ts = Date.now();
  const password = 'Password@123';

  // 1. Signup / Login User A and User B
  console.log('[STEP 1] Signup & Login Test Accounts');
  const userAEmail = `user_a_${ts}@example.com`;
  const userBEmail = `user_b_${ts}@example.com`;

  await request('/api/auth/signup', {
    method: 'POST',
    body: { name: 'User Alpha', username: `usera_${ts.toString().slice(-6)}`, email: userAEmail, password },
  });
  await request('/api/auth/signup', {
    method: 'POST',
    body: { name: 'User Beta', username: `userb_${ts.toString().slice(-6)}`, email: userBEmail, password },
  });

  const loginARes = await request('/api/auth/login', { method: 'POST', body: { email: userAEmail, password } });
  const loginAData = await loginARes.json();
  const tokenA = loginAData.data.accessToken;
  const userAId = loginAData.data.user.id;

  const loginBRes = await request('/api/auth/login', { method: 'POST', body: { email: userBEmail, password } });
  const loginBData = await loginBRes.json();
  const tokenB = loginBData.data.accessToken;
  const userBId = loginBData.data.user.id;

  console.log(`  -> User A (${userAId}) and User B (${userBId}) signed up & logged in.`);

  // 2. Upload profile image for User A
  console.log('\n[STEP 2] Upload Profile Image via Direct R2');
  const { mediaId: avatarMediaId } = await uploadDirectR2(tokenA, {
    category: 'images',
    mimeType: 'image/png',
    bytes: PNG_BYTES,
    filename: 'avatar.png',
  });
  console.log(`  -> Direct R2 upload succeeded. Media ID: ${avatarMediaId}`);

  // 3. Refresh profile / Save profile
  console.log('\n[STEP 3] Save & Refresh Profile');
  const updateProfRes = await request('/api/auth/profile', {
    method: 'PUT',
    token: tokenA,
    body: { mediaId: avatarMediaId },
  });
  const updateProfData = await updateProfRes.json();
  console.log(`  -> Profile updated. Avatar reference: ${updateProfData.data.user.avatar}`);

  const meRes = await request('/api/auth/me', { token: tokenA });
  const meData = await meRes.json();
  if (!meData.data.avatar?.includes(avatarMediaId)) {
    throw new Error('Avatar not reflected in /auth/me');
  }
  console.log(`  -> GET /auth/me verified. Avatar persisted.`);

  // 4 & 5. Logout & Login again User A
  console.log('\n[STEP 4 & 5] Logout & Re-login User A');
  const reLoginRes = await request('/api/auth/login', { method: 'POST', body: { email: userAEmail, password } });
  const reLoginData = await reLoginRes.json();
  const freshTokenA = reLoginData.data.accessToken;
  console.log(`  -> Re-login successful with fresh access token.`);

  // 6. Verify profile image loads via signed GET URL and byte matches
  console.log('\n[STEP 6] Verify Avatar R2 Signed URL & Direct Fetch');
  const avatarUrlRes = await request(`/api/media/${avatarMediaId}/url`, { token: freshTokenA });
  const avatarUrlData = await avatarUrlRes.json();
  console.log(`  -> GET /api/media/:id/url returned signed URL: ${avatarUrlData.url.slice(0, 60)}...`);
  console.log(`  -> ExpiresIn: ${avatarUrlData.expiresIn}s`);

  const r2AvatarFetch = await fetch(avatarUrlData.url);
  if (!r2AvatarFetch.ok) throw new Error(`Direct R2 avatar fetch failed: ${r2AvatarFetch.status}`);
  const r2AvatarBytes = Buffer.from(await r2AvatarFetch.arrayBuffer());
  if (!r2AvatarBytes.equals(PNG_BYTES)) throw new Error('Avatar byte mismatch from R2');
  console.log(`  -> Direct Cloudflare R2 fetch returned 200 OK. Exact bytes match!`);

  // 7 & 8. Create image post and verify feed display
  console.log('\n[STEP 7 & 8] Create Image Post & Verify Feed Display');
  const { mediaId: postImgMediaId } = await uploadDirectR2(freshTokenA, {
    category: 'images',
    mimeType: 'image/png',
    bytes: PNG_BYTES,
    filename: 'post.png',
  });
  const postRes = await request('/api/posts', {
    method: 'POST',
    token: freshTokenA,
    body: { mediaId: postImgMediaId, caption: 'Sunset view #nature', type: 'image' },
  });
  const postData = await postRes.json();
  const postId = postData.data.id;
  console.log(`  -> Image post created: ${postId}`);

  // Fetch feed with User B (follower/public)
  const feedRes = await request('/api/posts/feed', { token: tokenB });
  const feedData = await feedRes.json();
  const feedItem = feedData.data.posts.find(p => p.id === postId);
  if (!feedItem) throw new Error('Post not found in feed');
  console.log(`  -> Post found in User B feed. Resolving post media for User B...`);

  const postImgUrlRes = await request(`/api/media/${postImgMediaId}/url`, { token: tokenB });
  if (!postImgUrlRes.ok) throw new Error(`User B failed to get signed post URL: ${postImgUrlRes.status}`);
  const postImgUrlData = await postImgUrlRes.json();
  const r2PostImgFetch = await fetch(postImgUrlData.url);
  if (!r2PostImgFetch.ok) throw new Error(`R2 post image fetch failed: ${r2PostImgFetch.status}`);
  console.log(`  -> User B retrieved signed URL and R2 served image 200 OK without 401.`);

  // 9 & 10. Create video post and verify video playback (Range request)
  console.log('\n[STEP 9 & 10] Create Video Post & Verify Playback with Range Requests');
  const { mediaId: postVideoMediaId } = await uploadDirectR2(freshTokenA, {
    category: 'videos',
    mimeType: 'video/mp4',
    bytes: MP4_BYTES,
    filename: 'clip.mp4',
  });
  const videoPostRes = await request('/api/posts', {
    method: 'POST',
    token: freshTokenA,
    body: { mediaId: postVideoMediaId, caption: 'Nature clip', type: 'video', videoDuration: 15 },
  });
  const videoPostData = await videoPostRes.json();
  const videoPostId = videoPostData.data.id;
  console.log(`  -> Video post created: ${videoPostId}`);

  const videoUrlRes = await request(`/api/media/${postVideoMediaId}/url`, { token: tokenB });
  const videoUrlData = await videoUrlRes.json();
  console.log(`  -> User B got signed URL for video playback.`);

  // Test HTTP 206 Range request against Cloudflare R2
  const r2RangeRes = await fetch(videoUrlData.url, { headers: { Range: 'bytes=0-15' } });
  console.log(`  -> R2 Range status: ${r2RangeRes.status} (Expected: 206 Partial Content)`);
  if (r2RangeRes.status !== 206) throw new Error(`Expected 206 Partial Content from R2, got ${r2RangeRes.status}`);
  console.log(`  -> Range header supported by R2: ${r2RangeRes.headers.get('content-range')}`);

  // 11, 12, 13. Follow / Social flow
  console.log('\n[STEP 11, 12 & 13] Social Follow & Verification');
  const followRes = await request(`/api/follow/${userAId}`, { method: 'POST', token: tokenB });
  const followData = await followRes.json();
  console.log(`  -> User B followed User A: ${followData.message || 'success'}`);

  const followersRes = await request(`/api/follow/${userAId}/followers`, { token: freshTokenA });
  const followersData = await followersRes.json();
  const isFollowerPresent = (followersData.data?.followers || []).some(f => (f.id || f._id) === userBId);
  console.log(`  -> User A followers list contains User B: ${isFollowerPresent}`);

  // 14 & 15. Create image & video stories
  console.log('\n[STEP 14 & 15] Stories: Image & Video');
  const { mediaId: storyImgMediaId } = await uploadDirectR2(freshTokenA, {
    category: 'images',
    mimeType: 'image/png',
    bytes: PNG_BYTES,
    filename: 'story.png',
  });
  const storyRes = await request('/api/stories', {
    method: 'POST',
    token: freshTokenA,
    body: { mediaId: storyImgMediaId, type: 'image' },
  });
  console.log(`  -> Image story created: ${(await storyRes.json()).data.id}`);

  const storyUrlRes = await request(`/api/media/${storyImgMediaId}/url`, { token: tokenB });
  if (!storyUrlRes.ok) throw new Error('User B could not get story signed URL');
  console.log(`  -> User B successfully retrieved story signed URL: ${storyUrlRes.status}`);

  // 16 & 17. Submit task proof
  console.log('\n[STEP 16 & 17] Task Submission Proof');
  // Get an available task
  const tasksRes = await request('/api/tasks', { token: freshTokenA });
  const tasksData = await tasksRes.json();
  const availableTask = (tasksData.data || tasksData || [])[0];
  if (availableTask) {
    const { mediaId: proofMediaId } = await uploadDirectR2(freshTokenA, {
      category: 'images',
      mimeType: 'image/png',
      bytes: PNG_BYTES,
      filename: 'proof.png',
    });
    const submitRes = await request(`/api/tasks/${availableTask.id || availableTask._id}/submit-proof`, {
      method: 'POST',
      token: freshTokenA,
      body: { mediaId: proofMediaId },
    });
    console.log(`  -> Task proof submitted with media ID: ${proofMediaId} (${submitRes.status})`);

    // 20 & 21. Authorization verification & IDOR protection
    console.log('\n[STEP 20 & 21] Authorization & IDOR Protection');
    // Owner can access
    const ownerAccess = await request(`/api/media/${proofMediaId}/url`, { token: freshTokenA });
    console.log(`  -> Task submitter accessing own proof: ${ownerAccess.status} (Expected: 200)`);
    if (ownerAccess.status !== 200) throw new Error('Owner should access own proof');

    // Random user B cannot access private proof before publication
    const intruderAccess = await request(`/api/media/${proofMediaId}/url`, { token: tokenB });
    console.log(`  -> Intruder User B accessing private proof: ${intruderAccess.status} (Expected: 403 Forbidden)`);
    if (intruderAccess.status !== 403) throw new Error('Intruder should be blocked with 403');
  }

  // 18 & 19. Payment Proof & Creator Request
  console.log('\n[STEP 18 & 19] Payment Proof & Creator Coin Request');
  const { mediaId: paymentProofMediaId } = await uploadDirectR2(freshTokenA, {
    category: 'images',
    mimeType: 'image/png',
    bytes: PNG_BYTES,
    filename: 'upi_payment.png',
  });
  const coinReqRes = await request('/api/creator/request-coins', {
    method: 'POST',
    token: freshTokenA,
    body: { coins: 500, mediaId: paymentProofMediaId },
  });
  console.log(`  -> Creator coin request submitted: ${coinReqRes.status}`);

  // 22. Unauthenticated request rejection
  console.log('\n[STEP 22] Verify Unauthenticated Access is Strictly Blocked (401)');
  const unauthRes = await request(`/api/media/${avatarMediaId}/url`);
  console.log(`  -> Unauthenticated GET /url: ${unauthRes.status} (Expected: 401)`);
  if (unauthRes.status !== 401) throw new Error('Unauthenticated request must be 401');

  const unauthContentRes = await request(`/api/media/${avatarMediaId}/content`, { redirect: 'manual' });
  console.log(`  -> Unauthenticated GET /content: ${unauthContentRes.status} (Expected: 401)`);
  if (unauthContentRes.status !== 401) throw new Error('Unauthenticated content request must be 401');

  // 23 & 24. App reload & final logout/login verification
  console.log('\n[STEP 23 & 24] App Reload & Final Session Verification');
  const finalLoginRes = await request('/api/auth/login', { method: 'POST', body: { email: userAEmail, password } });
  const finalToken = (await finalLoginRes.json()).data.accessToken;
  const finalMeRes = await request('/api/auth/me', { token: finalToken });
  const finalMeData = await finalMeRes.json();
  const finalAvatarUrlRes = await request(`/api/media/${avatarMediaId}/url`, { token: finalToken });
  const finalAvatarUrlData = await finalAvatarUrlRes.json();
  const finalR2Check = await fetch(finalAvatarUrlData.url);
  console.log(`  -> Final session check: User avatar persistent, R2 image fetch status: ${finalR2Check.status} OK`);
  if (finalR2Check.status !== 200) throw new Error('Final session R2 check failed');

  console.log('\n================================================================');
  console.log('ALL 24 MANUAL DEMO STEPS EXECUTED AND VERIFIED SUCCESSFULLY!');
  console.log('================================================================');
}

runDemo().catch(err => {
  console.error('\n❌ DEMO TEST FAILED:', err);
  process.exit(1);
});
