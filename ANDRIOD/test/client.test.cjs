const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
// Compile the actual client modules in memory; no emit, Metro, device, or network.
function load(file,mocks={}) {
 const filename=path.resolve(root,file),exports={};
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const localRequire=name=>{
  if(Object.hasOwn(mocks,name))return mocks[name];
  if(name==='react-native-url-polyfill')return require('whatwg-url-without-unicode');
  if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(filename),name))+'.ts',mocks);
  return require(name);
 };
 vm.runInNewContext(source,{exports,require:localRequire,console,URL,setTimeout,clearTimeout,Date,process:{env:{}}},{filename});return exports;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const {AuthRefresh}=load('src/services/authRefresh.ts');
const {WatchProgress}=load('src/services/watchProgress.ts');
const {Completion}=load('src/services/completion.ts');
const {normalizeBaseURL}=load('src/utils/apiUrl.ts');
const {transactionSign}=load('src/utils/transactionDisplay.ts');
function authFixture(){
 let token='old',refresh='refresh-fixture',requests=0,saves=0,clears=0,loggedOut=0,updates=0;
 let request=async()=>({accessToken:'new',expiresAt:'expiry'});
 const controller=new AuthRefresh({getToken:async()=>token,getRefreshToken:async()=>refresh,saveToken:async x=>{token=x;saves++;},saveExpiry:async()=>{},clearAuth:async()=>{token=null;refresh=null;clears++;},request:async()=>{requests++;return request();}});
 controller.onLogout=()=>loggedOut++;controller.onRefresh=()=>updates++;
 return {controller,setRequest:f=>request=f,state:()=>({token,requests,saves,clears,loggedOut,updates})};
}
for(const count of [2,3])test(`${count} simultaneous 401s share one refresh and token replacement`,async()=>{
 const f=authFixture(),gate=deferred();f.setRequest(()=>gate.promise);
 const pending=Array.from({length:count},()=>f.controller.refresh('old',0));gate.resolve({accessToken:'new'});
 assert.deepEqual(await Promise.all(pending),Array(count).fill('new'));assert.equal(f.state().requests,1);assert.equal(f.state().saves,1);assert.equal(f.state().updates,1);
});
test('late 401 reuses newly stored access token',async()=>{const f=authFixture();await f.controller.refresh('old',0);assert.equal(await f.controller.refresh('old',0),'new');assert.equal(f.state().requests,1);});
test('refresh failure clears storage and notifies Redux once for all waiters',async()=>{const f=authFixture();f.setRequest(async()=>{throw Error('network');});const results=await Promise.allSettled([f.controller.refresh('old',0),f.controller.refresh('old',0)]);assert.ok(results.every(x=>x.status==='rejected'));assert.equal(f.state().clears,1);assert.equal(f.state().loggedOut,1);assert.equal(f.state().token,null);});
test('logout during refresh prevents token resurrection and retry',async()=>{const f=authFixture(),gate=deferred(),started=deferred();f.setRequest(()=>{started.resolve();return gate.promise;});const pending=f.controller.refresh('old',0);await started.promise;await f.controller.logout();gate.resolve({accessToken:'new'});await assert.rejects(pending);assert.equal(f.state().token,null);assert.equal(f.state().saves,0);await assert.rejects(f.controller.refresh('old',0));});
test('logout during token write clears that write before returning',async()=>{let token='old';const gate=deferred(),writing=deferred();const c=new AuthRefresh({getToken:async()=>token,getRefreshToken:async()=> 'fixture',saveToken:async t=>{writing.resolve();await gate.promise;token=t;},saveExpiry:async()=>{},clearAuth:async()=>{token=null;},request:async()=>({accessToken:'new'})});const refreshing=c.refresh('old',0);await writing.promise;const logout=c.logout();gate.resolve();await logout;await assert.rejects(refreshing);assert.equal(token,null);});
function watchFixture(){
 let time=10000,calls=0,syncs=0,lastServerAt=time;
 let server={sessionId:'session',videoId:'video',startedAt:'date',expiresAt:'later',sequence:0,playbackPosition:0,accumulatedSeconds:0,requiredWatchSeconds:8};
 let mode='ok';const confirmations=[];let block=null;
 const api={startWatch:async()=>{syncs++;if(mode==='sync-failure')throw Error('offline');return {...server};},watchHeartbeat:async(id,body)=>{
  calls++;if(block)await block.promise;
  if(mode==='network'||mode==='sync-failure')throw Error('timeout');
  if(body.sequence!==server.sequence+1)throw Object.assign(Error('conflict'),{status:409});
  if(time-lastServerAt<2000)throw Object.assign(Error('too soon'),{status:429});
  const delta=body.playbackPosition-server.playbackPosition;
  if(delta<0||delta>Math.min((time-lastServerAt)/1000+1,11))throw Object.assign(Error('progress'),{status:400});
  server={...server,sequence:body.sequence,playbackPosition:body.playbackPosition,accumulatedSeconds:server.accumulatedSeconds+Math.min(delta,(time-lastServerAt)/1000,10)};lastServerAt=time;
  if(mode==='lost'){mode='ok';throw Error('response lost');}
  return {sequence:server.sequence,accumulatedSeconds:server.accumulatedSeconds,requiredWatchSeconds:server.requiredWatchSeconds,canComplete:server.accumulatedSeconds>=server.requiredWatchSeconds};
 }};
 const progress=new WatchProgress('task',server,api,(state,recovered)=>confirmations.push({state,recovered}),()=>time,async ms=>{time+=ms;});
 return {progress,advance:ms=>time+=ms,mode:x=>mode=x,server:()=>server,setServer:s=>server={...server,...s},state:()=>({calls,syncs,confirmations}),block:g=>block=g};
}
test('heartbeat success records only confirmed sequence and progress',async()=>{const f=watchFixture(),gate=deferred();f.advance(5000);f.block(gate);const work=f.progress.update(5);assert.equal(f.progress.session.sequence,0);gate.resolve();await work;assert.equal(f.progress.session.sequence,1);assert.equal(f.progress.session.playbackPosition,5);});
test('lost heartbeat response resynchronizes without double-counting',async()=>{const f=watchFixture();f.advance(5000);f.mode('lost');await f.progress.update(5);assert.equal(f.state().syncs,1);assert.equal(f.progress.session.sequence,1);assert.equal(f.progress.session.accumulatedSeconds,5);f.advance(5000);await f.progress.update(10);assert.equal(f.server().accumulatedSeconds,10);});
test('sequence conflict uses existing session state then retries next progress safely',async()=>{const f=watchFixture();f.setServer({sequence:1,playbackPosition:5,accumulatedSeconds:5});f.advance(5000);await f.progress.update(5);assert.equal(f.progress.session.sequence,1);assert.equal(f.progress.session.sessionId,'session');f.advance(5000);await f.progress.update(10);assert.equal(f.server().sequence,2);assert.equal(f.server().accumulatedSeconds,10);});
test('network timeout restores confirmed position; next playback retries',async()=>{const f=watchFixture();f.advance(5000);f.mode('network');await f.progress.update(5);assert.equal(f.progress.session.playbackPosition,0);f.mode('ok');f.advance(5000);await f.progress.update(5);assert.equal(f.progress.session.accumulatedSeconds,5);});
test('failed resync is bounded and can recover after network returns',async()=>{const f=watchFixture();f.advance(5000);f.mode('sync-failure');await assert.rejects(f.progress.update(5));assert.equal(f.state().calls,1);assert.equal(f.state().syncs,1);f.mode('ok');await f.progress.update(5);assert.equal(f.state().syncs,2);assert.equal(f.progress.session.sequence,0);});
test('duplicate heartbeat event is not sent twice',async()=>{const f=watchFixture(),gate=deferred();f.advance(5000);f.block(gate);const p=f.progress.update(5);await f.progress.update(5);gate.resolve();await p;assert.equal(f.state().calls,1);});
test('recovery refuses a replacement session identity',async()=>{const f=watchFixture();f.advance(5000);f.mode('network');f.setServer({sessionId:'replacement'});await assert.rejects(f.progress.update(5),/expired or changed/);assert.equal(f.progress.session.sessionId,'session');});
for(const scenario of ['short','normal','immediately-after-heartbeat'])test(`final heartbeat: ${scenario}`,async()=>{
 const f=watchFixture();f.advance(5200);await f.progress.update(5.2);f.advance(scenario==='normal'?5000:scenario==='short'?4800:100);const end=scenario==='normal'?10.2:scenario==='short'?10:5.3;await f.progress.update(end,true);assert.equal(f.progress.session.playbackPosition,end);assert.equal(f.state().calls,2);
});
test('duplicate didJustFinish events share final request',async()=>{const f=watchFixture();f.advance(8000);await Promise.all([f.progress.update(8,true),f.progress.update(8,true)]);await f.progress.update(8,true);assert.equal(f.state().calls,1);assert.equal(f.progress.session.accumulatedSeconds,8);});
test('final waits for in-flight heartbeat and respects server minimum interval',async()=>{const f=watchFixture(),gate=deferred();f.advance(5000);f.block(gate);const first=f.progress.update(5),last=f.progress.update(6,true);gate.resolve();await Promise.all([first,last]);assert.equal(f.progress.session.sequence,2);assert.equal(f.progress.session.playbackPosition,6);});
test('disposed player cannot send a delayed final heartbeat',async()=>{const f=watchFixture();f.advance(5000);const final=f.progress.update(5,true);f.progress.dispose();await final;assert.equal(f.state().calls,0);});
const authModule=load('src/store/slices/authSlice.ts',{'@services/authService':{authService:{}},'@utils/storage':{authStorage:{}}});
for(const coins of [10,0])test(`balance 100 + ${coins} = ${100+coins}`,async()=>{let state={user:{coins:100},isAuthenticated:true};const c=new Completion();await c.run(async()=>({coins,message:'ok'}),n=>state=authModule.default(state,authModule.addUserReward(n)));assert.equal(state.user.coins,100+coins);});
test('duplicate completion only requests and credits once',async()=>{const c=new Completion(),gate=deferred();let balance=100,requests=0;const request=()=>{requests++;return gate.promise;};const apply=n=>balance+=n;const a=c.run(request,apply),b=c.run(request,apply);gate.resolve({coins:10,message:'ok'});await Promise.all([a,b]);await c.run(request,apply);assert.equal(balance,110);assert.equal(requests,1);});
test('failed completion never credits and permits a later server-approved attempt',async()=>{const c=new Completion();let balance=100;await assert.rejects(c.run(async()=>{throw Error('denied');},n=>balance+=n));assert.equal(balance,100);await c.run(async()=>({coins:10,message:'ok'}),n=>balance+=n);assert.equal(balance,110);});
test('Redux logout clears authenticated state and credentials',()=>{const state=authModule.default({isAuthenticated:true,user:{coins:100},token:'fixture',refreshToken:'fixture',expiresAt:'date'},authModule.clearAuth());assert.equal(state.isAuthenticated,false);assert.equal(state.user,null);assert.equal(state.token,null);assert.equal(state.refreshToken,null);});
for(const [type,direction,sign] of [['earned','credit','+'],['bonus','debit','-'],['withdrawn',undefined,'-'],['refund',undefined,'+'],['reconciliation','credit','+'],['reconciliation','debit','-'],['reconciliation',undefined,'']])test(`transaction ${type}/${direction||'unspecified'}`,()=>assert.equal(transactionSign({type,direction}),sign));
for(const [input,expected] of [['http://host','http://host/api'],['http://host:1998','http://host:1998/api'],['http://host/api','http://host/api'],['http://host:1998/api','http://host:1998/api'],['https://example.com','https://example.com/api'],['https://example.com/api','https://example.com/api'],['host/api','http://host:3000/api'],['host:1998/api/','http://host:1998/api'],[' host/ ','http://host:3000/api']])test(`URL normalization ${input}`,()=>assert.equal(normalizeBaseURL(input),expected));
test('API URL rejects embedded credentials and query data',()=>{assert.throws(()=>normalizeBaseURL('https://user:password@example.invalid'));assert.throws(()=>normalizeBaseURL('https://example.invalid?secret=fixture'));});
// Real Axios interceptors, fake adapter: no HTTP requests or credential logging.
test('API retries protected requests once, shares refresh, and prevents recursive refresh',async()=>{
 const axios=require('axios');let token='old',refreshCalls=0,protectedCalls=0,clears=0,denyRefresh=false,denyRetry=false;
 const instance=axios.create();instance.defaults.adapter=async config=>{
  const ok=data=>({data,status:200,statusText:'OK',headers:{},config});
  const denied=()=>Promise.reject(new axios.AxiosError('unauthorized','ERR_BAD_REQUEST',config,{}, {data:{error:'Unauthorized'},status:401,statusText:'Unauthorized',headers:{},config}));
  if(config.url==='/auth/refresh'){refreshCalls++;if(denyRefresh)return denied();return ok({success:true,data:{accessToken:'new'}});}
  protectedCalls++;if(config.headers.Authorization==='Bearer old'||denyRetry)return denied();return ok({success:true,data:{ok:true}});
 };
 const storage={getToken:async()=>token,getRefreshToken:async()=> 'fixture',saveToken:async t=>{token=t;},saveExpiry:async()=>{},clearAuth:async()=>{clears++;token=null;}};
 const {apiService}=load('src/services/api.ts',{'axios':{...axios,create:()=>instance},'@constants':{API_BASE_URL:'https://example.invalid/api'},'@utils/storage':{authStorage:storage},'./authRefresh':{AuthRefresh}});
 const results=await Promise.all([apiService.get('/tasks'),apiService.get('/tasks'),apiService.get('/tasks')]);assert.ok(results.every(r=>r.data.ok));assert.equal(refreshCalls,1);assert.equal(protectedCalls,6);
 token='old';denyRefresh=true;await assert.rejects(apiService.get('/tasks'));assert.equal(refreshCalls,2);assert.equal(clears,1);
 token='old';denyRefresh=false;denyRetry=true;const before=protectedCalls;await assert.rejects(apiService.get('/tasks'));assert.equal(protectedCalls-before,2);assert.equal(clears,2);
});
