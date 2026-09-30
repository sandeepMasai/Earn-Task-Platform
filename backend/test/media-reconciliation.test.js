require('./support/media-safety-guard');
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseUrl,normalize,extract,reconcile}=require('../src/services/reconciliation-media');
const a={public_id:'folder/photo',asset_id:'immutable',resource_type:'image',type:'upload',bytes:12,format:'png',version:1};
const url='https://res.cloudinary.com/test/image/upload/v1/folder/photo.png';
test('normalizes transformed/signed URL identities without retaining URLs or tokens',()=>{
 for(const u of [url,'https://res.cloudinary.com/test/image/upload/s--redacted--/c_fill,w_100/v1/folder/photo.png?token=secret'])assert.equal(parseUrl(u,'test').public_id,'folder/photo');
 assert.equal(parseUrl('https://res.cloudinary.com/test/raw/upload/v1/file.pdf','test').public_id,'file.pdf');
 assert.equal(parseUrl(url,'other').kind,'malformed');assert.equal(parseUrl('https://example.com/image','test').kind,'external');
 assert.equal(normalize({provider:'r2',storageKey:'test/file'},'test').kind,'r2');
 assert.equal(normalize({publicId:'different',resourceType:'image',secureUrl:url},'test').kind,'malformed');
});
test('read-only reconciliation separates missing, duplicate, unreferenced, malformed, R2 and external refs',async()=>{
 const refs=[...extract('User',{_id:'a'.repeat(24),avatar:url,avatarAsset:{publicId:a.public_id,assetId:a.asset_id,resourceType:'image',size:12,format:'png',version:1}},['avatar','avatarAsset'],'test'),...extract('Post',{_id:'b'.repeat(24),imageUrl:url,videoUrl:'https://res.cloudinary.com/test/video/upload/v1/missing.mp4',thumbnailUrl:'https://res.cloudinary.com/other/image/upload/image.png'},['imageUrl','videoUrl','thumbnailUrl'],'test'),...extract('Media',{_id:'c'.repeat(24),provider:'r2',storageKey:'key'},[],'test')];
 let lookups=0;const r=await reconcile({inventory:[a,{...a,asset_id:'unreferenced',public_id:'unused'}],references:refs,lookup:async()=>{lookups++;return null;}});
 assert.equal(lookups,1);assert.equal(r.dbMediaReferences,5);assert.equal(r.referencesWithExistingSource,2);assert.equal(r.missingCloudinarySources,1);assert.equal(r.duplicateDbReferences,1);assert.equal(r.unreferencedCloudinaryAssets,1);assert.equal(r.alreadyR2References,1);assert.equal(r.malformedReferences,1);assert.equal(r.totalReferencedBytes,12);assert.equal(r.totalInventoryBytes,24);assert.equal(r.readiness,'REVIEW_REQUIRED');assert.equal(r.completed,true);assert.ok(!JSON.stringify(r).includes('https://'));
});
test('API failures do not become missing assets; metadata mismatches prevent readiness',async()=>{
 const refs=extract('User',{_id:'a'.repeat(24),avatarAsset:{publicId:a.public_id,assetId:'different',resourceType:'image'}},['avatarAsset'],'test');
 const r=await reconcile({inventory:[a],references:refs,lookup:async()=>assert.fail()});assert.equal(r.metadataMismatches,1);assert.equal(r.readiness,'REVIEW_REQUIRED');
 await assert.rejects(reconcile({inventory:[],references:refs,lookup:async()=>{throw Error('403');}}));
});
test('Cloudinary reader sends only authenticated GET and distinguishes 404 from 403',async()=>{
 const {cloudReader}=require('../scripts/reconcile-media');const env={CLOUDINARY_CLOUD_NAME:'test',CLOUDINARY_API_KEY:'fake',CLOUDINARY_API_SECRET:'fake'};
 const get=cloudReader(env,async(url,options)=>{assert.equal(options.method,'GET');assert.equal(options.redirect,'error');return new Response('',{status:404});});assert.equal(await get('/image/upload/missing',{},true),null);
 await assert.rejects(cloudReader(env,async()=>new Response('',{status:403}))('/image/upload/missing',{},true),e=>e.httpStatus===403);
});
test('missing identities also count duplicates and standalone Cloudinary Media is normalized',async()=>{
 const refs=['a','b'].flatMap(c=>extract('Media',{_id:c.repeat(24),provider:'cloudinary',storageKey:'missing',category:'videos',size:9},[],'test'));
 const result=await reconcile({inventory:[],references:refs,lookup:async()=>null});
 assert.equal(result.missingCloudinarySources,2);assert.equal(result.duplicateDbReferences,1);assert.equal(result.uniqueCloudinaryIdentities,1);assert.equal(result.malformedReferences,0);
});
for (const environment of ['staging','production']) test(`${environment} readiness uses the actual environment`,async()=>{
 const references=extract('User',{_id:'a'.repeat(24),avatar:url},['avatar'],'test');
 const r=await reconcile({inventory:[a],references,environment,lookup:async()=>assert.fail()});
 assert.equal(r.environment,environment);
 assert.equal(r.readiness,`RECONCILIATION READY FOR ${environment.toUpperCase()} MIGRATION REVIEW`);
 assert.equal(r.referencedCloudinaryAssets,1);
});
test('zero production references never imply migration readiness',async()=>{
 const inventory=Array.from({length:358},(_,i)=>({...a,asset_id:`asset-${i}`,public_id:`unused-${i}`}));
 const r=await reconcile({inventory,references:[],environment:'production',lookup:async()=>assert.fail()});
 assert.equal(r.readiness,'PRODUCTION: NO REFERENCED CLOUDINARY ASSETS — NO MIGRATION CANDIDATES');
 assert.equal(r.referencedCloudinaryAssets,0);assert.equal(r.unreferencedCloudinaryAssets,358);assert.equal(r.totalReferencedBytes,0);
});
test('unknown environment cannot report migration readiness',async()=>{
 const r=await reconcile({inventory:[a],references:extract('User',{_id:'a'.repeat(24),avatar:url},['avatar'],'test'),lookup:async()=>assert.fail()});
 assert.equal(r.readiness,'ENVIRONMENT_REVIEW_REQUIRED');
});
