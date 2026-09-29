class StorageError extends Error {
  constructor(code = 'STORAGE_UNAVAILABLE', status = 502) {
    super(status === 404 ? 'Media not found' : status === 400 ? 'Invalid media request' : 'Media storage unavailable');
    this.name = 'StorageError'; this.code = code; this.status = status;
  }
}
const safeError = error => error instanceof StorageError ? error : error?.name === 'NoSuchBucket' ? new StorageError('R2_BUCKET_UNAVAILABLE', 503) : new StorageError(error?.$metadata?.httpStatusCode === 404 || error?.http_code === 404 ? 'MEDIA_NOT_FOUND' : 'STORAGE_UNAVAILABLE', error?.$metadata?.httpStatusCode === 404 || error?.http_code === 404 ? 404 : 502);
module.exports = { StorageError, safeError };
