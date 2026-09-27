const mongoose = require('mongoose');
function installShutdown(server, { timeoutMs = 25000, exit = code => process.exit(code) } = {}) {
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.emit('shutdown');
    const force = setTimeout(() => { server.closeAllConnections?.(); exit(1); }, timeoutMs);
    force.unref();
    try {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await mongoose.disconnect();
      clearTimeout(force);
      exit(0);
    } catch { clearTimeout(force); exit(1); }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return shutdown;
}
module.exports = { installShutdown };
