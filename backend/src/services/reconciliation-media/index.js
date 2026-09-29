const { createHash } = require('node:crypto');
const fingerprint = value => createHash('sha256').update(value).digest('hex');
const identity = a => JSON.stringify([a.resource_type, a.type, a.public_id]);
const definitions = [
  ['User', 'users', ['avatar', 'avatarAsset', 'creatorYouTubeUrl', 'creatorInstagramUrl']],
  ['Post', 'posts', ['imageUrl', 'videoUrl', 'documentUrl', 'thumbnailUrl', 'mediaAsset', 'comments.attachments', 'comments.mediaAsset', 'comments.imageUrl', 'comments.videoUrl']],
  ['Story', 'stories', ['mediaUrl', 'thumbnailUrl', 'mediaAsset']],
  ['Task', 'tasks', ['videoUrl', 'thumbnail', 'instagramUrl', 'youtubeUrl']],
  ['TaskSubmission', 'tasksubmissions', ['proofImage', 'proofAsset']],
  ['CreatorCoinRequest', 'creatorcoinrequests', ['paymentProof', 'proofAsset']],
  ['Media', 'media', ['provider', 'storageKey', 'category', 'mimeType', 'size', 'status', 'renditions']],
  // No message/comment attachment models currently exist; inspect legacy collections if present.
  ['Message (legacy)', 'messages', ['attachments', 'mediaAsset', 'imageUrl', 'videoUrl', 'fileUrl', 'thumbnailUrl']],
  ['Comment (legacy)', 'comments', ['attachments', 'mediaAsset', 'imageUrl', 'videoUrl', 'fileUrl', 'thumbnailUrl']],
];
function parseUrl(value, cloud) {
  if (typeof value !== 'string') return { kind: 'malformed', reason: 'non_string_url' };
  if (/^(?:https?:\/\/[^/]+)?\/api\/media\/[^/]+\/content(?:[?#]|$)/.test(value)) return { kind: 'r2', token: value.split('/api/media/')[1].split('/')[0], reason: 'application_media_link' };
  let u;
  try { u = new URL(value); } catch { return { kind: /cloudinary/i.test(value) ? 'malformed' : 'external', reason: 'unrecognized_or_local_reference' }; }
  if (u.hostname !== 'res.cloudinary.com') return { kind: /(?:^|\.)cloudinary\.com$/.test(u.hostname) ? 'malformed' : 'external', reason: 'unsupported_host_or_external_reference' };
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return { kind: 'malformed', reason: 'invalid_cloudinary_url' };
  let parts;
  try { parts = u.pathname.split('/').slice(1).map(decodeURIComponent); } catch { return { kind: 'malformed', reason: 'invalid_url_encoding' }; }
  const [account, resource_type, type, ...tail] = parts;
  if (account !== cloud) return { kind: 'malformed', reason: 'different_cloudinary_account' };
  if (!['image','video','raw'].includes(resource_type) || !['upload','private','authenticated'].includes(type)) return { kind: 'malformed', reason: 'unsupported_delivery_or_resource_type' };
  if (/^s--.*--$/.test(tail[0] || '')) tail.shift();
  const v = tail.findIndex(x => /^v\d+$/.test(x));
  let segments = v >= 0 ? tail.slice(v + 1) : [...tail];
  if (v < 0) while (segments.length > 1 && /^(?:[a-z]{1,3}_|t_)/.test(segments[0])) segments.shift();
  let public_id = segments.join('/');
  if (resource_type !== 'raw') public_id = public_id.replace(/\.[a-zA-Z0-9]+$/, '');
  if (!public_id || segments.some(s => !s || s === '.' || s === '..')) return { kind: 'malformed', reason: 'missing_or_invalid_public_id' };
  return { kind: 'cloudinary', resource_type, type, public_id, version: v >= 0 ? tail[v].slice(1) : undefined };
}
function normalize(value, cloud) {
  if (typeof value === 'string') return parseUrl(value, cloud);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { kind:'malformed',reason:'invalid_reference_shape' };
  if (value.provider === 'r2') return value.storageKey ? {kind:'r2',token:value.storageKey,reason:'provider_r2'} : {kind:'malformed',reason:'r2_storage_key_missing'};
  if (value.provider && value.provider !== 'cloudinary') return {kind:'malformed',reason:'unsupported_provider'};
  if (value.publicId && ['image','video','raw'].includes(value.resourceType)) {
    const url = value.secureUrl ? parseUrl(value.secureUrl,cloud) : null;
    const result={kind:'cloudinary',public_id:value.publicId,resource_type:value.resourceType,type:url?.kind==='cloudinary'?url.type:'upload',asset_id:value.assetId,bytes:value.size,format:value.format,version:value.version};
    if (url && (url.kind!=='cloudinary'||identity(url)!==identity(result))) return {kind:'malformed',reason:'embedded_identity_url_disagreement'};
    return result;
  }
  if (value.secureUrl || value.url) return parseUrl(value.secureUrl || value.url,cloud);
  return {kind:'malformed',reason:'missing_cloudinary_identity'};
}
function valuesAt(value, parts, field='') {
  if (Array.isArray(value)) return value.flatMap((x,i)=>valuesAt(x,parts,`${field}[${i}]`));
  if (!parts.length) return value == null || value === '' ? [] : [{value,field}];
  if (!value || typeof value !== 'object') return [];
  const [head,...rest]=parts;return valuesAt(value[head],rest,field?`${field}.${head}`:head);
}
function extract(model, doc, fields, cloud) {
  const id=String(doc._id);const recordId=/^[a-f\d-]{24,36}$/i.test(id)?id:fingerprint(id);
  const located=(field,value)=>({model,recordId,field,reference:normalize(value,cloud)});
  if(model==='Media') {
    const main=normalize(doc.provider==='cloudinary'?{provider:'cloudinary',publicId:doc.storageKey,resourceType:({images:'image',videos:'video',reels:'video',documents:'raw'})[doc.category],size:doc.size}:doc,cloud);
    return [{model,recordId,field:'provider/storageKey',reference:main},...(doc.renditions||[]).map((r,i)=>({model,recordId,field:`renditions[${i}].storageKey`,reference:doc.provider==='r2'?{kind:'r2',token:r.storageKey}:{kind:'malformed',reason:'unsupported_rendition_identity'}}))];
  }
  return fields.flatMap(field=>valuesAt(doc,field.split('.')).map(x=>located(x.field,x.value)));
}
async function reconcile({inventory,references,lookup}) {
  const byIdentity=new Map(),byId=new Map();
  for(const a of inventory){if(!a.asset_id||!a.public_id||!Number.isSafeInteger(a.bytes)||a.bytes<0)throw Error('INVALID_INVENTORY_METADATA');if(byId.has(a.asset_id))throw Error('DUPLICATE_INVENTORY_ASSET');byIdentity.set(identity(a),a);byId.set(a.asset_id,a);}
  const out={completed:true,cloudinaryInventory:inventory.length,dbMediaReferences:0,referencesWithExistingSource:0,missingCloudinarySources:0,unreferencedCloudinaryAssets:0,duplicateDbReferences:0,malformedReferences:0,alreadyR2References:0,externalOrLocalReferences:0,totalReferencedBytes:0,totalInventoryBytes:inventory.reduce((s,a)=>s+a.bytes,0),metadataMismatches:0,references:[],unreferenced:[]};
  const used=new Set(),seen=new Set(),seenReferences=new Set(),logical=new Map(),cache=new Map();
  for(const item of references){
    const r=item.reference;
    const token=r.kind==='cloudinary'?identity(r):JSON.stringify([r.kind,r.token||item.field,r.reason]);
    const key=JSON.stringify([item.model,item.recordId,token]);
    if(logical.has(key)){const previous=logical.get(key);previous.fields.push(item.field);previous.observations.push(r);continue;}
    logical.set(key,{model:item.model,recordId:item.recordId,fields:[item.field],observations:[r],r});
  }
  for(const entry of logical.values()){
    const {r,observations,...location}=entry;const row={model:location.model,recordId:location.recordId,fields:location.fields};out.references.push(row);out.dbMediaReferences++;
    if(r.kind==='external'){row.classification='external_or_local';out.externalOrLocalReferences++;continue;}
    if(r.kind==='r2'){row.classification='already_r2';out.alreadyR2References++;continue;}
    if(r.kind==='malformed'){row.classification='malformed';row.reason=r.reason;out.malformedReferences++;continue;}
    const k=identity(r);if(seenReferences.has(k)){row.duplicate=true;out.duplicateDbReferences++;}else seenReferences.add(k);let asset=byIdentity.get(k);
    const knownIds=observations.map(x=>x.asset_id).filter(Boolean);
    if(!asset){
      if(!cache.has(k))cache.set(k,await lookup(r));asset=cache.get(k);
      if(asset && (!asset.asset_id||!Number.isSafeInteger(asset.bytes)||asset.bytes<0))throw Error('INVALID_LOOKUP_METADATA');
      if(asset)byIdentity.set(k,asset);
    }
    row.identityFingerprint=fingerprint(k);
    if(!asset){row.classification='missing';row.reason=knownIds.some(id=>byId.has(id))?'public_id_missing_but_immutable_asset_id_exists_elsewhere':'source_not_found';out.missingCloudinarySources++;continue;}
    row.classification='exists';out.referencesWithExistingSource++;
    row.metadata={assetId:asset.asset_id,resourceType:asset.resource_type,deliveryType:asset.type,bytes:asset.bytes,format:asset.format||null,version:asset.version};
    const mismatch=observations.some(x=>(x.asset_id&&x.asset_id!==asset.asset_id)||(x.bytes!==undefined&&x.bytes!==asset.bytes)||(x.version&&String(x.version)!==String(asset.version))||(x.format&&x.format!==asset.format));
    if(mismatch){row.metadataMismatch=true;out.metadataMismatches++;}
    if(!seen.has(asset.asset_id)){seen.add(asset.asset_id);out.totalReferencedBytes+=asset.bytes;}
    used.add(asset.asset_id);
  }
  out.unreferenced=inventory.filter(a=>!used.has(a.asset_id)).map(a=>({assetId:a.asset_id,identityFingerprint:fingerprint(identity(a)),resourceType:a.resource_type,bytes:a.bytes}));
  out.unreferencedCloudinaryAssets=out.unreferenced.length;
  out.readiness=out.missingCloudinarySources||out.malformedReferences||out.metadataMismatches?'REVIEW_REQUIRED':'RECONCILIATION READY FOR STAGING MIGRATION';
  out.uniqueCloudinaryIdentities=seenReferences.size;out.referenceCounting='One reference per model/record/normalized identity; same-record URL and embedded metadata coalesced. Duplicate count is additional references across records, including missing sources. Referenced bytes count unique existing assets.';out.writes={r2:0,mongodb:0,cloudinary:0};return out;
}
module.exports={definitions,identity,parseUrl,normalize,extract,reconcile};
