function validateProduction(env = process.env) {
  require('./cloudinaryPrefix').getCloudinaryFolderPrefix(env);
  const storageConfig = require('../services/storage/config');
  for (const category of ['images', 'videos', 'reels', 'documents']) {
    if (storageConfig.providerFor(category, env) === 'r2') storageConfig.r2Config(env);
  }
  if (env.NODE_ENV !== 'production') return;
  const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter(key => !env[key]);
  if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`);
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if (env[key].length < 32 || /your.secret|changeme|example|test.secret/i.test(env[key])) throw new Error(`${key} must be a strong random secret of at least 32 characters`);
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) throw new Error('Access and refresh secrets must differ');
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI)) throw new Error('Invalid MongoDB URI format');
  if (env.PORT && (!/^\d+$/.test(env.PORT) || Number(env.PORT) < 1 || Number(env.PORT) > 65535)) throw new Error('Invalid PORT');
  for (const origin of (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)) {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Production CORS origins must be exact HTTPS origins');
  }
  if (env.RATE_LIMIT_DISABLED === 'true') throw new Error('Production rate limiting cannot be disabled');
}
module.exports = { validateProduction };
