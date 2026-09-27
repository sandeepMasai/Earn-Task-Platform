const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { MongoClient } = require('mongodb');
async function startMongo(directory) {
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const child = spawn(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'test', '--logpath', path.join(directory, 'mongo.log')], { stdio: 'ignore' });
  let spawnError; child.on('error', error => { spawnError = error; });
  const uri = `mongodb://127.0.0.1:${port}/earn_isolated_test`;
  const client = new MongoClient(uri + '?directConnection=true', { serverSelectionTimeoutMS: 500 });
  try {
    for (let i = 0; ; i++) {
      if (spawnError) throw spawnError;
      try { await client.connect(); break; } catch (error) { if (i > 40 || child.exitCode !== null) throw error; await new Promise(r => setTimeout(r, 250)); }
    }
    await client.db('admin').command({ replSetInitiate: { _id: 'test', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    return { child, uri: uri + '?replicaSet=test' };
  } catch (error) { child.kill('SIGTERM'); throw error; }
  finally { await client.close(); }
}
async function stopMongo(child) {
  if (child && child.exitCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await ended;
  }
}
module.exports = { startMongo, stopMongo };
