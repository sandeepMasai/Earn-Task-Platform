const fs = require('node:fs');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Config, validKey } = require('./config');
const { safeError, StorageError } = require('./storage.errors');
class R2Provider {
  constructor({ env = process.env, client, signer = getSignedUrl } = {}) {
    this.config = r2Config(env);
    this.client = client || new S3Client({ region: 'auto', endpoint: `https://${this.config.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey }, maxAttempts: 3, requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 }, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
    this.signer = signer;
  }
  params(asset) { return { Bucket: this.config.bucket, Key: validKey(asset.storageKey) }; }
  async send(command) { try { return await this.client.send(command); } catch (e) { throw safeError(e); } }
  async upload({ filePath, storageKey, mimeType, size, resourceType }) {
    const body = fs.createReadStream(filePath);
    try { await this.send(new PutObjectCommand({ ...this.params({ storageKey }), Body: body, ContentType: mimeType, ContentLength: size, IfNoneMatch: '*' })); }
    finally { body.destroy(); }
    return { provider: 'r2', storageKey, mimeType, size, resourceType };
  }
  async delete(asset) { await this.send(new DeleteObjectCommand(this.params(asset))); return true; }
  async getMetadata(asset) {
    const data = await this.send(new HeadObjectCommand(this.params(asset)));
    return { size: data.ContentLength, mimeType: data.ContentType, etag: data.ETag, version: data.VersionId };
  }
  async exists(asset) { try { await this.getMetadata(asset); return true; } catch (e) { if (e.status === 404) return false; throw e; } }
  async readPrefix(asset) {
    const result = await this.send(new GetObjectCommand({ ...this.params(asset), Range: 'bytes=0-8191' }));
    // Bound memory even if a provider ignores Range.
    const chunks = []; let total = 0;
    try { for await (const chunk of result.Body) { const part = Buffer.from(chunk).subarray(0, 8192 - total); chunks.push(part); total += part.length; if (total >= 8192) break; } }
    catch (e) { throw safeError(e); }
    finally { result.Body?.destroy?.(); }
    return Buffer.concat(chunks);
  }
  async getUrl(asset, { expiresIn = 300 } = {}) {
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900) throw new StorageError('INVALID_EXPIRY', 400);
    try { return await this.signer(this.client, new GetObjectCommand({ ...this.params(asset), ResponseContentDisposition: 'attachment' }), { expiresIn }); } catch (e) { throw safeError(e); }
  }
  async presignUpload({ storageKey, mimeType, size, checksum, expiresIn = 300 }) {
    if (!Number.isSafeInteger(size) || size < 1 || size > 512 * 1024 * 1024 || !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 900 || !/^[A-Za-z0-9+/]{43}=$/.test(checksum || '')) throw new StorageError('INVALID_UPLOAD', 400);
    const headers = { 'Content-Type': mimeType, 'Content-Length': String(size), 'If-None-Match': '*', 'x-amz-checksum-sha256': checksum };
    const command = new PutObjectCommand({ ...this.params({ storageKey }), ContentType: mimeType, ContentLength: size, IfNoneMatch: '*', ChecksumSHA256: checksum });
    try {
      const url = await this.signer(this.client, command, { expiresIn, signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']), unhoistableHeaders: new Set(['x-amz-checksum-sha256']) });
      return { url, method: 'PUT', headers, expiresIn };
    } catch (e) { throw safeError(e); }
  }
}
module.exports = R2Provider;
