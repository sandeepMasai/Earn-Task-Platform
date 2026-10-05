import { apiService } from './api';

export interface ImageAssetInput {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number;
}

export interface MediaUploadInitResponse {
  media: {
    id: string;
    category: string;
    mimeType: string;
    size: number;
    status: string;
    [key: string]: any;
  };
  upload: {
    url: string;
    method: string;
    headers: Record<string, string>;
    expiresIn: number;
  };
  expiresAt: string;
}

export interface MediaCompleteResponse {
  id: string;
  status: string;
  category: string;
  mimeType: string;
  size: number;
  [key: string]: any;
}

export interface DetectedImageFormat {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'image/heic' | 'image/avif';
  ext: string;
}

/**
 * Inspects binary magic bytes to determine the actual image format.
 * Never blindly trusts file extensions or declared MIME types.
 */
export function detectImageFormat(bytes: Uint8Array): DetectedImageFormat | null {
  if (!bytes || bytes.length < 3) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
    bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // WebP: RIFF .... WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  // GIF: GIF8
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
  ) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  // HEIC / HEIF / AVIF: offset 4 'ftyp'
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) {
      return { mime: 'image/heic', ext: 'heic' };
    }
    if (brand === 'avif') {
      return { mime: 'image/avif', ext: 'avif' };
    }
  }

  return null;
}

export interface DetectedMediaFormat {
  category: 'images' | 'videos' | 'documents' | 'reels';
  mime: string;
  ext: string;
}

/**
 * Inspects binary magic bytes to determine format across images, videos, and documents.
 */
export function detectMediaFormat(bytes: Uint8Array): DetectedMediaFormat | null {
  if (!bytes || bytes.length < 3) return null;

  // 1. Check images first
  const img = detectImageFormat(bytes);
  if (img && ['image/jpeg', 'image/png', 'image/webp'].includes(img.mime)) {
    return {
      category: 'images',
      mime: img.mime,
      ext: img.ext,
    };
  }

  // 2. MP4 / QuickTime / ISO Base Media: offset 4 'ftyp'
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return {
      category: 'videos',
      mime: 'video/mp4',
      ext: 'mp4',
    };
  }

  // 3. WebM: 1A 45 DF A3
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3
  ) {
    return {
      category: 'videos',
      mime: 'video/webm',
      ext: 'webm',
    };
  }

  // 4. PDF: %PDF- (25 50 44 46 2D)
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D
  ) {
    return {
      category: 'documents',
      mime: 'application/pdf',
      ext: 'pdf',
    };
  }

  return null;
}

// Bitwise rotation helper for SHA-256
const rotr = (n: number, x: number): number => (x >>> n) | (x << (32 - n));

// SHA-256 round constants (K)
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/**
 * Pure JavaScript SHA-256 implementation producing a 32-byte hash buffer.
 * Complies with FIPS 180-4 and works across all JS runtimes (Hermes, V8, Node).
 */
export function sha256(bytes: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const len = bytes.length;
  const bitLen = len * 8;
  const withPaddingLen = ((len + 8 + 64) >>> 6) << 6;
  const padded = new Uint8Array(withPaddingLen);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setBigUint64(withPaddingLen - 8, BigInt(bitLen), false);

  const w = new Uint32Array(64);

  for (let i = 0; i < withPaddingLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(7, w[j - 15]) ^ rotr(18, w[j - 15]) ^ (w[j - 15] >>> 3);
      const s1 = rotr(17, w[j - 2]) ^ rotr(19, w[j - 2]) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  const states = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let idx = 0; idx < 8; idx++) {
    outView.setUint32(idx * 4, states[idx], false);
  }
  return out;
}

/**
 * Encodes a Uint8Array into a standard Base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    result += chars[bytes[i] >> 2];
    result += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    result += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    result += chars[bytes[i + 2] & 63];
  }
  if (i < bytes.length) {
    result += chars[bytes[i] >> 2];
    if (i + 1 === bytes.length) {
      result += chars[(bytes[i] & 3) << 4];
      result += '==';
    } else {
      result += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      result += chars[(bytes[i + 1] & 15) << 2];
      result += '=';
    }
  }
  return result;
}

/**
 * Decodes a Base64 string into a Uint8Array.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/^data:[^;]+;base64,/, '').replace(/[\r\n\s]/g, '');
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;
  const bytesLen = Math.floor((clean.length * 3) / 4) - padding;
  const bytes = new Uint8Array(bytesLen);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = chars.indexOf(clean[i]);
    const c1 = chars.indexOf(clean[i + 1]);
    const c2 = chars.indexOf(clean[i + 2]);
    const c3 = chars.indexOf(clean[i + 3]);
    bytes[p++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== -1 && p < bytesLen) bytes[p++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 !== -1 && p < bytesLen) bytes[p++] = ((c2 & 3) << 6) | c3;
  }
  return bytes;
}

export const mediaService = {
  /**
   * Initializes direct media upload with the backend.
   * Expects category, mimeType, size in bytes, SHA-256 base64 checksum, and optional filename.
   */
  async initUpload(payload: {
    category: 'images' | 'videos' | 'documents' | 'reels';
    mimeType: string;
    size: number;
    checksum: string;
    filename?: string;
  }): Promise<{ media: MediaUploadInitResponse['media']; upload: MediaUploadInitResponse['upload']; expiresAt: string }> {
    const response = await apiService.post<MediaUploadInitResponse>('/media/upload/init', payload);
    const data = (response as any).data ?? response;
    if (!data?.media?.id || !data?.upload?.url) {
      throw new Error(response.error || 'Failed to initialize direct media upload');
    }
    return {
      media: data.media,
      upload: data.upload,
      expiresAt: data.expiresAt,
    };
  },

  /**
   * Directly uploads image binary to the presigned R2 URL via HTTP PUT.
   * Enforces exact matching Content-Type and does NOT send application/octet-stream.
   * Does NOT send credentials or route through backend profile endpoint.
   */
  async uploadToR2(url: string, headers: Record<string, string>, bytes: Uint8Array, mimeType: string): Promise<number> {
    const putHeaders: Record<string, string> = {
      ...(headers || {}),
      'Content-Type': mimeType,
      'Content-Length': String(bytes.length),
    };

    let bodyData: any = bytes;
    if (typeof Blob !== 'undefined') {
      try {
        const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        bodyData = new Blob([slice as any], { type: mimeType });
      } catch {
        bodyData = bytes;
      }
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: putHeaders,
      body: bodyData,
    });

    if (!response.ok) {
      throw new Error(`Direct R2 upload failed with status ${response.status}`);
    }

    return response.status;
  },

  /**
   * Finalizes media upload after direct PUT to R2 succeeds.
   */
  async completeUpload(mediaId: string): Promise<MediaCompleteResponse> {
    const response = await apiService.post<MediaCompleteResponse>(`/media/${mediaId}/complete`, {});
    const data = (response as any).data ?? response;
    if (!data?.id && !(response as any).success) {
      throw new Error(response.error || 'Failed to complete media upload');
    }
    return data;
  },

  /**
   * Full end-to-end direct avatar upload flow:
   * 1. Extracts bytes from ImageAssetInput (preferring local file URI).
   * 2. Inspects binary magic bytes to determine the actual image format (JPEG, PNG, WebP).
   * 3. Computes byte size and base64 SHA-256 checksum from the exact bytes to be uploaded.
   * 4. Calls POST /api/media/upload/init with normalized MIME type.
   * 5. PUTs directly to R2 presigned URL with the exact same Content-Type.
   * 6. Calls POST /api/media/:id/complete.
   * 7. Logs non-sensitive development diagnostics.
   * 8. Returns mediaId to link to user profile.
   */
  async uploadAvatar(image: ImageAssetInput): Promise<{ mediaId: string }> {
    let bytes: Uint8Array | null = null;

    // Prefer reading the actual local file bytes so transformations and crops are captured
    if (image.uri) {
      try {
        const response = await fetch(image.uri);
        if (response.ok || (response.status === 0 && response.type === 'default')) {
          const buffer = await response.arrayBuffer();
          if (buffer && buffer.byteLength > 0) {
            bytes = new Uint8Array(buffer);
          }
        }
      } catch {
        // Fall back to base64 if fetch fails
      }
    }

    if ((!bytes || bytes.length === 0) && image.base64 && typeof image.base64 === 'string') {
      bytes = base64ToBytes(image.base64);
    }

    if (!bytes || bytes.length === 0) {
      throw new Error('Selected image is empty or could not be read');
    }

    // Inspect magic bytes of actual file buffer
    const detected = detectImageFormat(bytes);

    if (!detected) {
      throw new Error('Unsupported image format. Please select a valid JPEG, PNG, or WebP image.');
    }

    if (detected.mime === 'image/heic') {
      throw new Error('HEIC/HEIF images are not supported. Please select a JPEG, PNG, or WebP image.');
    }

    if (detected.mime === 'image/gif') {
      throw new Error('GIF images are not supported for profile pictures. Please select a JPEG, PNG, or WebP image.');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)) {
      throw new Error(`Unsupported image format (${detected.mime}). Please select a JPEG, PNG, or WebP image.`);
    }

    const finalMimeType = detected.mime;
    const finalExt = detected.ext;
    const size = bytes.length;
    const checksum = bytesToBase64(sha256(bytes));

    const rawFilename = (image.fileName || image.uri.split('/').pop()?.split('?')[0] || 'avatar')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${rawFilename.slice(0, 80)}.${finalExt}`;

    // Step 1: Initialize direct upload with backend
    const { media, upload } = await this.initUpload({
      category: 'images',
      mimeType: finalMimeType,
      size,
      checksum,
      filename,
    });

    const mediaId = media.id;

    // Step 2: Upload directly to R2 presigned URL with exact matching Content-Type
    const putStatus = await this.uploadToR2(upload.url, upload.headers, bytes, finalMimeType);

    // Step 3: Complete upload with backend
    const completeResult = await this.completeUpload(mediaId);

    // Development-only diagnostics without logging presigned URLs or secrets
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[MediaUpload] Diagnostics:', {
        selectedMIME: image.mimeType || 'unspecified',
        finalMIME: finalMimeType,
        finalFileSize: size,
        initResponseMIME: media.mimeType || finalMimeType,
        r2PutHttpStatus: putStatus,
        completeResponseStatus: completeResult.status || 'ready',
        selectedUri: image.uri,
        declaredMimeType: image.mimeType || 'unspecified',
        finalMimeType,
        fileSize: size,
        uploadStatus: putStatus,
      });
    }

    return { mediaId };
  },

  /**
   * Generic direct media upload flow for all supported categories (images, videos, documents, reels):
   * 1. Reads binary bytes from URI.
   * 2. Detects format via magic bytes.
   * 3. Calculates exact size and base64 SHA-256.
   * 4. Initializes upload with backend POST /api/media/upload/init.
   * 5. Uploads directly to Cloudflare R2 presigned PUT URL.
   * 6. Finalizes upload with POST /api/media/:id/complete.
   * 7. Returns { mediaId }.
   */
  async uploadMedia(input: {
    uri: string;
    category?: 'images' | 'videos' | 'documents' | 'reels';
    fileName?: string;
    mimeType?: string;
  }): Promise<{ mediaId: string }> {
    let bytes: Uint8Array | null = null;
    if (input.uri) {
      try {
        const response = await fetch(input.uri);
        if (response.ok || (response.status === 0 && response.type === 'default')) {
          const buffer = await response.arrayBuffer();
          if (buffer && buffer.byteLength > 0) {
            bytes = new Uint8Array(buffer);
          }
        }
      } catch {
        // Fall back
      }
    }

    if (!bytes || bytes.length === 0) {
      throw new Error('Selected media is empty or could not be read');
    }

    const detected = detectMediaFormat(bytes);
    let finalCategory: 'images' | 'videos' | 'documents' | 'reels' = input.category || detected?.category || 'images';
    let finalMimeType = detected?.mime || input.mimeType || (finalCategory === 'videos' ? 'video/mp4' : 'image/jpeg');
    let finalExt = detected?.ext || (finalCategory === 'videos' ? 'mp4' : 'jpg');

    if (input.category === 'reels' && (detected?.category === 'videos' || finalCategory === 'videos')) {
      finalCategory = 'reels';
    }

    const size = bytes.length;
    const checksum = bytesToBase64(sha256(bytes));

    const rawFilename = (input.fileName || input.uri.split('/').pop()?.split('?')[0] || 'media')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${rawFilename.slice(0, 80)}.${finalExt}`;

    const { media, upload } = await this.initUpload({
      category: finalCategory,
      mimeType: finalMimeType,
      size,
      checksum,
      filename,
    });

    const mediaId = media.id;
    await this.uploadToR2(upload.url, upload.headers, bytes, finalMimeType);
    await this.completeUpload(mediaId);

    return { mediaId };
  },

  /**
   * Retrieves a short-lived presigned signed GET URL from Cloudflare R2 via GET /api/media/:id/url.
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await apiService.get<{ url: string; expiresIn: number }>(`/media/${mediaId}/url`);
    const data = (response as any).data ?? response;
    const url = data?.url || (response as any)?.url;
    if (!url) {
      throw new Error((response as any)?.error || 'Failed to get signed media URL');
    }
    return url;
  },
};
