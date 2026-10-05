import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '@constants';
import { apiService } from '@services/api';

export interface SignedUrlEntry {
  url: string;
  expiresAt: number;
}

export interface AuthenticatedMediaSource {
  uri: string;
  headers?: Record<string, string>;
}

// In-memory cache for signed media URLs
const signedUrlCache = new Map<string, SignedUrlEntry>();
const inFlightRequests = new Map<string, Promise<string>>();

// In-memory active JWT token tracking
let inMemoryToken: string | null = null;

export const setMediaAuthToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const getActiveToken = (): string | null => {
  if (inMemoryToken) return inMemoryToken;
  try {
    const store = require('@store').store;
    const token = store?.getState?.()?.auth?.token;
    if (token) {
      inMemoryToken = token;
      return token;
    }
  } catch {
    // Redux store might not be ready or in isolated test
  }
  return inMemoryToken;
};

/**
 * Clears signed URL cache for a specific media ID or all media.
 */
export const clearSignedUrlCache = (mediaId?: string): void => {
  if (mediaId) {
    signedUrlCache.delete(mediaId);
  } else {
    signedUrlCache.clear();
  }
};

/**
 * Extracts a media UUID from a user object, asset object, or URL/path string.
 */
export const extractMediaId = (
  input: string | { mediaId?: string; avatarAsset?: any; mediaAsset?: any; avatar?: string | null } | null | undefined
): string | null => {
  if (!input) return null;

  if (typeof input === 'object') {
    if (input.mediaAsset?.mediaId && typeof input.mediaAsset.mediaId === 'string') {
      return input.mediaAsset.mediaId;
    }
    if (input.avatarAsset?.mediaId && typeof input.avatarAsset.mediaId === 'string') {
      return input.avatarAsset.mediaId;
    }
    if ((input as any).mediaId && typeof (input as any).mediaId === 'string') {
      return (input as any).mediaId;
    }
    if (input.avatar && typeof input.avatar === 'string') {
      return extractMediaId(input.avatar);
    }
    return null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    const mediaPathMatch = trimmed.match(/(?:^|\/api\/media\/)([a-f0-9-]{36})(?:\/content|\/download)?/i);
    if (mediaPathMatch && mediaPathMatch[1]) {
      return mediaPathMatch[1];
    }
    if (/^[a-f0-9-]{36}$/i.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
};

/**
 * Retrieves a signed R2 URL for a given media ID, caching it until near-expiration.
 */
export const getSignedMediaUrl = async (mediaId: string): Promise<string> => {
  if (!mediaId || typeof mediaId !== 'string') {
    throw new Error('Valid media ID is required to get signed URL');
  }

  const cached = signedUrlCache.get(mediaId);
  if (cached && Date.now() < cached.expiresAt - 30_000) {
    return cached.url;
  }

  const existingPromise = inFlightRequests.get(mediaId);
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    try {
      let response: any;
      try {
        response = await apiService.get<{ url: string; expiresIn: number }>(`/media/${mediaId}/url`);
      } catch {
        response = await apiService.get<{ url: string; expiresIn: number }>(`/media/${mediaId}/download`);
      }
      const data = response?.data ?? response;
      const url = data?.url || response?.url;
      if (!url) {
        throw new Error(response?.error || 'Failed to get signed media URL');
      }

      const expiresIn = typeof data?.expiresIn === 'number' ? data.expiresIn : (typeof response?.expiresIn === 'number' ? response.expiresIn : 300);
      signedUrlCache.set(mediaId, {
        url,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return url;
    } finally {
      inFlightRequests.delete(mediaId);
    }
  })();

  inFlightRequests.set(mediaId, fetchPromise);
  return fetchPromise;
};

export const getMediaUrl = getSignedMediaUrl;

/**
 * Determines whether a URL or path points to our internal backend media endpoints.
 * Third-party URLs (Cloudinary, AWS, Google) and local file URIs are excluded to prevent JWT leakage.
 */
export const isInternalBackendMediaUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Local files and data URIs are never internal backend URLs
  if (trimmed.startsWith('file://') || trimmed.startsWith('data:')) return false;

  // Relative backend paths
  if (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('api/') ||
    trimmed.startsWith('/media/') ||
    trimmed.startsWith('media/')
  ) {
    return true;
  }

  // Bare media UUIDs
  if (/^[a-f0-9-]{36}$/i.test(trimmed)) return true;

  // Fully-qualified backend URL
  try {
    const baseOrigin = (API_BASE_URL || '').replace(/\/api\/?$/, '');
    if (baseOrigin && trimmed.startsWith(baseOrigin)) return true;
  } catch {
    // ignore URL parsing error
  }

  return trimmed.includes('/api/media/') || trimmed.includes('/media/');
};

/**
 * Resolves a media path or URL into a fully-qualified URL for media loading.
 * Supports absolute URLs (http/https), local device file URIs (file://),
 * data URIs (data:), bare UUIDs, and backend-relative paths (/api/media/..., /uploads/...).
 * Prevents accidental /api/api path duplication.
 */
export const resolveMediaUrl = (path: string | null | undefined): string | null => {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  const baseOrigin = (API_BASE_URL || '').replace(/\/api\/?$/, '');

  // Bare UUID -> point to content endpoint
  if (/^[a-f0-9-]{36}$/i.test(trimmed)) {
    return `${baseOrigin}/api/media/${trimmed}/content`;
  }

  let cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // Ensure /media/ paths have /api/ prefix
  if (cleanPath.startsWith('/media/')) {
    cleanPath = `/api${cleanPath}`;
  }

  // Prevent accidental /api/api
  if (cleanPath.startsWith('/api/api/')) {
    cleanPath = cleanPath.replace('/api/api/', '/api/');
  }

  return `${baseOrigin}${cleanPath}`;
};

/**
 * Asynchronously resolves any user, asset, or path into a ready-to-render image URL:
 * - Local file URIs (file:// or data:) return immediately.
 * - External URLs (e.g. Cloudinary) return immediately.
 * - Private R2 media endpoints (/api/media/:id/content) or media IDs fetch a fresh signed URL via GET /api/media/:id/download.
 */
export const resolveDisplayMediaUrl = async (
  input: string | { mediaId?: string; avatarAsset?: any; mediaAsset?: any; avatar?: string | null } | null | undefined
): Promise<string | null> => {
  if (!input) return null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('file://') || trimmed.startsWith('data:')) {
      return trimmed;
    }

    const mediaId = extractMediaId(trimmed);
    if (mediaId) {
      return await getSignedMediaUrl(mediaId);
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    return resolveMediaUrl(trimmed);
  }

  if (typeof input === 'object') {
    const mediaId = extractMediaId(input);
    if (mediaId) {
      return await getSignedMediaUrl(mediaId);
    }
    if (input.avatar) {
      return await resolveDisplayMediaUrl(input.avatar);
    }
  }

  return null;
};

/**
 * Constructs an authenticated media source object { uri, headers } for React Native Image,
 * Video, and Audio components.
 * Automatically injects "Authorization: Bearer <token>" when the target is an internal
 * backend media endpoint. Never leaks tokens to local files or third-party origins.
 */
export const getAuthenticatedMediaSource = (
  input: string | { uri?: string; headers?: Record<string, string> } | null | undefined,
  tokenOverride?: string | null,
  cacheBuster?: number | string
): AuthenticatedMediaSource | null => {
  if (!input) return null;

  let rawUri: string | undefined;
  let existingHeaders: Record<string, string> | undefined;

  if (typeof input === 'object') {
    if (!input.uri) return null;
    rawUri = input.uri;
    existingHeaders = input.headers;
  } else {
    rawUri = input;
  }

  const resolved = resolveMediaUrl(rawUri);
  if (!resolved) return null;

  const isLocal = resolved.startsWith('file://') || resolved.startsWith('data:');
  const uri = cacheBuster && !isLocal
    ? `${resolved}${resolved.includes('?') ? '&' : '?'}v=${cacheBuster}`
    : resolved;

  if (isLocal) {
    return { uri };
  }

  const token = tokenOverride !== undefined ? tokenOverride : getActiveToken();
  const headers: Record<string, string> = { ...(existingHeaders || {}) };

  if (token && isInternalBackendMediaUrl(resolved)) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return {
    uri,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };
};

/**
 * Aliases for specific media types to maintain clean component semantics.
 */
export const getAuthenticatedImageSource = getAuthenticatedMediaSource;
export const getAuthenticatedVideoSource = getAuthenticatedMediaSource;
export const getAuthenticatedAudioSource = getAuthenticatedMediaSource;

/**
 * Returns a fully-resolved proof image URL.
 */
export const getProofImageUrl = (
  path: string | null | undefined,
  token?: string | null
): string | null => {
  return resolveMediaUrl(path);
};

/**
/**
 * React hook to load and manage a signed media URL for any media asset, avatar, or path.
 * Caches the URL, avoids duplicate in-flight requests, and provides loading/error states.
 */
export function useMediaUrl(
  mediaInput: string | { mediaId?: string; avatarAsset?: any; mediaAsset?: any; avatar?: string | null } | null | undefined,
  options?: { refreshTrigger?: any }
) {
  const mediaId = extractMediaId(mediaInput);
  const directLocalUri =
    typeof mediaInput === 'string' &&
    (mediaInput.startsWith('file://') || mediaInput.startsWith('data:'))
      ? mediaInput
      : null;

  const getInitialUrl = (): string | null => {
    if (directLocalUri) return directLocalUri;
    if (mediaId) {
      const cached = signedUrlCache.get(mediaId);
      if (cached && Date.now() < cached.expiresAt - 30_000) {
        return cached.url;
      }
    }
    if (typeof mediaInput === 'string') {
      const trimmed = mediaInput.trim();
      if (
        (trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
        !trimmed.includes('/api/media/')
      ) {
        return trimmed;
      }
    }
    return null;
  };

  const [url, setUrl] = useState<string | null>(getInitialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadUrl = useCallback(
    async (forceFresh = false) => {
      if (directLocalUri) {
        if (isMountedRef.current) {
          setUrl(directLocalUri);
          setIsLoading(false);
          setIsError(false);
        }
        return;
      }

      if (!mediaInput) {
        if (isMountedRef.current) {
          setUrl(null);
          setIsLoading(false);
          setIsError(false);
        }
        return;
      }

      if (forceFresh && mediaId) {
        signedUrlCache.delete(mediaId);
      }

      if (mediaId) {
        const cached = signedUrlCache.get(mediaId);
        if (cached && Date.now() < cached.expiresAt - 30_000) {
          if (isMountedRef.current) {
            setUrl(cached.url);
            setIsLoading(false);
            setIsError(false);
          }
          return;
        }
      }

      if (isMountedRef.current) {
        setIsLoading(true);
        setIsError(false);
      }

      try {
        const resolved = await resolveDisplayMediaUrl(mediaInput);
        if (isMountedRef.current) {
          setUrl(resolved);
          setIsError(false);
        }
      } catch {
        if (isMountedRef.current) {
          setIsError(true);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [mediaInput, mediaId, directLocalUri]
  );

  useEffect(() => {
    loadUrl();
  }, [loadUrl, options?.refreshTrigger]);

  return {
    url,
    isLoading,
    isError,
    reload: () => loadUrl(true),
  };
}

export const useAvatarUrl = useMediaUrl;
