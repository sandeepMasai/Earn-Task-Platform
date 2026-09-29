// Log only the selected environment and connected database name, never the URI.
function logRuntimeIdentity(env, databaseName, log = console.log) {
  const nodeEnv = ['production', 'staging', 'development', 'test'].includes(env.NODE_ENV) ? env.NODE_ENV : 'unspecified';
  const database = typeof databaseName === 'string' && /^[a-zA-Z0-9_-]+$/.test(databaseName) ? databaseName : '[redacted]';
  if (nodeEnv === 'staging') log('STAGING ENVIRONMENT');
  if (nodeEnv === 'production') log('PRODUCTION ENVIRONMENT');
  log(JSON.stringify({ NODE_ENV: nodeEnv, database }));
}
module.exports = { logRuntimeIdentity };
