const { test } = require('node:test');
const assert = require('node:assert/strict');
const { logRuntimeIdentity } = require('../src/config/runtimeIdentity');
test('environment designation depends on NODE_ENV, never database naming; logs contain no credentials', () => {
  for (const [NODE_ENV,database,label] of [['production','example_staging','PRODUCTION ENVIRONMENT'],['staging','example_production','STAGING ENVIRONMENT']]) {
    const logs=[];
    logRuntimeIdentity({NODE_ENV,MONGODB_URI:'mongodb://secret-user:secret-password@private-host/'+database,JWT_SECRET:'secret-jwt',R2_SECRET_ACCESS_KEY:'secret-r2'},database,x=>logs.push(x));
    assert.deepEqual(logs,[label,JSON.stringify({NODE_ENV,database})]);
  }
  const logs=[];
  logRuntimeIdentity({NODE_ENV:'secret-token'},'mongodb://secret-user:secret-password@private-host/database',x=>logs.push(x));
  assert.deepEqual(logs,[JSON.stringify({NODE_ENV:'unspecified',database:'[redacted]'})]);
});
test('database failures expose only allowlisted startup categories', async t => {
  const mongoose = require('mongoose');
  const connectDB = require('../src/config/database');
  const previous = { JWT_SECRET: process.env.JWT_SECRET, MONGODB_URI: process.env.MONGODB_URI };
  process.env.JWT_SECRET = 'disposable-test-only';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/disposable_test';
  let failure;
  t.mock.method(mongoose, 'connect', async () => { throw failure; });
  try {
    for (const [name, category] of [['MongoParseError', 'configuration error'], ['MongoInvalidArgumentError', 'configuration error'], ['MongoServerSelectionError', 'database connection error']]) {
      failure = Object.assign(new Error('synthetic-sensitive-driver-payload'), { name });
      await assert.rejects(connectDB(), error => {
        assert.equal(error.message, category);
        assert.equal(error.startupCategory, category);
        assert.equal(error.cause, undefined);
        assert.equal(error.stack.includes('synthetic-sensitive-driver-payload'), false);
        return true;
      });
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
test('database startup requires an explicit environment URI and has no fallback database', async () => {
  const previous={JWT_SECRET:process.env.JWT_SECRET,MONGODB_URI:process.env.MONGODB_URI};
  process.env.JWT_SECRET='test-only';delete process.env.MONGODB_URI;
  try { await assert.rejects(require('../src/config/database')(), /MONGODB_URI must be configured/); }
  finally {for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
