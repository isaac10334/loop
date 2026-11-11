// Isolated because this test changes cwd and the backend environment variable.
import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {launch} from '../../../crates/loop-cli/host-tools/supervise';

if(process.env.LOOP_ISOLATED_REAL_NATIVE_RACE!=='1'){
 test.skip('real native startup reservation fencing',()=>{});
}else{
 const encoder=`const send=async value=>{const body=Buffer.from(JSON.stringify(value)),frame=Buffer.alloc(4+body.length);frame.writeUInt32LE(body.length);body.copy(frame,4);await new Promise((resolve,reject)=>process.stdout.write(frame,error=>error?reject(error):resolve()));};`;
 const plan={targetId:'desktop',planId:'test-plan',kind:'desktop',profile:{id:'loop:profile/native-ts',version:'0.1.0'},kitOptions:{},plugins:[],coordinator:{specifier:'./coord.ts',export:'connect'},application:{specifier:'./app.ts',export:'start'}} as any;
 const evaluation=(root:string)=>({root,files:new Map(),plan,hooks:new Map()}) as any;
 function alive(pid:number){try{process.kill(pid,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error;}}
 test('real native startup joins held app before releasing reservations after backend closes',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-real-race-')),previous=process.cwd(),backend=process.env.LOOP_CLI_EXECUTABLE,events:string[]=[];let release!:()=>void,entered!:()=>void,aborted!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),didEnter=new Promise<void>(resolve=>{entered=resolve;}),didAbort=new Promise<void>(resolve=>{aborted=resolve;});
  (globalThis as any).__nativeRace={gate,entered,aborted,events};
  try{
   await writeFile(resolve(root,'coord.ts'),`export {connectNativeSurface as connect} from ${JSON.stringify(pathToFileURL(resolve('packages/host-native/dist/index.js')).href)};`);
   await writeFile(resolve(root,'app.ts'),`export async function start({scope,signal}){scope.defer(()=>globalThis.__nativeRace.events.push('scope-disposed'));signal.addEventListener('abort',()=>globalThis.__nativeRace.aborted(),{once:true});await Bun.write('app-started','1');globalThis.__nativeRace.entered();await globalThis.__nativeRace.gate;globalThis.__nativeRace.events.push('app-finished');}`);
   await writeFile(resolve(root,'native-surface'),`${encoder} const epoch=process.argv[process.argv.indexOf('--epoch')+1];setTimeout(()=>process.exit(2),6000).unref();await send({type:'ready',epoch,instanceId:'fake'});while(!await Bun.file('app-started').exists())await Bun.sleep(10);await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);`);
   process.chdir(root);process.env.LOOP_CLI_EXECUTABLE=process.execPath;
   const starting=launch(evaluation(root),{instance:'race',epoch:'first',profile:'shared'}).then(()=>null,error=>error);await didEnter;await didAbort;
   const base=resolve(root,'.loop/instances/desktop/race');expect(await readFile(resolve(base,'active.lock'),'utf8')).toBe('first');expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(events).toEqual([]);
   release();const failure=await starting;expect(String(failure)).toContain('Native startup cancelled');expect(events).toEqual(['app-finished','scope-disposed']);
   expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);
  }finally{release();process.chdir(previous);if(backend===undefined)delete process.env.LOOP_CLI_EXECUTABLE;else process.env.LOOP_CLI_EXECUTABLE=backend;delete (globalThis as any).__nativeRace;await rm(root,{recursive:true,force:true});}
 },15000);
 test('real native closure joins held readiness before host scope disposal',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-real-ready-')),previous=process.cwd(),backend=process.env.LOOP_CLI_EXECUTABLE,events:string[]=[];let release!:()=>void,entered!:()=>void,aborted!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),didEnter=new Promise<void>(resolve=>{entered=resolve;}),didAbort=new Promise<void>(resolve=>{aborted=resolve;});
  (globalThis as any).__nativeRace={events};
  try{
   await writeFile(resolve(root,'coord.ts'),`export {connectNativeSurface as connect} from ${JSON.stringify(pathToFileURL(resolve('packages/host-native/dist/index.js')).href)};`);
   await writeFile(resolve(root,'app.ts'),`export function start({scope}){scope.defer(()=>globalThis.__nativeRace.events.push('app-scope-disposed'));}`);
   await writeFile(resolve(root,'native-surface'),`${encoder} const epoch=process.argv[process.argv.indexOf('--epoch')+1];setTimeout(()=>process.exit(2),6000).unref();await send({type:'ready',epoch,instanceId:'fake'});while(!await Bun.file('hook-started').exists())await Bun.sleep(10);await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);`);
   process.chdir(root);process.env.LOOP_CLI_EXECUTABLE=process.execPath;const ev=evaluation(root);ev.plan={...plan,plugins:[{key:'hook',contributions:[]}]};
   ev.hooks.set('hook',{async ready({signal}:any){events.push('ready-enter');signal.addEventListener('abort',aborted,{once:true});await Bun.write('hook-started','1');entered();await gate;events.push('ready-finished');},quiesce(){events.push('quiesced');}});
   const starting=launch(ev,{instance:'ready',epoch:'first',profile:'shared'}).then(()=>null,error=>error);await didEnter;await didAbort;await Bun.sleep(30);
   const base=resolve(root,'.loop/instances/desktop/ready');expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(events).toEqual(['ready-enter']);
   release();expect(String(await starting)).toContain('cancelled');expect(events).toEqual(['ready-enter','ready-finished','quiesced','app-scope-disposed']);expect(await Bun.file(resolve(base,'active.lock')).exists()).toBe(false);
  }finally{release();process.chdir(previous);if(backend===undefined)delete process.env.LOOP_CLI_EXECUTABLE;else process.env.LOOP_CLI_EXECUTABLE=backend;delete (globalThis as any).__nativeRace;await rm(root,{recursive:true,force:true});}
 },15000);
 test('real native adapter cleanup failure preserves both reservations',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-real-fail-')),previous=process.cwd(),backend=process.env.LOOP_CLI_EXECUTABLE;let pid=0;
  try{
   await writeFile(resolve(root,'coord.ts'),`import {existsSync} from 'node:fs';export function connect(){const end=Date.now()+2000;while(!existsSync('backend.pid')&&Date.now()<end)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);if(!existsSync('backend.pid'))throw Error('backend not ready');return {surface:{},ready:Promise.reject(Error('READY_SENTINEL')),closed:new Promise(()=>{}),dispose(){throw Error('DISPOSE_SENTINEL')}};}`);
   await writeFile(resolve(root,'app.ts'),'export function start(){}');await writeFile(resolve(root,'native-surface'),"await Bun.write('backend.pid',String(process.pid));await Bun.sleep(3000);\n");process.chdir(root);process.env.LOOP_CLI_EXECUTABLE=process.execPath;
   const failure=await launch(evaluation(root),{instance:'failure',epoch:'first',profile:'shared'}).then(()=>null,error=>error);
   pid=Number(await readFile(resolve(root,'backend.pid'),'utf8'));expect(alive(pid)).toBe(true);expect(String(failure)).toContain('Native startup and cleanup failed');
   const base=resolve(root,'.loop/instances/desktop/failure');expect(await readFile(resolve(base,'active.lock'),'utf8')).toBe('first');expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);
   const record=JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8'));expect(record.state).toBe('failed');expect(record.failure).toContain('DISPOSE_SENTINEL');
   const deadline=Date.now()+5000;while(alive(pid)&&Date.now()<deadline)await Bun.sleep(25);expect(alive(pid)).toBe(false);
  }finally{process.chdir(previous);if(backend===undefined)delete process.env.LOOP_CLI_EXECUTABLE;else process.env.LOOP_CLI_EXECUTABLE=backend;if(pid&&alive(pid))await Bun.sleep(3200);await rm(root,{recursive:true,force:true});}
 },15000);
}
