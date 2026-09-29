#!/usr/bin/env node
// Read-only: native MongoDB find/listCollections and authenticated Cloudinary GET only.
// Never import application models, middleware, storage providers or migration execution.
const fs=require('node:fs');
const path=require('node:path');
const {MongoClient}=require('mongodb');
const {definitions,extract,reconcile}=require('../src/services/reconciliation-media');
function safeFailure(code,status){return Object.assign(new Error(code),{safeCode:code,httpStatus:status});}
function cloudReader(env, fetcher=fetch){
  const base=`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/resources`;
  const authorization='Basic '+Buffer.from(env.CLOUDINARY_API_KEY+':'+env.CLOUDINARY_API_SECRET).toString('base64');
  return async function get(suffix,params={},allowMissing=false){
    const u=new URL(base+suffix);for(const [k,v]of Object.entries(params))if(v!==undefined)u.searchParams.set(k,v);
    for(let attempt=0;attempt<3;attempt++){
      let response;
      try{response=await fetcher(u,{method:'GET',headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(30000)});}catch{if(attempt<2){await new Promise(r=>setTimeout(r,500*(attempt+1)));continue;}throw safeFailure('CLOUDINARY_NETWORK_FAILURE');}
      if(response.status===404&&allowMissing)return null;
      if((response.status===429||response.status>=500)&&attempt<2){await response.arrayBuffer();await new Promise(r=>setTimeout(r,1000*(attempt+1)));continue;}
      if(!response.ok)throw safeFailure('CLOUDINARY_METADATA_REQUEST_FAILED',response.status);
      return response.json();
    }
  };
}
async function main(args=process.argv.slice(2)){
  let out;
  for(let i=0;i<args.length;i++){if(args[i]==='--out'&&args[i+1]&&!args[i+1].startsWith('--'))out=args[++i];else throw safeFailure('INVALID_ARGUMENTS');}
  require('dotenv').config({path:path.join(__dirname,'../.env')});
  for(const key of ['MONGODB_URI','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'])if(!process.env[key])throw safeFailure('RECONCILIATION_CONFIGURATION_MISSING');
  const env=process.env,get=cloudReader(env),inventory=[];
  for(const resource of ['image','video','raw'])for(const type of ['upload','private','authenticated']){
    let cursor;const cursors=new Set();
    do{const page=await get(`/${resource}/${type}`,{max_results:500,next_cursor:cursor});if(!Array.isArray(page.resources))throw safeFailure('INVALID_CLOUDINARY_INVENTORY');inventory.push(...page.resources);cursor=page.next_cursor;if(cursor&&cursors.has(cursor))throw safeFailure('REPEATED_INVENTORY_CURSOR');if(cursor)cursors.add(cursor);}while(cursor);
  }
  const client=new MongoClient(env.MONGODB_URI,{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000,readPreference:'primary',readConcern:{level:'majority'},monitorCommands:true});
  const commands={};client.on('commandStarted',event=>{commands[event.commandName]=(commands[event.commandName]||0)+1;});
  const references=[],coverage=[];
  try{
    await client.connect();const db=client.db();const collections=new Set((await db.listCollections({},{nameOnly:true}).toArray()).map(c=>c.name));
    for(const [model,collection,fields]of definitions){
      const entry={model,collection,fields,documentsScanned:0,present:collections.has(collection)};coverage.push(entry);if(!entry.present)continue;
      const projection=Object.fromEntries(['_id',...fields].map(f=>[f,1]));
      for await(const doc of db.collection(collection).find({},{projection,batchSize:200,maxTimeMS:30000})){
        entry.documentsScanned++;references.push(...extract(model,doc,fields,env.CLOUDINARY_CLOUD_NAME));
      }
    }
    const result=await reconcile({inventory,references,lookup:r=>get(`/${r.resource_type}/${r.type}/${encodeURIComponent(r.public_id)}`,{},true)});
    result.coverage=coverage;result.databaseName=db.databaseName;result.databaseScopeWarning=coverage.every(c=>c.documentsScanned===0)?'All inspected media collections are empty. This result does not validate references in any other database.':null;
    result.modelsWithoutMedia=['CoinConfig','RateLimitBucket','ReconciliationAudit (wallet audit)','Transaction','WatchSession (videoId is a task URL hash)','Withdrawal','WithdrawalSettings'];
    result.verification={method:'Authenticated Cloudinary Admin metadata GET; missing inventory entries confirmed with individual resource GET',contentDownloaded:false,originalContentChecksumVerified:false,scope:'Current image/video/raw assets with upload/private/authenticated delivery; all DB records in projected media fields, including inactive records',consistency:'MongoDB majority reads; no cross-service atomic snapshot',mongoCommands:commands};
    result.generatedAt=new Date().toISOString();
    if(out)fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    const {references:details,unreferenced,...summary}=result;
    console.log(JSON.stringify({...summary,issues:details.filter(r=>r.classification==='missing'||r.classification==='malformed'||r.metadataMismatch)},null,2));
    return result;
  }finally{await client.close();}
}
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({completed:false,error:e.safeCode||'RECONCILIATION_FAILED',databaseErrorCode:typeof e.code==='number'?e.code:undefined,httpStatus:e.httpStatus||null,networkCode:['ENOTFOUND','ECONNREFUSED','ETIMEDOUT'].includes(e.code)?e.code:undefined,writes:{r2:0,mongodb:0,cloudinary:0}}));process.exitCode=1;});
module.exports={main,cloudReader};
