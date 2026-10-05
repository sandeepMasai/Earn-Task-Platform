require('./support/media-safety-guard');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { MongoClient } = require('mongodb');
const R2Provider = require('../src/services/storage/r2.provider');
const { options, plan, run, diagnostic } = require('../scripts/migrate-media');
const { collect } = require('../scripts/reconcile-media');
const { MAX_EVIDENCE_AGE_MS } = require('../src/services/reconciliation-media/migration-safety');
const asset = { asset_id:'fixture', public_id:'test/media/image', resource_type:'image', type:'upload', version:1, bytes:3, format:'png', secure_url:'https://res.cloudinary.com/test/image/upload/v1/test/media/image.png' };
const executionArgs = journal => ['--execute','--confirm','--journal',journal];

// All I/O is mocked. No .env, MongoDB connection, R2 request or Cloudinary request is used.
function setup(t, { inventory=[asset], referenced=inventory, environment='staging', database='fixture_staging', prefix='test/media' }={}) {
  const keys=['NODE_ENV','MONGODB_URI','MEDIA_STORAGE_PROVIDER','R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET','R2_PRIVATE_BUCKET','R2_PUBLIC_BASE_URL','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','CLOUDINARY_FOLDER_PREFIX','MEDIA_MIGRATION_EXECUTE','MEDIA_MIGRATION_BUCKET_CONFIRM','MEDIA_MIGRATION_SOURCE_CONFIRM','MEDIA_MIGRATION_SOURCE_PREFIXES','MEDIA_MIGRATION_SOURCE_PREFIXES_CONFIRM',...['IMAGES','VIDEOS','REELS','DOCUMENTS'].map(c=>'MEDIA_STORAGE_PROVIDER_'+c)];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  for(const k of keys)delete process.env[k];
  const bucket=environment==='production'?'production-media':'media-staging';
  Object.assign(process.env,{NODE_ENV:environment,MONGODB_URI:`mongodb://127.0.0.1:1/${database}`,MEDIA_STORAGE_PROVIDER:'r2',R2_ACCOUNT_ID:'a'.repeat(32),R2_ACCESS_KEY_ID:'fake-access',R2_SECRET_ACCESS_KEY:'fake-secret',R2_BUCKET:bucket,R2_PRIVATE_BUCKET:'true',CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'fake',CLOUDINARY_API_SECRET:'fake',CLOUDINARY_FOLDER_PREFIX:prefix,MEDIA_MIGRATION_EXECUTE:'true',MEDIA_MIGRATION_BUCKET_CONFIRM:bucket,MEDIA_MIGRATION_SOURCE_CONFIRM:prefix});
  t.after(()=>{for(const [k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  const docs=referenced.map((a,i)=>({_id:(i+1).toString(16).padStart(24,'0'),avatarAsset:{provider:'cloudinary',publicId:a.public_id,assetId:a.asset_id,resourceType:a.resource_type,size:a.bytes,version:a.version,format:a.format,secureUrl:a.secure_url}}));
  t.mock.method(MongoClient.prototype,'connect',async function(){return this;});
  t.mock.method(MongoClient.prototype,'close',async()=>{});
  t.mock.method(MongoClient.prototype,'db',function(){return {databaseName:this.options.dbName,listCollections:()=>({toArray:async()=>[{name:'users'}]}),collection:()=>({find:async function*(){yield* docs;}})};});
  const inventoryFetch=async url=>{
    const u=new URL(url);
    const match=/\/resources\/(image|video|raw)\/(upload|private|authenticated)$/.exec(u.pathname);
    if(!match)return new Response('',{status:404});
    return Response.json({resources:inventory.filter(a=>a.resource_type===match[1]&&a.type===match[2])});
  };
  t.mock.method(global,'fetch',inventoryFetch);
  t.mock.method(R2Provider.prototype,'exists',async()=>false);
  t.mock.method(R2Provider.prototype,'upload',async()=>assert.fail('unexpected provider write'));
  t.mock.method(R2Provider.prototype,'delete',async()=>assert.fail('unexpected provider delete'));
  t.mock.method(R2Provider.prototype,'send',async command=>{if(command.constructor.name==='HeadBucketCommand')return {};assert.fail('unexpected provider request');});
  return async()=> {t.mock.method(global,'fetch',inventoryFetch);return (await collect(process.env,{forMigration:true})).result;};
}
function temporaryJournal(t) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'migration-mocked-test-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  return {directory,journal:path.join(directory,'journal.json')};
}
const quiet={output:()=>{}};

test('CLI defaults to dry-run and confirmations cannot bypass production or conflicting flags',t=>{
 setup(t);assert.equal(options([],process.env).execute,false);
 assert.equal(options(['--dry-run'],process.env).execute,false);
 assert.equal(options(executionArgs('journal.json'),process.env).execute,true);
 for(const args of [['--execute'],['--unknown'],[...executionArgs('j'),'--dry-run']])assert.throws(()=>options(args,process.env));
 process.env.NODE_ENV='production';
 assert.throws(()=>options(executionArgs('j'),process.env),/explicit production confirmation/);
 assert.throws(()=>options([...executionArgs('j'),'--confirm-production'],process.env),/Production migration is disabled/);
});
test('staging dry-run selects one referenced asset, excludes one unreferenced asset, and writes no journal',async t=>{
 const inventory=[asset,{...asset,asset_id:'unused',public_id:'unused'}];
 const reconciliation=await setup(t,{inventory,referenced:[asset]})();const {directory,journal}=temporaryJournal(t);let reads=0;
 t.mock.method(R2Provider.prototype,'exists',async()=>{reads++;return false;});
 const r=await run({reconciliation,journal,executionArgs:['--dry-run'],...quiet});
 assert.deepEqual([r.referencedAssets,r.unreferencedAssets,r.eligible,r.skipped,r.estimatedBytes,r.migrated,reads],[1,1,1,1,3,0,1]);
 assert.deepEqual(fs.readdirSync(directory),[]);
});
test('production zero-reference inventory: 358 unreferenced assets, zero eligibility and zero destination calls',async t=>{
 const inventory=Array.from({length:358},(_,i)=>({...asset,asset_id:`unused-${i}`,public_id:`unused-${i}`}));
 const reconciliation=await setup(t,{inventory,referenced:[],environment:'production',database:'earn_task_platform_production'})();
 t.mock.method(R2Provider.prototype,'exists',async()=>assert.fail('unreferenced destination inspection'));
 const r=await run({reconciliation,...quiet});
 assert.deepEqual([r.total,r.referencedAssets,r.unreferencedAssets,r.eligible,r.estimatedBytes,r.migrated],[358,0,358,0,0,0]);
 for(const args of [executionArgs('unused.json'),[...executionArgs('unused.json'),'--confirm-production']])await assert.rejects(run({reconciliation,execute:true,journal:'unused.json',executionArgs:args,...quiet}),/production|Production/);
});
test('reproduced 2000/unrelated-database evidence attack is rejected before candidate selection',async t=>{
 setup(t);
 const reconciliation={completed:true,environment:'production',generatedAt:'2000-01-01T00:00:00Z',databaseName:'unrelated_database',references:[{classification:'exists',metadata:{assetId:asset.asset_id,version:1,bytes:3,resourceType:'image',deliveryType:'upload'}}]};
 await assert.rejects(run({reconciliation,...quiet}),/RECONCILIATION_EVIDENCE_NOT_ISSUED/);
});
test('issued evidence expires even when asset metadata is unchanged',async t=>{
 const reconciliation=await setup(t)();const now=Date.now();t.mock.method(Date,'now',()=>now+MAX_EVIDENCE_AGE_MS+1);
 await assert.rejects(run({reconciliation,...quiet}),/RECONCILIATION_STALE_OR_INVALID/);
});
test('missing, serialized, forged and unbound reports cannot authorize migration',async t=>{
 const issue=setup(t);const reconciliation=await issue();
 for(const r of [undefined,null,{},JSON.parse(JSON.stringify(reconciliation)),{...reconciliation,references:[]}])await assert.rejects(run({reconciliation:r,...quiet}),/RECONCILIATION_EVIDENCE_NOT_ISSUED/);
 const {result}=await collect(process.env);await assert.rejects(run({reconciliation:result,...quiet}),/RECONCILIATION_EVIDENCE_NOT_ISSUED/);
 assert.equal(Object.isFrozen(reconciliation.references),true);assert.equal(Object.isFrozen(reconciliation.references[0].metadata),true);
});
for(const [label,key,value]of [
 ['environment','NODE_ENV','production'],['database','MONGODB_URI','mongodb://127.0.0.1:1/another_database'],['cluster','MONGODB_URI','mongodb://127.0.0.2:1/fixture_staging'],
 ['Cloudinary account','CLOUDINARY_CLOUD_NAME','another-cloud'],['source prefix','CLOUDINARY_FOLDER_PREFIX','different/prefix'],['R2 bucket','R2_BUCKET','production-media'],['R2 account','R2_ACCOUNT_ID','b'.repeat(32)],
 ['Cloudinary credentials','CLOUDINARY_API_SECRET','different-fake'],['R2 credentials','R2_SECRET_ACCESS_KEY','different-fake'],
])test(`${label} mismatch rejects evidence before selecting assets`,async t=>{
 const reconciliation=await setup(t)();process.env[key]=value;
 await assert.rejects(run({reconciliation,...quiet}),/RECONCILIATION_TARGET_MISMATCH/);
});
test('effective provider, private mode and public URL overrides are rejected in dry-run too',async t=>{
 const reconciliation=await setup(t)();
 for(const [key,value]of [['MEDIA_STORAGE_PROVIDER','cloudinary'],['MEDIA_STORAGE_PROVIDER_IMAGES','cloudinary'],['R2_PRIVATE_BUCKET','false'],['R2_PUBLIC_BASE_URL','https://example.invalid']]){
  const old=process.env[key];process.env[key]=value;
  await assert.rejects(run({reconciliation,...quiet}));if(old===undefined)delete process.env[key];else process.env[key]=old;
 }
});
test('reproduced provider-override attack rejects production provider and injected staging authority',async t=>{
 const reconciliation=await setup(t)();const {journal,directory}=temporaryJournal(t);let copies=0;
 const provider={config:{accountId:'fake',bucket:'production-media'},upload:()=>{copies++;}};
 await assert.rejects(run({reconciliation,provider,env:{...process.env},source:async function*(){yield {...asset,public_id:'outside/image'};},copyAsset:()=>{copies++;},execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/MIGRATION_OVERRIDE_FORBIDDEN/);
 for(const key of ['provider','env','source','cloud','copyAsset'])await assert.rejects(run({reconciliation,[key]:undefined,...quiet}),/MIGRATION_OVERRIDE_FORBIDDEN/);
 assert.equal(copies,0);assert.deepEqual(fs.readdirSync(directory),[]);
});
test('referenced source outside confirmed prefix is rejected independently of provider checks',async t=>{
 const outside={...asset,public_id:'outside/image',secure_url:'https://res.cloudinary.com/test/image/upload/v1/outside/image.png'};
 const issue=setup(t,{inventory:[outside]});process.env.MEDIA_MIGRATION_SOURCE_PREFIXES='test/media';process.env.MEDIA_MIGRATION_SOURCE_PREFIXES_CONFIRM='test/media';const reconciliation=await issue();const {journal,directory}=temporaryJournal(t);
 await assert.rejects(run({reconciliation,...quiet}),/SOURCE_OUTSIDE_RECONCILED_SCOPE/);
 await assert.rejects(run({reconciliation:await issue(),execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/SOURCE_OUTSIDE_RECONCILED_SCOPE/);
 assert.deepEqual(fs.readdirSync(directory),[]);
});
test('production confirmations cannot use staging evidence; direct execute cannot omit CLI authorization',async t=>{
 const reconciliation=await setup(t)();const {journal}=temporaryJournal(t);
 await assert.rejects(run({reconciliation,execute:true,journal,...quiet}),/matching CLI authorization/);
 await assert.rejects(run({reconciliation,execute:false,executionArgs:executionArgs(journal),...quiet}),/matching CLI authorization/);
 process.env.NODE_ENV='production';
 await assert.rejects(run({reconciliation,execute:true,journal,executionArgs:[...executionArgs(journal),'--confirm-production'],...quiet}),/Production migration is disabled/);
});
test('destination conflicts and deterministic versioned keys fail closed',async t=>{
 const reconciliation=await setup(t)();t.mock.method(R2Provider.prototype,'exists',async()=>true);
 const r=await run({reconciliation,...quiet});assert.equal(r.eligible,0);assert.equal(r.conflicts,1);
 assert.notEqual(plan(asset,'test').key,plan({...asset,version:2},'test').key);
 assert.ok(plan({...asset,secure_url:'https://attacker.invalid/secret'},'test').reason);
});
test('unavailable destination never becomes an eligible asset',async t=>{
 const reconciliation=await setup(t)();t.mock.method(R2Provider.prototype,'exists',async()=>{throw Error('403');});
 const r=await run({reconciliation,...quiet});assert.equal(r.failed,1);assert.equal(r.eligible,0);
});
test('malformed references and metadata disagreement block migration',async t=>{
 const reconciliation=await setup(t,{referenced:[{...asset,bytes:4}]})();
 await assert.rejects(run({reconciliation,...quiet}),/RECONCILIATION_REVIEW_REQUIRED/);
});
test('duplicate inventory identities fail reconciliation instead of producing duplicate destination keys',async t=>{
 const issue=setup(t,{inventory:[asset,asset]});await assert.rejects(issue(),/DUPLICATE_INVENTORY_ASSET/);
});
test('cached journal cannot bypass evidence validation or changed reference/inventory scope',async t=>{
 const issue=setup(t);const reconciliation=await issue();const {journal,directory}=temporaryJournal(t);
 fs.writeFileSync(journal,JSON.stringify({scope:'old-scope',assets:{}}));
 await assert.rejects(run({reconciliation:JSON.parse(JSON.stringify(reconciliation)),execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/RECONCILIATION_EVIDENCE_NOT_ISSUED/);
 await assert.rejects(run({reconciliation,execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/MIGRATION_JOURNAL/);
 assert.deepEqual(fs.readdirSync(directory),['journal.json']);
});
test('mocked staging copy retries and resumes with fresh evidence; checksum mismatches remain failures',async t=>{
 const issue=setup(t);const {journal}=temporaryJournal(t);let exists=false,uploads=0,corrupt=true;
 const reconciliation=await issue();
 t.mock.method(global,'fetch',async()=>new Response('abc',{headers:{'content-type':'image/png'}}));
 t.mock.method(R2Provider.prototype,'exists',async()=>exists);
 t.mock.method(R2Provider.prototype,'upload',async input=>{assert.equal(fs.readFileSync(input.filePath,'utf8'),'abc');uploads++;exists=true;});
 t.mock.method(R2Provider.prototype,'send',async()=>({Body:Readable.from([Buffer.from(corrupt?'bad':'abc')])}));
 const input={reconciliation,execute:true,journal,executionArgs:executionArgs(journal),...quiet};
 const first=await run(input);assert.equal(first.failed,1);assert.equal(uploads,1);
 assert.equal(JSON.parse(fs.readFileSync(journal)).assets[plan(asset,'test').identity].attempts,3);
 corrupt=false;
 const fresh=await issue();
 t.mock.method(global,'fetch',async()=>new Response('abc',{headers:{'content-type':'image/png'}}));
 const next=await run({...input,reconciliation:fresh});assert.equal(next.migrated,1);assert.equal(uploads,1);assert.equal(fs.existsSync(journal+'.lock'),false);
});
test('issued evidence is single-use; changing a generation fingerprint cannot mint cached evidence',async t=>{
 const issue=setup(t);const reconciliation=await issue();await run({reconciliation,...quiet});
 await assert.rejects(run({reconciliation,...quiet}),/RECONCILIATION_EVIDENCE_NOT_ISSUED/);
 const cached=JSON.parse(JSON.stringify(reconciliation));cached.generatedAt=new Date().toISOString();cached.migrationBinding.generation='forged-new-generation';
 await assert.rejects(run({reconciliation:cached,...quiet}),/RECONCILIATION_EVIDENCE_NOT_ISSUED/);
 assert.equal((await run({reconciliation:await issue(),...quiet})).eligible,1);
});
test('source URL cannot point outside the referenced public identity despite matching asset metadata',async t=>{
 const issue=setup(t,{inventory:[{...asset,secure_url:'https://res.cloudinary.com/test/image/upload/v1/outside/image.png'}],referenced:[asset]});
 await assert.rejects(run({reconciliation:await issue(),...quiet}),/SOURCE_URL_SCOPE_MISMATCH/);
});
test('runtime mutation during destination inspection is stopped before mock upload',async t=>{
 const reconciliation=await setup(t)();const {journal}=temporaryJournal(t);let uploads=0;
 t.mock.method(global,'fetch',async()=>new Response('abc'));
 t.mock.method(R2Provider.prototype,'exists',async()=>{process.env.R2_BUCKET='production-media';return false;});
 t.mock.method(R2Provider.prototype,'upload',async()=>{uploads++;});
 await assert.rejects(run({reconciliation,execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/MIGRATION_RUNTIME_CHANGED/);
 assert.equal(uploads,0);
});
test('direct CLI invocation cannot bypass production blocking or load cached evidence',t=>{
 setup(t,{environment:'production',database:'earn_task_platform_production'});
 const {journal,directory}=temporaryJournal(t);
 const preload=path.join(directory,'no-env-file.cjs');
 fs.writeFileSync(preload,`require(${JSON.stringify(require.resolve('dotenv'))}).config=()=>({});`);
 const {spawnSync}=require('node:child_process');
 for(const args of [executionArgs(journal),[...executionArgs(journal),'--confirm-production'],['--dry-run','--evidence','cached.json']]){
  const child=spawnSync(process.execPath,['--require',require.resolve('./support/media-safety-guard'),'--require',preload,require.resolve('../scripts/migrate-media'),...args],{env:{...process.env},encoding:'utf8',timeout:10000});
  assert.equal(child.status,1);assert.match(child.stderr,/BLOCKED/);assert.equal(fs.existsSync(journal),false);assert.equal(fs.existsSync(journal+'.lock'),false);
 }
 assert.equal(require('../scripts/migrate-media').copy,undefined);
});
test('changed inventory or references invalidate the resume journal even with fresh evidence',async t=>{
 const issue=setup(t);const {journal}=temporaryJournal(t);const original=await issue();
 t.mock.method(global,'fetch',async()=>new Response('abc'));
 t.mock.method(R2Provider.prototype,'upload',async()=>{});
 t.mock.method(R2Provider.prototype,'send',async()=>({Body:Readable.from([Buffer.from('abc')])}));
 await run({reconciliation:original,execute:true,journal,executionArgs:executionArgs(journal),...quiet});
 // Add an unreferenced inventory entry without changing the referenced asset itself.
 const nextIssue=setup(t,{inventory:[asset,{...asset,asset_id:'unused',public_id:'unused'}],referenced:[asset]});
 await assert.rejects(run({reconciliation:await nextIssue(),execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/MIGRATION_JOURNAL/);
});
test('production confirmation is rejected by staging runtime rather than changing its identity',async t=>{
 const reconciliation=await setup(t)();const {journal}=temporaryJournal(t);
 await assert.rejects(run({reconciliation,execute:true,journal,executionArgs:[...executionArgs(journal),'--confirm-production'],...quiet}),/does not match runtime environment/);
});
test('future-dated issued evidence is rejected on clock rollback',async t=>{
 const reconciliation=await setup(t)();const now=Date.now();t.mock.method(Date,'now',()=>now-60000);
 await assert.rejects(run({reconciliation,...quiet}),/RECONCILIATION_STALE_OR_INVALID/);
});
test('legacy 21 referenced assets plus 19 external links plan safely without changing upload prefix',async t=>{
 const inventory=Array.from({length:21},(_,i)=>({...asset,asset_id:`legacy-${i}`,public_id:`earn-task-platform/${i%2?'videos':'images'}/item-${i}`,secure_url:`https://res.cloudinary.com/test/image/upload/v1/earn-task-platform/${i%2?'videos':'images'}/item-${i}.png`}));
 const unrelated=['samples','course_images','course_videos','skillforge_uploads','user_avatars'].map((root,i)=>({...asset,asset_id:`unrelated-${i}`,public_id:`${root}/file`}));
 const issue=setup(t,{inventory:[...inventory,...unrelated],referenced:inventory,prefix:'earn-task-platform/staging'});
 const originalDb=MongoClient.prototype.db;
 t.mock.method(MongoClient.prototype,'db',function(){const db=originalDb.call(this);const originalCollection=db.collection;db.collection=()=>{const c=originalCollection();const find=c.find;c.find=async function*(){yield* find();for(let i=0;i<19;i++)yield {_id:(100+i).toString(16).padStart(24,'0'),avatar:'https://example.invalid/external-'+i};};return c;};return db;});
 process.env.MEDIA_MIGRATION_SOURCE_PREFIXES='earn-task-platform/images,earn-task-platform/videos';
 const r=await run({reconciliation:await issue(),executionArgs:['--dry-run'],...quiet});
 assert.equal(r.eligible,21);assert.equal(r.externalOrLocalReferences,19);assert.equal(r.unreferencedAssets,5);assert.equal(r.status,'DRY_RUN_READY');assert.deepEqual(r.writes,{mongodb:0,r2:0,cloudinary:0});
 assert.equal(process.env.CLOUDINARY_FOLDER_PREFIX,'earn-task-platform/staging');
 assert.throws(()=>options(executionArgs('unused'),process.env),/MIGRATION_SOURCE_CONFIRMATION_REQUIRED/);
 process.env.MEDIA_MIGRATION_SOURCE_PREFIXES_CONFIRM=process.env.MEDIA_MIGRATION_SOURCE_PREFIXES;
 assert.equal(options(executionArgs('unused'),process.env).execute,true);
});
test('explicit scope cannot authorize unrelated roots, traversal, ambiguous prefixes or production',async t=>{
 const issue=setup(t,{prefix:'earn-task-platform/staging'});
 for(const scope of ['samples','course_images/items','course_videos/items','skillforge_uploads/items','user_avatars/items','earn-task-platform','earn-task-platform/images,earn-task-platform/images','earn-task-platform/images/../videos']){
  process.env.MEDIA_MIGRATION_SOURCE_PREFIXES=scope;await assert.rejects(issue(),/MIGRATION_SOURCE_SCOPE_INVALID/);
 }
 process.env.MEDIA_MIGRATION_SOURCE_PREFIXES='earn-task-platform/images';process.env.NODE_ENV='production';await assert.rejects(issue(),/MIGRATION_SOURCE_SCOPE_INVALID/);
});
test('safe diagnostics report actual scope error without echoing credentials or arbitrary messages',()=>{
 assert.equal(diagnostic(Error('SOURCE_OUTSIDE_RECONCILED_SCOPE')).blockReason,'CLOUDINARY_SOURCE_SCOPE');
 assert.equal(diagnostic(Object.assign(Error('secret'),{safeCode:'CLOUDINARY_METADATA_REQUEST_FAILED',httpStatus:401})).blockReason,'CLOUDINARY_ACCESS');
 assert.equal(diagnostic(Error('MIGRATION_JOURNAL')).blockReason,'MIGRATION_JOURNAL');
 assert.ok(!JSON.stringify(diagnostic(Error('mongodb://user:secret@host/db'))).includes('secret'));
});
test('bucket access is checked even for zero-reference dry-run and fails closed',async t=>{
 const issue=setup(t,{referenced:[]});t.mock.method(R2Provider.prototype,'send',async()=>{throw Error('credential-bearing provider details');});
 await assert.rejects(run({reconciliation:await issue(),...quiet}),e=>diagnostic(e).blockReason==='R2_ACCESS');
});
test('dry-run inspects supplied journals without modifying them or creating lock files',async t=>{
 const issue=setup(t);const {journal,directory}=temporaryJournal(t);fs.writeFileSync(journal,'malformed');
 await assert.rejects(run({reconciliation:await issue(),journal,executionArgs:['--dry-run','--journal',journal],...quiet}),/MIGRATION_JOURNAL/);
 assert.equal(fs.readFileSync(journal,'utf8'),'malformed');assert.deepEqual(fs.readdirSync(directory),['journal.json']);
});
test('missing confirmed Cloudinary source blocks migration, while API denial is not mistaken for missing',async t=>{
 const issue=setup(t,{inventory:[],referenced:[asset]});const r=await issue();assert.equal(r.missingCloudinarySources,1);
 await assert.rejects(run({reconciliation:r,...quiet}),/RECONCILIATION_REVIEW_REQUIRED/);
});
test('normal staging dry-run derives only referenced legacy image/video trees, without authorizing execute',async t=>{
 const inventory=Array.from({length:21},(_,i)=>{const type=i===20?'video':'image',folder=i===20?'videos':'images';return {...asset,asset_id:`auto-${i}`,resource_type:type,public_id:`earn-task-platform/${folder}/item-${i}`,secure_url:`https://res.cloudinary.com/test/${type}/upload/v1/earn-task-platform/${folder}/item-${i}.${i===20?'mp4':'png'}`};});
 const issue=setup(t,{inventory:[...inventory,{...asset,asset_id:'unused',public_id:'samples/image'}],referenced:inventory,prefix:'earn-task-platform/staging'});
 const r=await run({reconciliation:await issue(),executionArgs:['--dry-run'],...quiet});
 assert.deepEqual(r.sourcePrefixes,['earn-task-platform/images','earn-task-platform/videos']);assert.equal(r.sourceScopeMode,'REFERENCED_ASSETS');assert.equal(r.eligible,21);assert.equal(r.eligibleImages,20);assert.equal(r.eligibleVideos,1);assert.equal(r.unreferencedAssets,1);assert.deepEqual(r.writes,{mongodb:0,r2:0,cloudinary:0});
 assert.equal(process.env.MEDIA_MIGRATION_SOURCE_PREFIXES,undefined);assert.equal(process.env.CLOUDINARY_FOLDER_PREFIX,'earn-task-platform/staging');
 const {journal,directory}=temporaryJournal(t);
 await assert.rejects(run({reconciliation:await issue(),execute:true,journal,executionArgs:executionArgs(journal),...quiet}),/MIGRATION_SOURCE_CONFIRMATION_REQUIRED/);
 assert.deepEqual(fs.readdirSync(directory),[]);
});
for(const prefix of ['samples','course_images','course_videos','skillforge_uploads','user_avatars','earn-task-platform/production','earn-task-platform/images/production'])test(`automatic scope refuses referenced ${prefix}`,async t=>{
 const item={...asset,public_id:prefix+'/file',secure_url:`https://res.cloudinary.com/test/image/upload/v1/${prefix}/file.png`};
 const issue=setup(t,{inventory:[item],prefix:'earn-task-platform/staging'});await assert.rejects(issue(),/SOURCE_OUTSIDE_RECONCILED_SCOPE/);
});
test('explicit source scope is not widened by automatic derivation',async t=>{
 const item={...asset,public_id:'earn-task-platform/images/image',secure_url:'https://res.cloudinary.com/test/image/upload/v1/earn-task-platform/images/image.png'};
 const issue=setup(t,{inventory:[item],prefix:'earn-task-platform/staging'});process.env.MEDIA_MIGRATION_SOURCE_PREFIXES='earn-task-platform/videos';
 await assert.rejects(run({reconciliation:await issue(),...quiet}),/SOURCE_OUTSIDE_RECONCILED_SCOPE/);
});
