const test = require('node:test');
const assert = require('node:assert/strict');

// Replicate mediaUrl logic for node test verification
const API_BASE_URL = 'http://192.168.1.12:3000/api';

function getApiOrigin(apiUrl = API_BASE_URL) {
  try {
    const url = new URL(apiUrl.startsWith('http') ? apiUrl : `http://${apiUrl}`);
    return url.origin;
  } catch {
    return 'http://localhost:3000';
  }
}

function isInternalBackendMediaUrl(url, apiUrl = API_BASE_URL) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return false;
  }
  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('/api/media/') || trimmed.startsWith('/media/');
  }
  try {
    const parsed = new URL(trimmed);
    const backendOrigin = getApiOrigin(apiUrl);
    const backendHost = new URL(backendOrigin).host;
    if (parsed.host === backendHost) {
      return parsed.pathname.includes('/media/');
    }
  } catch {
    return trimmed.includes('/media/');
  }
  return false;
}

function resolveMediaUrl(path, apiUrl = API_BASE_URL) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    const base = apiUrl.replace(/\/+$/, '');
    return `${base}/media/${trimmed}/content`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/api\/api\//g, '/api/');
  }
  const cleanBase = apiUrl.replace(/\/+$/, '');
  let normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    normalizedPath = normalizedPath.substring(4);
  }
  const resolved = `${cleanBase}${normalizedPath}`;
  return resolved.replace(/\/api\/api\//g, '/api/');
}

let activeToken = null;
function setMediaAuthToken(token) {
  activeToken = token;
}

function getAuthenticatedMediaSource(input, tokenOverride, cacheBuster) {
  if (!input) return null;
  const rawPath = typeof input === 'string' ? input : input.uri;
  if (!rawPath) return null;

  if (
    rawPath.startsWith('file://') ||
    rawPath.startsWith('content://') ||
    rawPath.startsWith('data:') ||
    rawPath.startsWith('blob:')
  ) {
    return { uri: rawPath };
  }

  const resolved = resolveMediaUrl(rawPath);
  if (!resolved) return null;

  let finalUri = resolved;
  if (cacheBuster) {
    const separator = finalUri.includes('?') ? '&' : '?';
    finalUri = `${finalUri}${separator}_cb=${cacheBuster}`;
  }

  const effectiveToken = tokenOverride !== undefined ? tokenOverride : activeToken;
  if (effectiveToken && isInternalBackendMediaUrl(resolved)) {
    return {
      uri: finalUri,
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
      },
    };
  }

  return { uri: finalUri };
}

test('1. resolveMediaUrl: formats UUID as /api/media/:id/content', () => {
  const uuid = 'c4b12345-6789-4abc-8def-0123456789ab';
  const url = resolveMediaUrl(uuid);
  assert.equal(url, 'http://192.168.1.12:3000/api/media/c4b12345-6789-4abc-8def-0123456789ab/content');
});

test('2. resolveMediaUrl: avoids duplicate /api/api in relative paths', () => {
  const rel1 = '/api/media/123/content';
  const rel2 = '/media/123/content';
  const rel3 = 'api/media/123/content';
  assert.equal(resolveMediaUrl(rel1), 'http://192.168.1.12:3000/api/media/123/content');
  assert.equal(resolveMediaUrl(rel2), 'http://192.168.1.12:3000/api/media/123/content');
  assert.equal(resolveMediaUrl(rel3), 'http://192.168.1.12:3000/api/media/123/content');
});

test('3. resolveMediaUrl: cleans accidental /api/api in full URLs', () => {
  const broken = 'http://192.168.1.12:3000/api/api/media/123/content';
  assert.equal(resolveMediaUrl(broken), 'http://192.168.1.12:3000/api/media/123/content');
});

test('4. resolveMediaUrl: preserves local file URIs untouched', () => {
  assert.equal(resolveMediaUrl('file:///path/to/img.jpg'), 'file:///path/to/img.jpg');
  assert.equal(resolveMediaUrl('content://media/external/images/1'), 'content://media/external/images/1');
  assert.equal(resolveMediaUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
});

test('5. isInternalBackendMediaUrl: accurately identifies internal backend media URLs', () => {
  assert.equal(isInternalBackendMediaUrl('http://192.168.1.12:3000/api/media/123/content'), true);
  assert.equal(isInternalBackendMediaUrl('/api/media/123/content'), true);
  assert.equal(isInternalBackendMediaUrl('/media/123/content'), true);
});

test('6. isInternalBackendMediaUrl: rejects third-party URLs to prevent token leakage', () => {
  assert.equal(isInternalBackendMediaUrl('https://my-r2-bucket.r2.cloudflarestorage.com/media/123'), false);
  assert.equal(isInternalBackendMediaUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg'), false);
  assert.equal(isInternalBackendMediaUrl('https://www.youtube.com/watch?v=123'), false);
  assert.equal(isInternalBackendMediaUrl('file:///storage/emulated/0/DCIM/pic.jpg'), false);
});

test('7. getAuthenticatedMediaSource: attaches Authorization header for internal media when token is set', () => {
  setMediaAuthToken('jwt-token-abc');
  const source = getAuthenticatedMediaSource('/api/media/123/content');
  assert.deepEqual(source, {
    uri: 'http://192.168.1.12:3000/api/media/123/content',
    headers: {
      Authorization: 'Bearer jwt-token-abc',
    },
  });
});

test('8. getAuthenticatedMediaSource: does NOT leak Authorization header to third parties', () => {
  setMediaAuthToken('jwt-token-abc');
  const source = getAuthenticatedMediaSource('https://res.cloudinary.com/demo/image/upload/sample.jpg');
  assert.deepEqual(source, {
    uri: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  });
  assert.equal(source.headers, undefined);
});

test('9. getAuthenticatedMediaSource: does NOT attach Authorization to local file URIs', () => {
  setMediaAuthToken('jwt-token-abc');
  const source = getAuthenticatedMediaSource('file:///data/user/0/cache/photo.jpg');
  assert.deepEqual(source, {
    uri: 'file:///data/user/0/cache/photo.jpg',
  });
  assert.equal(source.headers, undefined);
});

test('10. getAuthenticatedMediaSource: handles missing or expired token gracefully', () => {
  setMediaAuthToken(null);
  const source = getAuthenticatedMediaSource('/api/media/123/content');
  assert.deepEqual(source, {
    uri: 'http://192.168.1.12:3000/api/media/123/content',
  });
  assert.equal(source.headers, undefined);
});

test('11. getAuthenticatedMediaSource: supports token override', () => {
  setMediaAuthToken('default-token');
  const source = getAuthenticatedMediaSource('/api/media/123/content', 'override-token');
  assert.equal(source.headers.Authorization, 'Bearer override-token');
});

test('12. getAuthenticatedMediaSource: supports cache buster query parameter', () => {
  setMediaAuthToken('jwt-token-abc');
  const source = getAuthenticatedMediaSource('/api/media/123/content', null, 1700000000);
  assert.equal(source.uri, 'http://192.168.1.12:3000/api/media/123/content?_cb=1700000000');
});
