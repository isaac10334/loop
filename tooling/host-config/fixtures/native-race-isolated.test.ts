// Isolated Bun process: mocked native startup must not leak into other tests.
import {test,expect,mock} from 'bun:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';

if(process.env.LOOP_ISOLATED_NATIVE_RACE!=='1'){
 test.skip('native startup reservation races',()=>{});
}else{
 class NativeStartupCleanupError extends AggregateError{}
 let mode:'hold'|'failed'|'active'='hold',enter!:()=>void,release!:()=>void,trigger!:()=>void,gate:Promise<void>,events:string[]=[];
 let holdPublication=false,publicationEntered!:()=>void,publicationGate:Promise<void>;
 const records=await import('../../../crates/loop-cli/host-tools/launch-record'),originalPublisher=records.createLaunchRecordPublisher;
 mock.module(resolve('crates/loop-cli/host-tools/launch-record.ts'),()=>({...records,createLaunchRecordPublisher:(path:string)=>{const publisher=originalPublisher(path);return {...publisher,publish(record:any){const pending=publisher.publish(record);if(holdPublication&&record.state==='active'){publicationEntered();return pending.then(()=>publicationGate);}return pending;}};}}));
 mock.module(resolve('crates/loop-cli/host-tools/native.ts'),()=>({NativeStartupCleanupError,startNativeRuntime:async(options:any)=>{
  if(mode==='failed')throw new NativeStartupCleanupError([Error('PRIMARY'),Error('NATIVE_CLEANUP_SENTINEL')],'Native startup cleanup incomplete');
  if(mode==='active'){trigger=options.onClosed;return {async dispose(){events.push('runtime-disposed');}};}
  options.onClosed();enter();await gate;events.push('native-cleaned');throw Error('native closed during startup');
 }}));
 const {launch}=await import('../../../crates/loop-cli/host-tools/supervise');
 async function fixture(){const root=await mkdtemp(resolve(tmpdir(),'loop-native-race-'));await writeFile(resolve(root,'coord.ts'),'export function connect(){}');await writeFile(resolve(root,'app.ts'),'export function start(){}');return root;}
 function evaluation(root:string){return {root,files:new Map(),plan:{targetId:'desktop',planId:'test-plan',kind:'desktop',kitOptions:{},plugins:[],coordinator:{specifier:'./coord.ts',export:'connect'},application:{specifier:'./app.ts',export:'start'}},hooks:new Map()} as any;}
 test('early native closure cannot release reservation before startup cleanup settles',async()=>{
  const root=await fixture();mode='hold';events=[];const entered=new Promise<void>(resolve=>{enter=resolve;});gate=new Promise<void>(resolve=>{release=resolve;});
  try{
   const started=launch(evaluation(root),{instance:'race',epoch:'first',profile:'shared'}).then(()=>null,error=>error);await entered;await Bun.sleep(250);
   const base=resolve(root,'.loop/instances/desktop/race');expect(await readFile(resolve(base,'active.lock'),'utf8')).toBe('first');expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(events).toEqual([]);
   release();expect(String(await started)).toContain('native closed during startup');expect(events).toEqual(['native-cleaned']);
   expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);expect(JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8')).state).toBe('failed');
  }finally{release();await rm(root,{recursive:true,force:true});}
 },15000);
 test('native closure joins a held readiness hook before quiescence and unlock',async()=>{
  const root=await fixture();mode='active';events=[];let unblock!:()=>void,entered!:()=>void,starting:Promise<unknown>|undefined;
  const gate=new Promise<void>(resolve=>{unblock=resolve;}),didEnter=new Promise<void>(resolve=>{entered=resolve;});
  try{
   const ev=evaluation(root);ev.plan.plugins=[{key:'hook',contributions:[]}];ev.hooks.set('hook',{async ready(){events.push('ready-enter');entered();await gate;events.push('ready-finished');},quiesce(){events.push('quiesced');}});
   starting=launch(ev,{instance:'ready',epoch:'first',profile:'shared'}).then(()=>null,error=>error);await didEnter;trigger();await Bun.sleep(250);
   const base=resolve(root,'.loop/instances/desktop/ready');expect(await readFile(resolve(base,'active.lock'),'utf8')).toBe('first');expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(events).toEqual(['ready-enter']);
   unblock();expect(String(await starting)).toContain('cancelled');expect(events).toEqual(['ready-enter','ready-finished','quiesced','runtime-disposed']);
   expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);expect(JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8')).state).toBe('failed');
  }finally{unblock();if(starting)await starting.catch(()=>{});await rm(root,{recursive:true,force:true});}
 },15000);
 test('synchronous readiness closure joins and records hook failure',async()=>{
  const root=await fixture();mode='active';events=[];let failGate!:(error:Error)=>void,entered!:()=>void,starting:Promise<unknown>|undefined;
  const gate=new Promise<void>((_,reject)=>{failGate=reject;}),didEnter=new Promise<void>(resolve=>{entered=resolve;});
  try{
   const ev=evaluation(root);ev.plan.plugins=[{key:'hook',contributions:[]}];ev.hooks.set('hook',{ready(){events.push('ready-enter');trigger();entered();return gate;},quiesce(){events.push('quiesced');}});
   starting=launch(ev,{instance:'sync-ready',epoch:'first',profile:'shared'}).then(()=>null,error=>error);await didEnter;await Bun.sleep(250);
   const base=resolve(root,'.loop/instances/desktop/sync-ready');expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(events).toEqual(['ready-enter']);
   failGate(Error('READY_FAILURE_SENTINEL'));expect(String(await starting)).toContain('READY_FAILURE_SENTINEL');expect(events).toEqual(['ready-enter','quiesced','runtime-disposed']);
   const record=JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8'));expect(record.state).toBe('failed');expect(record.failure).toContain('READY_FAILURE_SENTINEL');expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);
  }finally{failGate(Error('fixture cleanup'));if(starting)await starting.catch(()=>{});await rm(root,{recursive:true,force:true});}
 },15000);
 test('closure during native promotion cannot release locks or return a stopped launch',async()=>{
  const root=await fixture();mode='active';events=[];let unblock!:()=>void,entered!:()=>void,starting:Promise<unknown>|undefined;holdPublication=true;
  publicationGate=new Promise<void>(resolve=>{unblock=resolve;});const didEnter=new Promise<void>(resolve=>{entered=resolve;});publicationEntered=entered;
  try{
   starting=launch(evaluation(root),{instance:'promote',epoch:'first',profile:'shared'}).then(()=>null,error=>error);await Promise.race([didEnter,starting.then(error=>{throw error??Error('launch returned before publication');})]);trigger();await Bun.sleep(250);
   const base=resolve(root,'.loop/instances/desktop/promote');expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(events).toEqual([]);
   unblock();expect(String(await starting)).toContain('cancelled');expect(events).toEqual(['runtime-disposed']);const record=JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8'));expect(record.state).toBe('failed');expect(record.failure).toContain('cancelled');expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(false);
  }finally{holdPublication=false;unblock();if(starting)await starting.catch(()=>{});await rm(root,{recursive:true,force:true});}
 },15000);
 test('active native closure still stops and disposes exactly once',async()=>{
  const root=await fixture();mode='active';events=[];let running:Awaited<ReturnType<typeof launch>>|undefined;
  try{
   running=await launch(evaluation(root),{instance:'active',epoch:'first',profile:'shared'});expect((running.inspect() as any).state).toBe('active');
   trigger();await running.stop();expect(events).toEqual(['runtime-disposed']);expect((running.inspect() as any).state).toBe('stopped');
   expect(await Bun.file(resolve(root,'.loop/instances/desktop/active/active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);
  }finally{if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
 },15000);
 test('native startup cleanup failure retains its reservation',async()=>{
  const root=await fixture();mode='failed';
  try{
   const failure=await launch(evaluation(root),{instance:'failed',epoch:'first',profile:'shared'}).then(()=>null,error=>error);expect(String(failure)).toContain('Native startup cleanup incomplete');
   const base=resolve(root,'.loop/instances/desktop/failed');expect(await readFile(resolve(base,'active.lock'),'utf8')).toBe('first');expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);
   const record=JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8'));expect(record.state).toBe('failed');expect(record.failure).toContain('NATIVE_CLEANUP_SENTINEL');
  }finally{await rm(root,{recursive:true,force:true});}
 },15000);
}
