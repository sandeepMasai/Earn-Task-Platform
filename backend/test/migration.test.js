const { test } = require('node:test');
const assert = require('node:assert/strict');
const { options, plan, run } = require('../scripts/migrate-media');
const asset = { asset_id: 'fixture', public_id: 'folder/image', resource_type: 'image', type: 'upload', version: 1, bytes: 123, secure_url: 'https://res.cloudinary.com/test/image/upload/v1/folder/image.png' };
test('migration defaults to dry-run and requires explicit execution safeguards', () => {
  assert.equal(options([], {}).execute, false);
  assert.equal(options(['--dry-run'], {}).execute, false);
  for (const args of [['--execute'], ['--execute','--confirm','--dry-run'], ['--unknown']]) assert.throws(() => options(args, {}));
  const env = { MEDIA_MIGRATION_EXECUTE: 'true', MEDIA_MIGRATION_BUCKET_CONFIRM: 'media-staging', R2_BUCKET: 'media-staging', CLOUDINARY_FOLDER_PREFIX: 'test/media', MEDIA_MIGRATION_SOURCE_CONFIRM: 'test/media' };
  assert.equal(options(['--execute','--confirm','--journal','journal.json'],env).execute,true);
  assert.throws(() => options(['--execute','--confirm','--journal','journal.json'],{...env,NODE_ENV:'production'}));
});
test('inventory is read-only, accounts for conflicts, duplicates and restricted assets', async () => {
  const provider = { config: { accountId: 'test', bucket: 'test' }, exists: async ({storageKey}) => storageKey === plan({...asset,asset_id:'conflict'},'test').key, upload: () => assert.fail('dry-run upload'), delete: () => assert.fail('dry-run delete') };
  async function* source() { yield asset; yield asset; yield {...asset,asset_id:'conflict'}; yield {...asset,type:'private'}; }
  const r = await run({source,provider,cloud:'test',output:()=>{}});
  assert.deepEqual([r.total,r.eligible,r.skipped,r.conflicts,r.estimatedBytes,r.wouldMigrate],[4,1,1,2,123,1]);
});
test('inventory fails closed when destination cannot be inspected', async () => {
  async function* source() { yield asset; }
  const r=await run({source,provider:{config:{},exists:async()=>{throw Error('403');}},cloud:'test',output:()=>{}});
  assert.equal(r.failed,1);assert.equal(r.wouldMigrate,0);
  assert.ok(plan({...asset,secure_url:'https://attacker.invalid/secret'},'test').reason);
  assert.notEqual(plan(asset,'test').key,plan({...asset,version:2},'test').key);
});
test('failed copy journals intent, retries safely and resumes without database writes', async () => {
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'migration-test-')),journal=path.join(dir,'journal.json');
  let exists=false, attempts=0;
  const provider={config:{accountId:'test',bucket:'test'},exists:async()=>exists};
  async function* source(){yield asset;}
  try {
    const first=await run({source,provider,cloud:'test',execute:true,journal,output:()=>{},copyAsset:async()=>{attempts++;exists=true;throw Error('interrupted after upload');}});
    assert.equal(first.failed,1);assert.equal(attempts,3);
    assert.equal(JSON.parse(fs.readFileSync(journal)).assets[plan(asset,'test').identity].status,'failed');
    const next=await run({source,provider,cloud:'test',execute:true,journal,output:()=>{},copyAsset:async(a,i,p,previous)=>{assert.ok(previous);return {checksum:'verified',bytes:123};}});
    assert.equal(next.migrated,1);assert.equal(next.conflicts,0);
    assert.equal(JSON.parse(fs.readFileSync(journal)).assets[plan(asset,'test').identity].status,'verified');
    assert.equal(fs.existsSync(journal+'.lock'),false);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('copy verifies bytes and rejects checksum mismatches or unclaimed destinations', async () => {
  const {copy}=require('../scripts/migrate-media');
  const {Readable}=require('node:stream');const fs=require('node:fs');
  const originalFetch=global.fetch;let uploaded=0, exists=false, corrupt=false;
  global.fetch=async()=>new Response('abc',{headers:{'content-type':'image/png'}});
  const provider={config:{bucket:'test'},exists:async()=>exists,upload:async input=>{assert.equal(fs.readFileSync(input.filePath,'utf8'),'abc');uploaded++;exists=true;},send:async()=>({Body:Readable.from([Buffer.from(corrupt?'bad':'abc')])})};
  try {
    const item={key:'migration/test',bytes:3};
    assert.equal((await copy(asset,item,provider)).bytes,3);assert.equal(uploaded,1);
    await assert.rejects(copy(asset,item,provider),/DESTINATION_CONFLICT/);
    assert.equal((await copy(asset,item,provider,{status:'pending'})).bytes,3);assert.equal(uploaded,1);
    corrupt=true;await assert.rejects(copy(asset,item,provider,{status:'pending'}),/DESTINATION_CHECKSUM_MISMATCH/);
    await assert.rejects(copy(asset,{...item,bytes:4},provider,{status:'pending'}),/SOURCE_SIZE_MISMATCH/);
  }finally{global.fetch=originalFetch;}
});
