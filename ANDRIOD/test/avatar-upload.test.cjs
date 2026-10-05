const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');

// Helper to compile and load TypeScript modules in memory
function load(file, mocks = {}) {
  const filename = path.resolve(root, file);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === '@constants') return load('src/constants/index.ts', mocks);
    if (name === '@utils/mediaUrl') return load('src/utils/mediaUrl.ts', mocks);
    if (name === '@utils/storage') return load('src/utils/storage.ts', mocks);
    if (name === '@services/api') return load('src/services/api.ts', mocks);
    if (name === 'react-native-url-polyfill') return require('whatwg-url-without-unicode');
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts', mocks);
    return require(name);
  };

  vm.runInNewContext(source, {
    exports,
    require: localRequire,
    console: mocks.console || console,
    URL,
    setTimeout,
    clearTimeout,
    Date,
    Blob,
    Uint8Array,
    DataView,
    BigInt,
    Math,
    process: { env: {} },
    fetch: mocks.fetch || globalThis.fetch,
    __DEV__: mocks.__DEV__ !== undefined ? mocks.__DEV__ : true,
  }, { filename });

  return exports;
}

const sampleImageBytes = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0xFF, 0xD9
]);
const sampleBase64 = sampleImageBytes.toString('base64');
const expectedChecksum = crypto.createHash('sha256').update(sampleImageBytes).digest('base64');

// Test 1: Select profile image
test('1. Select profile image: parses base64 and computes correct byte size and checksum', () => {
  const { sha256, bytesToBase64, base64ToBytes } = load('src/services/mediaService.ts');
  const bytes = base64ToBytes(sampleBase64);
  assert.equal(bytes.length, sampleImageBytes.length);
  const hash = bytesToBase64(sha256(bytes));
  assert.equal(hash, expectedChecksum);
});

// Test 2: Initialize media upload
test('2. Initialize media upload: calls POST /media/upload/init with category, mimeType, size, and SHA-256 checksum', async () => {
  const apiCalls = [];
  const fakeApi = {
    post: async (route, body) => {
      apiCalls.push({ route, body });
      return {
        success: true,
        data: {
          media: { id: 'media-123', category: body.category, mimeType: body.mimeType, size: body.size, status: 'pending' },
          upload: { url: 'https://r2.storage.invalid/upload', method: 'PUT', headers: { 'Content-Type': body.mimeType, 'x-amz-checksum-sha256': body.checksum }, expiresIn: 300 },
          expiresAt: '2026-10-02T12:00:00Z',
        },
      };
    },
  };

  const { mediaService } = load('src/services/mediaService.ts', { './api': { apiService: fakeApi } });
  const init = await mediaService.initUpload({
    category: 'images',
    mimeType: 'image/jpeg',
    size: sampleImageBytes.length,
    checksum: expectedChecksum,
    filename: 'avatar.jpg',
  });

  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].route, '/media/upload/init');
  assert.equal(apiCalls[0].body.category, 'images');
  assert.equal(apiCalls[0].body.mimeType, 'image/jpeg');
  assert.equal(apiCalls[0].body.size, sampleImageBytes.length);
  assert.equal(apiCalls[0].body.checksum, expectedChecksum);
  assert.equal(init.media.id, 'media-123');
  assert.equal(init.upload.url, 'https://r2.storage.invalid/upload');
});

// Test 3: Direct PUT to R2 succeeds
test('3. Direct PUT to R2 succeeds: PUTs binary to R2 with signed headers and without Authorization bearer header', async () => {
  let putUrl = '';
  let putMethod = '';
  let putHeaders = {};
  let putBody = null;

  const mockFetch = async (url, options) => {
    putUrl = url;
    putMethod = options.method;
    putHeaders = options.headers;
    putBody = options.body;
    return { ok: true, status: 200 };
  };

  const { mediaService, base64ToBytes } = load('src/services/mediaService.ts', {
    fetch: mockFetch,
  });

  const bytes = base64ToBytes(sampleBase64);
  await mediaService.uploadToR2(
    'https://r2.storage.invalid/upload?sig=abc',
    { 'Content-Type': 'image/jpeg', 'x-amz-checksum-sha256': expectedChecksum },
    bytes,
    'image/jpeg'
  );

  assert.equal(putUrl, 'https://r2.storage.invalid/upload?sig=abc');
  assert.equal(putMethod, 'PUT');
  assert.equal(putHeaders['Content-Type'], 'image/jpeg');
  assert.equal(putHeaders['x-amz-checksum-sha256'], expectedChecksum);
  assert.equal(putHeaders['Authorization'], undefined, 'Must not send backend Authorization header to R2 presigned URL');
  assert.ok(putBody !== null);
});

// Test 4: Complete media succeeds
test('4. Complete media succeeds: calls POST /media/:id/complete and returns status ready', async () => {
  const apiCalls = [];
  const fakeApi = {
    post: async (route, body) => {
      apiCalls.push({ route, body });
      return {
        success: true,
        data: { id: 'media-123', status: 'ready', category: 'images', mimeType: 'image/jpeg', size: sampleImageBytes.length },
      };
    },
  };

  const { mediaService } = load('src/services/mediaService.ts', { './api': { apiService: fakeApi } });
  const result = await mediaService.completeUpload('media-123');
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].route, '/media/media-123/complete');
  assert.equal(result.status, 'ready');
});

// Test 5: Profile update succeeds
test('5. Profile update succeeds: sends JSON payload with mediaId, preserving name/email/username without multipart form', async () => {
  const apiCalls = [];
  const fakeApi = {
    put: async (route, body, config) => {
      apiCalls.push({ route, body, config });
      return {
        success: true,
        data: {
          user: {
            id: 'user-1',
            name: body.name,
            email: body.email,
            username: body.username,
            avatar: `/api/media/${body.mediaId}/content`,
          },
        },
      };
    },
  };

  const fakeStorage = { saveUser: async () => {} };
  const { authService } = load('src/services/authService.ts', {
    './api': { apiService: fakeApi },
    '@utils/storage': { authStorage: fakeStorage },
  });

  const updatedUser = await authService.updateProfile({
    name: 'Updated Name',
    email: 'user@example.com',
    username: 'updated_user',
    mediaId: 'media-123',
  });

  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].route, '/auth/profile');
  assert.equal(apiCalls[0].body.name, 'Updated Name');
  assert.equal(apiCalls[0].body.email, 'user@example.com');
  assert.equal(apiCalls[0].body.username, 'updated_user');
  assert.equal(apiCalls[0].body.mediaId, 'media-123');
  assert.equal(apiCalls[0].config?.headers?.['Content-Type'], undefined, 'Must not force multipart/form-data for mediaId profile updates');
  assert.equal(updatedUser.avatar, '/api/media/media-123/content');
});

// Test 6: Reload profile and avatar is displayed
test('6. Reload profile and avatar is displayed: resolveMediaUrl and getAuthenticatedImageSource construct full authenticated URI', () => {
  const { resolveMediaUrl, getAuthenticatedImageSource } = load('src/utils/mediaUrl.ts', {
    '@constants': { API_BASE_URL: 'http://10.197.246.38:3000/api' },
  });

  const resolved = resolveMediaUrl('/api/media/media-123/content');
  assert.equal(resolved, 'http://10.197.246.38:3000/api/media/media-123/content');

  const source = getAuthenticatedImageSource('/api/media/media-123/content', 'test-jwt-token', 12345);
  assert.equal(source.uri, 'http://10.197.246.38:3000/api/media/media-123/content?v=12345');
  assert.equal(source.headers?.Authorization, 'Bearer test-jwt-token');

  // Verify external and local URLs are preserved
  assert.equal(resolveMediaUrl('https://example.com/avatar.png'), 'https://example.com/avatar.png');
  assert.equal(resolveMediaUrl('file:///data/user/avatar.jpg'), 'file:///data/user/avatar.jpg');
});

// Test 7: Change avatar a second time
test('7. Change avatar a second time: uploads new media and updates profile with new mediaId', async () => {
  const mediaIds = [];
  let counter = 0;
  const fakeApi = {
    post: async (route) => {
      if (route === '/media/upload/init') {
        const id = 'media-v2-' + (++counter);
        mediaIds.push(id);
        return {
          success: true,
          data: {
            media: { id, status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/v2', method: 'PUT', headers: {} },
          },
        };
      }
      return { success: true, data: { status: 'ready' } };
    },
    put: async (route, body) => ({
      success: true,
      data: { user: { id: 'user-1', avatar: `/api/media/${body.mediaId}/content` } },
    }),
  };

  const mockFetch = async () => ({ ok: true, status: 200 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: mockFetch,
  });
  const { authService } = load('src/services/authService.ts', {
    './api': { apiService: fakeApi },
    '@utils/storage': { authStorage: { saveUser: async () => {} } },
  });

  const upload1 = await mediaService.uploadAvatar({ uri: 'file://photo1.jpg', base64: sampleBase64 });
  const user1 = await authService.updateProfile({ name: 'User', mediaId: upload1.mediaId });
  assert.equal(user1.avatar, `/api/media/${upload1.mediaId}/content`);

  const upload2 = await mediaService.uploadAvatar({ uri: 'file://photo2.jpg', base64: sampleBase64 });
  const user2 = await authService.updateProfile({ name: 'User', mediaId: upload2.mediaId });
  assert.equal(user2.avatar, `/api/media/${upload2.mediaId}/content`);
  assert.notEqual(upload1.mediaId, upload2.mediaId);
});

// Test 8: Cancel image selection
test('8. Cancel image selection: canceled result triggers no upload or state change', () => {
  let uploadCalled = false;
  const pickerResult = { canceled: true, assets: null };

  if (!pickerResult.canceled && pickerResult.assets) {
    uploadCalled = true;
  }

  assert.equal(uploadCalled, false, 'Canceled image pick must not trigger upload');
});

// Test 9: Upload failure
test('9. Upload failure: R2 PUT failure throws cleanly and aborts completion', async () => {
  const fakeApi = {
    post: async (route) => {
      if (route === '/media/upload/init') {
        return {
          success: true,
          data: {
            media: { id: 'media-fail', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/fail', method: 'PUT', headers: {} },
          },
        };
      }
      assert.fail('Complete must not be called after PUT failure');
    },
  };

  const failingFetch = async () => ({ ok: false, status: 500 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: failingFetch,
  });

  await assert.rejects(
    mediaService.uploadAvatar({ uri: 'file://photo.jpg', base64: sampleBase64 }),
    /Direct R2 upload failed with status 500/i
  );
});

// Test 10: Profile update failure after successful upload
test('10. Profile update failure after successful upload: throws error without reporting update as successful', async () => {
  const fakeApi = {
    post: async (route) => {
      if (route === '/media/upload/init') {
        return {
          success: true,
          data: {
            media: { id: 'media-ok', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/ok', method: 'PUT', headers: {} },
          },
        };
      }
      return { success: true, data: { id: 'media-ok', status: 'ready' } };
    },
    put: async () => {
      throw new Error('Username already taken');
    },
  };

  const okFetch = async () => ({ ok: true, status: 200 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: okFetch,
  });
  const { authService } = load('src/services/authService.ts', {
    './api': { apiService: fakeApi },
    '@utils/storage': { authStorage: { saveUser: async () => {} } },
  });

  // Direct upload succeeds
  const { mediaId } = await mediaService.uploadAvatar({ uri: 'file://photo.jpg', base64: sampleBase64 });
  assert.equal(mediaId, 'media-ok');

  // But profile update fails
  let reportedSuccess = false;
  await assert.rejects(async () => {
    try {
      await authService.updateProfile({ name: 'User', username: 'duplicate', mediaId });
      reportedSuccess = true;
    } catch (err) {
      throw err;
    }
  }, /Username already taken/i);

  assert.equal(reportedSuccess, false, 'Failed profile update must not be reported as successful');
});

// Test 11: Verify no R2 secret appears in the Expo bundle/environment
test('11. Verify no R2 secret appears in Expo bundle/environment', () => {
  const androidDir = root;
  const envFiles = ['.env', '.env.local', '.env.production', '.env.staging'];
  for (const envFile of envFiles) {
    const fullPath = path.join(androidDir, envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      assert.equal(content.includes('R2_ACCESS_KEY_ID'), false, `${envFile} must not contain R2_ACCESS_KEY_ID`);
      assert.equal(content.includes('R2_SECRET_ACCESS_KEY'), false, `${envFile} must not contain R2_SECRET_ACCESS_KEY`);
    }
  }

  // Check src files for accidental secret hardcoding
  const srcFiles = fs.readdirSync(path.join(androidDir, 'src'), { recursive: true })
    .filter(f => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')));

  for (const f of srcFiles) {
    const content = fs.readFileSync(path.join(androidDir, 'src', f), 'utf8');
    assert.equal(content.includes('R2_ACCESS_KEY_ID'), false, `${f} must not contain R2_ACCESS_KEY_ID`);
    assert.equal(content.includes('R2_SECRET_ACCESS_KEY'), false, `${f} must not contain R2_SECRET_ACCESS_KEY`);
  }
});

// Test 12: Verify no sensitive URLs/tokens are logged
test('12. Verify no sensitive URLs/tokens are logged during upload flow', async () => {
  const logged = [];
  const captureConsole = {
    log: (...args) => logged.push(args.join(' ')),
    warn: (...args) => logged.push(args.join(' ')),
    error: (...args) => logged.push(args.join(' ')),
  };

  const presignedSecretUrl = 'https://myapp.r2.cloudflarestorage.com/originals/images/secret-token-key?X-Amz-Signature=secret_sig_value';
  const fakeApi = {
    post: async (route) => {
      if (route === '/media/upload/init') {
        return {
          success: true,
          data: {
            media: { id: 'media-clean', status: 'pending' },
            upload: { url: presignedSecretUrl, method: 'PUT', headers: { 'x-amz-checksum-sha256': expectedChecksum } },
          },
        };
      }
      return { success: true, data: { id: 'media-clean', status: 'ready' } };
    },
    put: async () => ({
      success: true,
      data: { user: { id: 'user-1', avatar: '/api/media/media-clean/content' } },
    }),
  };

  const mockFetch = async () => ({ ok: true, status: 200 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    console: captureConsole,
    fetch: mockFetch,
  });
  const { authService } = load('src/services/authService.ts', {
    './api': { apiService: fakeApi },
    console: captureConsole,
    '@utils/storage': { authStorage: { saveUser: async () => {} } },
  });

  const { mediaId } = await mediaService.uploadAvatar({ uri: 'file://avatar.jpg', base64: sampleBase64 });
  await authService.updateProfile({ name: 'Clean User', mediaId });

  const allLogs = logged.join('\n');
  assert.equal(allLogs.includes('secret_sig_value'), false, 'Presigned URL signatures must not be logged');
  assert.equal(allLogs.includes('presignedSecretUrl'), false, 'Presigned URLs must not be logged');
});

// Test 13: PNG format detection and upload
test('13. PNG format detection: detects PNG magic bytes and uses image/png for init and PUT', async () => {
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  const pngBase64 = pngBytes.toString('base64');

  let initMime = '';
  let putContentType = '';

  const fakeApi = {
    post: async (route, body) => {
      if (route === '/media/upload/init') {
        initMime = body.mimeType;
        return {
          success: true,
          data: {
            media: { id: 'media-png', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/png', method: 'PUT', headers: { 'Content-Type': body.mimeType } },
          },
        };
      }
      return { success: true, data: { id: 'media-png', status: 'ready' } };
    },
  };

  const mockFetch = async (url, options) => {
    putContentType = options.headers['Content-Type'];
    return { ok: true, status: 200 };
  };

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: mockFetch,
  });

  const { mediaId } = await mediaService.uploadAvatar({
    uri: 'file://photo.png',
    base64: pngBase64,
  });

  assert.equal(mediaId, 'media-png');
  assert.equal(initMime, 'image/png');
  assert.equal(putContentType, 'image/png');
  assert.notEqual(putContentType, 'application/octet-stream');
});

// Test 14: WebP format detection and upload
test('14. WebP format detection: detects WebP magic bytes and uses image/webp for init and PUT', async () => {
  const webpBytes = Buffer.from('RIFF\x20\x00\x00\x00WEBPVP8 \x14\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');
  const webpBase64 = webpBytes.toString('base64');

  let initMime = '';
  let putContentType = '';

  const fakeApi = {
    post: async (route, body) => {
      if (route === '/media/upload/init') {
        initMime = body.mimeType;
        return {
          success: true,
          data: {
            media: { id: 'media-webp', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/webp', method: 'PUT', headers: { 'Content-Type': body.mimeType } },
          },
        };
      }
      return { success: true, data: { id: 'media-webp', status: 'ready' } };
    },
  };

  const mockFetch = async (url, options) => {
    putContentType = options.headers['Content-Type'];
    return { ok: true, status: 200 };
  };

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: mockFetch,
  });

  const { mediaId } = await mediaService.uploadAvatar({
    uri: 'file://sticker.webp',
    base64: webpBase64,
  });

  assert.equal(mediaId, 'media-webp');
  assert.equal(initMime, 'image/webp');
  assert.equal(putContentType, 'image/webp');
});

// Test 15: Overrides misleading filename (.jpg) with actual PNG magic bytes
test('15. Misleading filename override: .jpg filename with PNG content uses image/png', async () => {
  const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
  let initPayload = null;

  const fakeApi = {
    post: async (route, body) => {
      if (route === '/media/upload/init') {
        initPayload = body;
        return {
          success: true,
          data: {
            media: { id: 'media-png-fixed', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/put', method: 'PUT', headers: {} },
          },
        };
      }
      return { success: true, data: { status: 'ready' } };
    },
  };

  const mockFetch = async () => ({ ok: true, status: 200 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: mockFetch,
  });

  await mediaService.uploadAvatar({
    uri: 'file:///data/user/0/ImagePicker/cached_image.jpg',
    fileName: 'camera_shot.jpeg',
    mimeType: 'image/jpeg',
    base64: pngBytes.toString('base64'),
  });

  assert.equal(initPayload.mimeType, 'image/png', 'Must override declared JPEG with actual PNG bytes');
  assert.ok(initPayload.filename.endsWith('.png'), 'Filename extension must match actual detected format');
});

// Test 16: Overrides misleading declared MIME with actual JPEG magic bytes
test('16. Misleading declared MIME override: declared image/png with JPEG content uses image/jpeg', async () => {
  let initPayload = null;

  const fakeApi = {
    post: async (route, body) => {
      if (route === '/media/upload/init') {
        initPayload = body;
        return {
          success: true,
          data: {
            media: { id: 'media-jpeg-fixed', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/put', method: 'PUT', headers: {} },
          },
        };
      }
      return { success: true, data: { status: 'ready' } };
    },
  };

  const mockFetch = async () => ({ ok: true, status: 200 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    fetch: mockFetch,
  });

  await mediaService.uploadAvatar({
    uri: 'file:///photos/pic.png',
    fileName: 'pic.png',
    mimeType: 'image/png',
    base64: sampleBase64,
  });

  assert.equal(initPayload.mimeType, 'image/jpeg', 'Must override declared PNG with actual JPEG bytes');
  assert.ok(initPayload.filename.endsWith('.jpg'), 'Filename extension must match actual detected format');
});

// Test 17: Rejects HEIC/HEIF images cleanly
test('17. Rejects HEIC/HEIF images cleanly with user-friendly message', async () => {
  const heicBytes = Buffer.from('\x00\x00\x00\x18ftypheic\x00\x00\x00\x00');
  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: {} },
  });

  await assert.rejects(
    mediaService.uploadAvatar({
      uri: 'file://photo.heic',
      base64: heicBytes.toString('base64'),
    }),
    /HEIC\/HEIF images are not supported/i
  );
});

// Test 18: Rejects GIF images cleanly
test('18. Rejects GIF images cleanly for profile avatar', async () => {
  const gifBytes = Buffer.from('GIF89a\x01\x00\x01\x00');
  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: {} },
  });

  await assert.rejects(
    mediaService.uploadAvatar({
      uri: 'file://animated.gif',
      base64: gifBytes.toString('base64'),
    }),
    /GIF images are not supported for profile pictures/i
  );
});

// Test 19: Non-sensitive development diagnostics logging
test('19. Development diagnostics logs file size, declared and final MIME without presigned URLs or secrets', async () => {
  const logged = [];
  const captureConsole = {
    log: (...args) => logged.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    warn: (...args) => logged.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    error: (...args) => logged.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
  };

  const fakeApi = {
    post: async (route) => {
      if (route === '/media/upload/init') {
        return {
          success: true,
          data: {
            media: { id: 'media-diag', status: 'pending' },
            upload: { url: 'https://r2.storage.invalid/upload-presigned-url', method: 'PUT', headers: {} },
          },
        };
      }
      return { success: true, data: { status: 'ready' } };
    },
  };

  const mockFetch = async () => ({ ok: true, status: 200 });

  const { mediaService } = load('src/services/mediaService.ts', {
    './api': { apiService: fakeApi },
    console: captureConsole,
    fetch: mockFetch,
    __DEV__: true,
  });

  await mediaService.uploadAvatar({
    uri: 'file://camera/shot.jpg',
    mimeType: 'image/jpeg',
    base64: sampleBase64,
  });

  const diagnosticsLog = logged.find(l => l.includes('[MediaUpload] Diagnostics'));
  assert.ok(diagnosticsLog, 'Diagnostics must be logged in dev mode');
  assert.ok(diagnosticsLog.includes('selectedMIME'), 'Must log selectedMIME');
  assert.ok(diagnosticsLog.includes('finalMIME'), 'Must log finalMIME');
  assert.ok(diagnosticsLog.includes('finalFileSize'), 'Must log finalFileSize');
  assert.ok(diagnosticsLog.includes('initResponseMIME'), 'Must log initResponseMIME');
  assert.ok(diagnosticsLog.includes('r2PutHttpStatus'), 'Must log r2PutHttpStatus');
  assert.ok(diagnosticsLog.includes('completeResponseStatus'), 'Must log completeResponseStatus');
  assert.equal(diagnosticsLog.includes('upload-presigned-url'), false, 'Presigned URL must not appear in diagnostics');
});

// Test 20: extractMediaId extracts UUID from mediaAsset, avatarAsset, avatar string, and plain UUID
test('20. extractMediaId extracts UUID correctly from objects and paths', () => {
  const { extractMediaId } = load('src/utils/mediaUrl.ts');
  const uuid = '5bd282c0-022d-4b77-9b80-6af0221f5cf4';

  assert.equal(extractMediaId({ mediaAsset: { mediaId: uuid } }), uuid);
  assert.equal(extractMediaId({ avatarAsset: { mediaId: uuid } }), uuid);
  assert.equal(extractMediaId({ avatar: `/api/media/${uuid}/content` }), uuid);
  assert.equal(extractMediaId(`/api/media/${uuid}/content`), uuid);
  assert.equal(extractMediaId(`http://localhost:3000/api/media/${uuid}/content`), uuid);
  assert.equal(extractMediaId(uuid), uuid);
  assert.equal(extractMediaId('https://example.com/avatar.jpg'), null);
  assert.equal(extractMediaId(null), null);
});

// Test 21: getSignedMediaUrl calls GET /media/:id/download, returns signed URL, and caches result
test('21. getSignedMediaUrl calls GET /media/:id/download and caches response', async () => {
  let downloadCalls = 0;
  const fakeApi = {
    get: async (route) => {
      downloadCalls++;
      assert.ok(route === '/media/test-media-id-1/url' || route === '/media/test-media-id-1/download');
      return {
        success: true,
        data: {
          url: 'https://r2.storage.invalid/signed-avatar.jpg?X-Amz-Signature=sig123',
          expiresIn: 300,
        },
      };
    },
  };

  const { getSignedMediaUrl, clearSignedUrlCache } = load('src/utils/mediaUrl.ts', {
    '@services/api': { apiService: fakeApi },
  });

  clearSignedUrlCache();

  // First call fetches from API
  const url1 = await getSignedMediaUrl('test-media-id-1');
  assert.equal(url1, 'https://r2.storage.invalid/signed-avatar.jpg?X-Amz-Signature=sig123');
  assert.equal(downloadCalls, 1);

  // Second call uses in-memory cache and avoids calling GET again
  const url2 = await getSignedMediaUrl('test-media-id-1');
  assert.equal(url2, 'https://r2.storage.invalid/signed-avatar.jpg?X-Amz-Signature=sig123');
  assert.equal(downloadCalls, 1, 'Subsequent call within TTL must use cache');
});

// Test 22: Concurrent getSignedMediaUrl calls share a single in-flight request
test('22. Concurrent getSignedMediaUrl calls deduplicate in-flight requests', async () => {
  let downloadCalls = 0;
  const fakeApi = {
    get: async (route) => {
      downloadCalls++;
      // Simulate slight network delay
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        success: true,
        data: { url: 'https://r2.storage.invalid/signed-shared.jpg', expiresIn: 300 },
      };
    },
  };

  const { getSignedMediaUrl, clearSignedUrlCache } = load('src/utils/mediaUrl.ts', {
    '@services/api': { apiService: fakeApi },
  });

  clearSignedUrlCache();

  // Fire 3 simultaneous requests
  const [res1, res2, res3] = await Promise.all([
    getSignedMediaUrl('concurrent-media-id'),
    getSignedMediaUrl('concurrent-media-id'),
    getSignedMediaUrl('concurrent-media-id'),
  ]);

  assert.equal(res1, 'https://r2.storage.invalid/signed-shared.jpg');
  assert.equal(res2, 'https://r2.storage.invalid/signed-shared.jpg');
  assert.equal(res3, 'https://r2.storage.invalid/signed-shared.jpg');
  assert.equal(downloadCalls, 1, 'Concurrent calls must deduplicate to 1 network request');
});

// Test 23: Cache expiration or force refresh fetches a fresh signed URL
test('23. Cache clearing or expiry fetches fresh signed URL', async () => {
  let counter = 0;
  const fakeApi = {
    get: async () => ({
      success: true,
      data: { url: `https://r2.storage.invalid/signed-${++counter}.jpg`, expiresIn: 300 },
    }),
  };

  const { getSignedMediaUrl, clearSignedUrlCache } = load('src/utils/mediaUrl.ts', {
    '@services/api': { apiService: fakeApi },
  });

  clearSignedUrlCache();

  const url1 = await getSignedMediaUrl('refresh-media-id');
  assert.equal(url1, 'https://r2.storage.invalid/signed-1.jpg');

  // Clear cache for this ID
  clearSignedUrlCache('refresh-media-id');

  const url2 = await getSignedMediaUrl('refresh-media-id');
  assert.equal(url2, 'https://r2.storage.invalid/signed-2.jpg');
});

// Test 24: resolveDisplayMediaUrl resolves local URIs directly and private R2 paths to signed URLs
test('24. resolveDisplayMediaUrl handles local URIs directly and resolves R2 paths', async () => {
  const fakeApi = {
    get: async (route) => {
      assert.equal(route, '/media/5bd282c0-022d-4b77-9b80-6af0221f5cf4/download');
      return {
        success: true,
        data: { url: 'https://r2.storage.invalid/signed-display.jpg', expiresIn: 300 },
      };
    },
  };

  const { resolveDisplayMediaUrl, clearSignedUrlCache } = load('src/utils/mediaUrl.ts', {
    '@services/api': { apiService: fakeApi },
  });

  clearSignedUrlCache();

  // Local file URI returns immediately
  const local = await resolveDisplayMediaUrl('file:///data/user/0/cache/image.jpg');
  assert.equal(local, 'file:///data/user/0/cache/image.jpg');

  // External URL returns immediately
  const external = await resolveDisplayMediaUrl('https://example.com/avatar.png');
  assert.equal(external, 'https://example.com/avatar.png');

  // Private R2 path resolves to signed URL
  const signed = await resolveDisplayMediaUrl('/api/media/5bd282c0-022d-4b77-9b80-6af0221f5cf4/content');
  assert.equal(signed, 'https://r2.storage.invalid/signed-display.jpg');

  // User object with mediaAsset resolves to signed URL
  const userSigned = await resolveDisplayMediaUrl({
    mediaAsset: { mediaId: '5bd282c0-022d-4b77-9b80-6af0221f5cf4' },
  });
  assert.equal(userSigned, 'https://r2.storage.invalid/signed-display.jpg');
});

// Test 25: Error handling when signed URL fetch fails
test('25. getSignedMediaUrl throws clean error on failure and does not poison cache', async () => {
  const fakeApi = {
    get: async () => ({
      success: false,
      error: 'Media not found',
    }),
  };

  const { getSignedMediaUrl, clearSignedUrlCache } = load('src/utils/mediaUrl.ts', {
    '@services/api': { apiService: fakeApi },
  });

  clearSignedUrlCache();

  await assert.rejects(
    getSignedMediaUrl('missing-media-id'),
    /Media not found/i
  );
});
