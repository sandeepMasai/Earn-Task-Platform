// Loaded only inside media safety test processes, never by application code or API tests.
// These tests may write temporary fixture/journal files, but cannot reach real services.
const blocked = () => { throw new Error('MEDIA_SAFETY_TEST_REAL_IO_FORBIDDEN'); };
require('mongodb').MongoClient.prototype.connect = blocked;
require('node:net').Socket.prototype.connect = blocked;
require('node:tls').connect = blocked;
global.fetch = blocked;
require('dotenv').config = blocked;
const childProcess = require('node:child_process');
for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  const original = childProcess[name];
  childProcess[name] = function(command, ...args) {
    if (command !== process.execPath) return blocked();
    return original.call(this, command, ...args);
  };
}
childProcess.exec = blocked;
childProcess.execSync = blocked;
