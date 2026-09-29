// Full local application + isolated MongoDB + real staging R2. No production DB or Cloudinary I/O.
require('dotenv').config();
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const mongoose=require('mongoose');
process.env.NODE_ENV='test';process.env.MEDIA_STORAGE_PROVIDER='r2';
for(const category of ['IMAGES','VIDEOS','REELS','DOCUMENTS']) delete process.env['MEDIA_STORAGE_PROVIDER_'+category];
for(const name of ['MONGODB_URI','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']) delete process.env[name];
process.env.JWT_SECRET=randomBytes(32).toString('hex');process.env.JWT_REFRESH_SECRET=randomBytes(32).toString('hex');
const Provider=require('../src/services/storage/r2.provider'),storage=require('../src/services/storage/storage.service');
const {ListObjectsV2Command,GetBucketCorsCommand}=require('@aws-sdk/client-s3');
const report={startedAt:new Date().toISOString(),scope:'Full application on localhost; disposable MongoDB; real staging R2',browserRequested:process.env.R2_BROWSER_TEST==='true',checks:{},failures:[]};
const prefix='test/app-'+randomUUID()+'/';let provider,mongo,server,dir,base,browser;const tracked=new Set();
const hash=b=>createHash('sha256').update(b).digest('base64');
async function request(method,route,token,body){const r=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});return {status:r.status,body:await r.json()};}
const check=(name,actual,expected)=>{report.checks[name]={status:actual,expected,pass:actual===expected};};
async function put(key,bytes,mime){tracked.add(key);const signed=await storage.presignUpload({storageKey:key,mimeType:mime,size:bytes.length,checksum:hash(bytes)});const r=await fetch(signed.url,{method:'PUT',headers:signed.headers,body:bytes});await r.arrayBuffer();assert.equal(r.status,200);}
(async()=>{try{
 if(process.env.R2_STAGING_TEST!=='true'||!/(?:^|[-_])(staging|test)(?:$|[-_])/.test(process.env.R2_BUCKET||''))throw Error('Staging opt-in required');
 provider=new Provider();dir=fs.mkdtempSync(path.join(os.tmpdir(),'earn-r2-app-'));process.env.UPLOAD_DIR=path.join(dir,'uploads');mongo=await require('../test/support/mongo').startMongo(dir);await mongoose.connect(mongo.uri,{serverSelectionTimeoutMS:15000});
 const app=require('../src/server');for(const model of Object.values(mongoose.models))await model.init();server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base=`http://127.0.0.1:${server.address().port}`;
 const tokens=[];const ids=[];for(const name of ['a','b']){const body={email:`r2${name}@example.com`,username:`r2user${name}`,name:'Disposable '+name,password:randomUUID()};const r=await request('POST','/api/auth/signup',null,body);check('signup'+name,r.status,201);assert.equal(r.status,201);ids.push(r.body.data.user.id);const login=await request('POST','/api/auth/login',null,{email:body.email,password:body.password});check('login'+name,login.status,200);tokens.push(login.body.data.accessToken);}
 if(process.env.R2_BROWSER_TEST==='true'){const origin=process.env.R2_BROWSER_ORIGIN||(process.env.CORS_ORIGINS||'').split(',')[0];browser=await require('../test/support/r2-browser').start(origin,base);}
 const Media=require('../src/models/Media');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1cAAAAASUVORK5CYII=','base64');
 const validInput={category:'images',mimeType:'image/png',size:png.length,checksum:hash(png)};
 check('anonymousInit',(await request('POST','/api/media/upload/init',null,validInput)).status,401);
 for(const [name,body] of [['invalidMime',{...validInput,mimeType:'text/html'}],['oversized',{...validInput,size:11*1024*1024}],['invalidCategory',{...validInput,category:'other'}]]) check(name,(await request('POST','/api/media/upload/init',tokens[0],body)).status,400);
 for(const [label,bytes,mime,category] of [['image',png,'image/png','images'],['video',fs.readFileSync(path.join(__dirname, '../test/fixtures/staging-video.mp4')),'video/mp4','videos'],['reel',fs.readFileSync(path.join(__dirname, '../test/fixtures/staging-video.mp4')),'video/mp4','reels']]){
 const input={category,mimeType:mime,size:bytes.length,checksum:hash(bytes)};
 const init=await (browser?browser.request:request)('POST','/api/media/upload/init',tokens[0],input);check(label+'Init',init.status,201);let media;
 if(init.status===201){media=await Media.findById(init.body.data.media.id);tracked.add(media.storageKey);const signed=init.body.data.upload;let putStatus;if(browser){putStatus=await browser.put(signed,bytes);report.checks[label+'BrowserPreflight']='PASS';}else{const r=await fetch(signed.url,{method:'PUT',headers:signed.headers,body:bytes});await r.arrayBuffer();putStatus=r.status;}check(label+'Put',putStatus,200);const complete=await (browser?browser.request:request)('POST',`/api/media/${media.id}/complete`,tokens[0]);check(label+'Complete',complete.status,200);const duplicate=await request('POST',`/api/media/${media.id}/complete`,tokens[0]);check(label+'DuplicateComplete',duplicate.status,200);}
 else {throw Error('Real upload initialization failed; no seeded fallback permitted');}
 for(const [name,method,suffix,token,expected] of [['anonymousDelete','DELETE','',null,401],['anonymousDownload','GET','/download',null,401],['anonymous','GET','',null,401],['ownerView','GET','',tokens[0],200],['otherDelete','DELETE','',tokens[1],403],['otherModify','POST','/complete',tokens[1],403],['otherSignedUrl','GET','/download',tokens[1],403]]){const r=await request(method,`/api/media/${media.id}${suffix}`,token);check(label+name,r.status,expected);}
 const down=await request('GET',`/api/media/${media.id}/download`,tokens[0]);check(label+'OwnerDownload',down.status,200);const response=await fetch(down.body.data.url);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 const modified=new URL(down.body.data.url);modified.searchParams.set('X-Amz-Expires','899');check(label+'ModifiedDownload',(await fetch(modified)).status,403);
 const wrong=new URL(down.body.data.url);wrong.pathname+='.wrong';check(label+'WrongObject',(await fetch(wrong)).status,403);
 const expiring=await provider.getUrl(media,{expiresIn:1});await new Promise(r=>setTimeout(r,2100));check(label+'ExpiredDownload',(await fetch(expiring)).status,403);
 report.checks[label+'Content']='PASS';const meta=await storage.getMetadata(media);assert.equal(meta.mimeType,mime);assert.equal(meta.size,bytes.length);assert.equal(String(media.user),String(ids[0]));assert.ok(media.type&&media.createdAt);
 const extra=await request('POST','/api/posts',tokens[0],{mediaId:media.id,type:label==='reel'?'reel':label,videoDuration:10});check(label+'Post',extra.status,201);
 if(label==='image'){const profile=await request('PUT','/api/auth/profile',tokens[0],{mediaId:media.id});report.checks.profileImage={status:profile.status,actuallyAttached:profile.body.data?.user?.avatar?.includes(media.id)||false};const story=await request('POST','/api/stories',tokens[0],{mediaId:media.id,type:'image'});check('storyMedia',story.status,201);}
 const deletion=await request('DELETE',`/api/media/${media.id}`,tokens[0]);report.checks[label+'DeleteStatus']=deletion.status;
 if(deletion.status===202){await Media.updateOne({_id:media.id},{expiresAt:new Date(Date.now()-120000)});await require('./cleanup-media')();report.expiryAdvancedForWorkerTest=true;}
 assert.equal(await provider.exists(media),false);check(label+'DeletedDownload',(await fetch(down.body.data.url)).status,404);assert.equal((await Media.findById(media.id)).status,'deleted');tracked.delete(media.storageKey);const repeated=await request('DELETE',`/api/media/${media.id}`,tokens[0]);check(label+'RepeatedDelete',repeated.status,200);
 }
 const feed=await request('GET','/api/posts/feed',tokens[0]);check('feed',feed.status,200);
 const recoveryBytes=png;
 for(const mode of ['dbFailureAfterUpload','confirmationMismatch','uploadFailure']) {
  const key=prefix+mode;tracked.add(key);
  const m=await Media.create({user:ids[0],provider:'r2',storageKey:key,category:'images',mimeType:'image/png',size:png.length,checksum:hash(png),status:'pending',expiresAt:new Date(Date.now()+300000)});
  if(mode!=='uploadFailure')await put(key,mode==='confirmationMismatch'?Buffer.from('not valid image bytes'):recoveryBytes,'image/png');
  const originalUpdate=Media.findOneAndUpdate;
  if(mode==='dbFailureAfterUpload')Media.findOneAndUpdate=async()=>{throw Object.assign(new Error('Injected database failure'),{code:'TEST_DB_FAILURE'});};
  try { const r=await request('POST',`/api/media/${m.id}/complete`,tokens[0]);check(mode,r.status,mode==='dbFailureAfterUpload'?500:mode==='confirmationMismatch'?400:404); }
  finally{Media.findOneAndUpdate=originalUpdate;}
  await Media.updateOne({_id:m.id},{expiresAt:new Date(Date.now()-120000)});await require('./cleanup-media')();assert.equal(await provider.exists(m),false);tracked.delete(key);report.checks[mode+'Cleanup']='PASS';
 }
 const absent=await request('GET','/api/media/'+randomUUID(),tokens[0]);check('nonexistentMedia',absent.status,404);

 for(const [name,body] of [['unsafeFilename',{category:'images',mimeType:'image/png',size:png.length,checksum:hash(png),filename:'../../evil.png'}],['clientObjectKey',{category:'images',mimeType:'image/png',size:png.length,checksum:hash(png),storageKey:'other/object'}],['malformed',null]]){const r=await request('POST','/api/media/upload/init',tokens[0],body);check(name,r.status,400);}
 try{const cors=await provider.client.send(new GetBucketCorsCommand({Bucket:provider.config.bucket}));report.cors={rules: cors.CORSRules?.map(r=>({methods:r.AllowedMethods,headers:r.AllowedHeaders,originCount:r.AllowedOrigins?.length}))||[]};}catch(e){report.cors={status:'BLOCKED',httpStatus:e.$metadata?.httpStatusCode||null};}
 }catch(e){report.failures.push(['R2_PRIVATE_BUCKET_REQUIRED','R2_PUBLIC_URL_UNSUPPORTED','R2_NOT_CONFIGURED'].includes(e.code)?e.code:'Validation failed; sensitive details suppressed');process.exitCode=1;}
 finally{
 const cleanupErrors=[];if(provider){for(const key of tracked){try{await storage.delete({provider:'r2',storageKey:key});assert.equal(await provider.exists({storageKey:key}),false);}catch{cleanupErrors.push('Object cleanup failed');}}try{const remaining=await provider.client.send(new ListObjectsV2Command({Bucket:provider.config.bucket,Prefix:prefix}));report.cleanup={remaining:remaining.KeyCount,status:remaining.KeyCount===0&&!cleanupErrors.length?'PASS':'BLOCKED',errors:cleanupErrors};}catch{report.cleanup={status:'BLOCKED'};}provider.client.destroy();}
 if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await mongoose.disconnect();await require('../test/support/mongo').stopMongo(mongo?.child);if(dir)fs.rmSync(dir,{recursive:true,force:true});if(report.failures.length || Object.values(report.checks).some(c=>c?.pass===false||c?.actuallyAttached===false)) process.exitCode=1;report.completedAt=new Date().toISOString();fs.writeFileSync(process.env.R2_BROWSER_TEST==='true'?'/tmp/earn-r2-browser-report.json':'/tmp/earn-r2-app-report.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report));
 }
})();
