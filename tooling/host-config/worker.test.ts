import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,cp,writeFile,readFile,stat,open,unlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {frames,frame,strictJson} from '../../crates/loop-cli/host-tools/protocol';
import {lockFixture} from './lock-fixture';
import {startNativeRuntime} from '../../crates/loop-cli/host-tools/native';
import {launch} from '../../crates/loop-cli/host-tools/supervise';
import {evaluate,assertCurrent} from '../../crates/loop-cli/host-tools/evaluate';
async function fixture(){const root=await mkdtemp(resolve(tmpdir(),'loop-hk-'));for(const name of ['host','capabilities','workspace']){const out=resolve(root,'node_modules/@loop-kit',name);await mkdir(out,{recursive:true});await cp(resolve('packages',name,'dist'),resolve(out,'dist'),{recursive:true});const pkg=await Bun.file(resolve('packages',name,'package.json')).json();await writeFile(resolve(out,'package.json'),JSON.stringify(pkg));}await writeFile(resolve(root,'package.json'),'{"type":"module","dependencies":{"@loop-kit/host":"0.1.0"}}');await lockFixture(root,['@loop-kit/host','@loop-kit/capabilities','@loop-kit/workspace']);await writeFile(resolve(root,'runtime.ts'),'export function bootstrap() {}');await writeFile(resolve(root,'app.ts'),'export function start() {}');await writeFile(resolve(root,'loop.package.json'),JSON.stringify({version:1,id:'test:project',sourcePaths:['app.ts','runtime.ts','loop.config.ts']}));await writeFile(resolve(root,'loop.config.ts'),`import {defineConfig} from '@loop-kit/host';console.log('config log stays off protocol');let count=0;export default defineConfig({schemaVersion:1,source:{manifest:'./loop.package.json'},targets:[{id:'web',kit:{apiVersion:1,identity:{id:'loop:kit/browser',version:'0.1.0'},kind:'browser',profile:{id:'loop:profile/browser-ts',version:'0.1.0'},options:{},hosts:[{key:'application',realm:'application',profile:{id:'loop:profile/browser-ts',version:'0.1.0'}}],coordinator:{specifier:'./runtime.ts',export:'bootstrap'},plugins:[]},application:{specifier:'./app.ts',export:'start'},plugins:[{apiVersion:1,identity:{id:'test:plugin/hooks',version:'1.0.0'},key:'hooks',targets:['browser'],runtime:[],prepare(){count++;}}]}]});`);return root;}
test('dev disposal rejection is guarded while a browser client remains connected',async()=>{
 const child=Bun.spawn([process.execPath,'test',resolve('tooling/host-config/fixtures/dev-disposal-isolated.test.ts')],{env:{...process.env,LOOP_ISOLATED_DEV_TEST:'1'},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 expect(code,stdout+'\n'+stderr).toBe(0);expect(stderr).toContain('1 pass');
},20000);
test('native coordinator lifecycle and cleanup run in an isolated process',async()=>{
 const child=Bun.spawn([process.execPath,'test',resolve('tooling/host-config/fixtures/native-startup-isolated.test.ts')],{env:{...process.env,LOOP_ISOLATED_NATIVE_TEST:'1'},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 expect(code,stdout+'\n'+stderr).toBe(0);expect(stderr).toContain('8 pass');
},20000);
test('native startup closure and cleanup failure retain reservations until safe',async()=>{
 const child=Bun.spawn([process.execPath,'test',resolve('tooling/host-config/fixtures/native-race-isolated.test.ts')],{env:{...process.env,LOOP_ISOLATED_NATIVE_RACE:'1'},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 expect(code,stdout+'\n'+stderr).toBe(0);expect(stderr).toContain('6 pass');
},20000);
test('real native adapter and supervisor fence startup cleanup',async()=>{
 const child=Bun.spawn([process.execPath,'test',resolve('tooling/host-config/fixtures/native-real-race-isolated.test.ts')],{env:{...process.env,LOOP_ISOLATED_REAL_NATIVE_RACE:'1'},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 expect(code,stdout+'\n'+stderr).toBe(0);expect(stderr).toContain('3 pass');
},20000);
test('trusted headless target evaluates, starts, stops and restarts without an endpoint',async()=>{const root=await fixture();let running:Awaited<ReturnType<typeof launch>>|undefined;try{await writeFile(resolve(root,'loop.config.ts'),`import {defineConfig,headless} from '@loop-kit/host';export default defineConfig({schemaVersion:1,source:{manifest:'./loop.package.json'},targets:[{id:'bot',kit:headless(),application:{specifier:'./app.ts',export:'start'}}]});`);await writeFile(resolve(root,'app.ts'),`export function start({scope}){scope.own({[Symbol.dispose](){}})}`);await expect(evaluate({root,target:'bot'})).rejects.toMatchObject({code:'E_CONFIG_TRUST'});const ev=await evaluate({root,target:'bot',trustLocalConfig:true});expect(ev.plan.kind).toBe('headless');running=await launch(ev,{instance:'bot',epoch:'first'});expect(running.endpoint).toBeUndefined();expect((running.inspect() as any).state).toBe('active');await running.stop();running=await launch(ev,{instance:'bot',epoch:'second',dev:true});expect((running.inspect() as any).state).toBe('active');await running.stop();running=undefined;}finally{await running?.stop();await rm(root,{recursive:true,force:true});}});
test('trusted local TypeScript resolves emitted .js specifiers and captures actual source bytes',async()=>{
 const root=await fixture();
 try {
  await writeFile(resolve(root,'value.ts'),'export const value=42;');
  await writeFile(resolve(root,'app.ts'),"import {value} from './value.js';export function start(){return value}");
  await writeFile(resolve(root,'loop.package.json'),JSON.stringify({version:1,id:'test:project',sourcePaths:['app.ts','value.ts','runtime.ts','loop.config.ts']}));
  const ev=await evaluate({root,trustLocalConfig:true});
  expect(ev.files.has(resolve(root,'value.ts'))).toBe(true);
  await writeFile(resolve(root,'value.ts'),'export const value=43;');
  await expect(assertCurrent(ev)).rejects.toMatchObject({code:'E_STALE_INPUT'});
 } finally {await rm(root,{recursive:true,force:true});}
});
test('shared HK1 framing corpus agrees with Rust',async()=>{const corpus=await Bun.file('contracts/host-kit-protocol-golden.json').json();for(const c of corpus.cases){const bytes=new TextEncoder().encode(c.payload);const data=new Uint8Array(bytes.length+4);new DataView(data.buffer).setUint32(0,bytes.length,true);data.set(bytes,4);let accepted=true;try{for await(const _ of frames(new ReadableStream({start(ctrl){ctrl.enqueue(data);ctrl.close();}}))) {}}catch{accepted=false;}expect(accepted,c.id).toBe(c.accept);}for(const c of corpus.lengthCases){const data=new Uint8Array(4);new DataView(data.buffer).setUint32(0,c.length,true);let accepted=true;try{for await(const _ of frames(new ReadableStream({start(ctrl){ctrl.enqueue(data);ctrl.close();}}))) {}}catch{accepted=false;}expect(accepted,c.id).toBe(c.accept);}});
test('strict protocol rejects duplicate escaped keys, corruption and truncated child frames',async()=>{expect(()=>strictJson('{"a":1,"\\u0061":2}')).toThrow();for(const bytes of [new Uint8Array([255,255,255,255]),new Uint8Array([2,0,0,0,123])]){const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes);c.close();}});expect(async()=>{for await(const _ of frames(stream)){}}).toThrow();}});
test('exported third-party subpaths validate owning version and record nested metadata',async()=>{const root=await fixture();try{const pkg=resolve(root,'node_modules/third-party');await mkdir(resolve(pkg,'shim'),{recursive:true});await writeFile(resolve(pkg,'package.json'),JSON.stringify({name:'third-party',version:'1.0.0',exports:{'./shim':'./shim/index.js'}}));await writeFile(resolve(pkg,'shim/package.json'),'{"type":"module"}');await writeFile(resolve(pkg,'shim/index.js'),'export const value=1;');await writeFile(resolve(root,'app.ts'),"import {value} from 'third-party/shim';export function start(){return value}");const project=await Bun.file(resolve(root,'package.json')).json();project.dependencies['third-party']='1.0.0';await writeFile(resolve(root,'package.json'),JSON.stringify(project));await lockFixture(root,['@loop-kit/host','@loop-kit/capabilities','@loop-kit/workspace','third-party']);const ev=await evaluate({root,trustLocalConfig:true});expect(ev.plan.targetId).toBe('web');expect(ev.files.has(resolve(pkg,'shim/package.json'))).toBe(true);await writeFile(resolve(pkg,'shim/package.json'),'{"type":"commonjs"}');await expect(assertCurrent(ev)).rejects.toMatchObject({code:'E_STALE_INPUT'});}finally{await rm(root,{recursive:true,force:true});}});
test('native adapter leaves exact profile acquisition exclusively to backend',async()=>{const root=await mkdtemp(resolve(tmpdir(),'loop-native-profile-'));const profileDir=resolve(root,'profiles','unique');try{await expect(startNativeRuntime({plan:{kind:'desktop',profile:{id:'loop:profile/native-ts',version:'0.1.0'},kitOptions:{},coordinator:{specifier:'unit',export:'connect'}} as any,modules:{unit:{connect(){throw Error('must not connect before spawn');}}},root,profileDir,instanceId:'unit',epoch:'unit',signal:new AbortController().signal,backend:resolve(root,'missing-backend.exe')})).rejects.toThrow();await expect((await import('node:fs/promises')).stat(profileDir)).rejects.toMatchObject({code:'ENOENT'});await expect((await import('node:fs/promises')).stat(resolve(root,'profiles')).then(s=>s.isDirectory())).resolves.toBe(true);}finally{await rm(root,{recursive:true,force:true});}});
test('computed dynamic-import scan ignores comments/literals but keeps real imports closed',async()=>{const root=await fixture();try{await writeFile(resolve(root,'app.ts'),'// import(name)\nconst text="import(name)";const pattern=/import(name)/;const template=`import(name)`;const methods={import(name){return name}};export function start(){return text+pattern.source+template+methods.import("ok")}');expect((await evaluate({root,trustLocalConfig:true})).plan.targetId).toBe('web');await writeFile(resolve(root,'app.ts'),`const moduleName='node:fs';export async function start(){return import(moduleName)}`);await expect(evaluate({root,trustLocalConfig:true})).rejects.toMatchObject({code:'E_IMPORT_CLOSURE',message:expect.stringContaining('app.ts')});await writeFile(resolve(root,'app.ts'),`export async function start(){return import('node:fs')}`);expect((await evaluate({root,trustLocalConfig:true})).plan.targetId).toBe('web');await writeFile(resolve(root,'app.ts'),`const moduleName='node:fs';const template=\`\${import(moduleName)}\`;export function start(){return template}`);await expect(evaluate({root,trustLocalConfig:true})).rejects.toMatchObject({code:'E_IMPORT_CLOSURE',message:expect.stringContaining('app.ts')});}finally{await rm(root,{recursive:true,force:true});}});
test('Bun direct-dependency override references are compared to their resolved lock value',async()=>{const root=await fixture();try{const project=await Bun.file(resolve(root,'package.json')).json();project.overrides={'@loop-kit/host':'$@loop-kit/host'};await writeFile(resolve(root,'package.json'),JSON.stringify(project));await lockFixture(root,['@loop-kit/host','@loop-kit/capabilities','@loop-kit/workspace']);const lock=await Bun.file(resolve(root,'bun.lock')).json();lock.overrides={'@loop-kit/host':'0.1.0'};await writeFile(resolve(root,'bun.lock'),JSON.stringify(lock));expect((await evaluate({root,trustLocalConfig:true})).plan.targetId).toBe('web');lock.overrides['@loop-kit/host']='0.2.0';await writeFile(resolve(root,'bun.lock'),JSON.stringify(lock));await expect(evaluate({root,trustLocalConfig:true})).rejects.toMatchObject({code:'E_PREPARE_REQUIRED'});}finally{await rm(root,{recursive:true,force:true});}});
test('frozen graph rejects stale declared and installed package versions before import',async()=>{const root=await fixture();try{const pkg=await Bun.file(resolve(root,'package.json')).json();await writeFile(resolve(root,'package.json'),JSON.stringify({...pkg,dependencies:{'@loop-kit/host':'0.9.0'}}));await expect(evaluate({root,trustLocalConfig:true})).rejects.toMatchObject({code:'E_PREPARE_REQUIRED'});await writeFile(resolve(root,'package.json'),JSON.stringify(pkg));const host=resolve(root,'node_modules/@loop-kit/host/package.json');const installed=await Bun.file(host).json();await writeFile(host,JSON.stringify({...installed,version:'0.2.0'}));await expect(evaluate({root,trustLocalConfig:true})).rejects.toMatchObject({code:'E_PREPARE_REQUIRED'});}finally{await rm(root,{recursive:true,force:true});}});
test('launch rejects unsafe and reused epochs without replacing history',async()=>{
 const root=await fixture();let running:Awaited<ReturnType<typeof launch>>|undefined,raceRunning:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const ev=await evaluate({root,trustLocalConfig:true});
  for(const epoch of ['..','../escape','/absolute','C:\\escape','a/b','a\\b','CON','nul','com1','a.','a_1','a'.repeat(129)])
   await expect(launch(ev,{instance:'epoch-test',epoch})).rejects.toMatchObject({code:'E_EPOCH'});
  await expect(stat(resolve(root,'.loop/instances'))).rejects.toMatchObject({code:'ENOENT'});
  const attempts=await Promise.allSettled([launch(ev,{instance:'race-test',epoch:'same-epoch'}),launch(ev,{instance:'race-test',epoch:'same-epoch'})]);
  const winners=attempts.filter((item):item is PromiseFulfilledResult<Awaited<ReturnType<typeof launch>>>=>item.status==='fulfilled');
  const losers=attempts.filter((item):item is PromiseRejectedResult=>item.status==='rejected');
  raceRunning=winners[0]?.value;
  expect(winners).toHaveLength(1);expect(losers).toHaveLength(1);expect(losers[0]!.reason).toMatchObject({code:'E_EPOCH_REUSED'});
  await raceRunning!.stop();
  running=await launch(ev,{instance:'epoch-test',epoch:'epoch-one'});
  const record=resolve(root,'.loop/instances/web/epoch-test/epoch-one/launch.json'),before=await readFile(record,'utf8');
  await expect(launch(ev,{instance:'epoch-test',epoch:'epoch-one'})).rejects.toMatchObject({code:'E_EPOCH_REUSED'});
  expect(await readFile(record,'utf8')).toBe(before);
  await running.stop();const stopped=await readFile(record,'utf8');expect(JSON.parse(stopped).state).toBe('stopped');
  await expect(launch(ev,{instance:'epoch-test',epoch:'epoch-one'})).rejects.toMatchObject({code:'E_EPOCH_REUSED'});
  expect(await readFile(record,'utf8')).toBe(stopped);
 }finally{if(running)await running.stop().catch(()=>{});if(raceRunning)await raceRunning.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test('profile contention preserves the owner reservation and cleans only the contender',async()=>{
 const root=await fixture();let owner:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const ev=await evaluate({root,trustLocalConfig:true});owner=await launch(ev,{instance:'profile-owner',epoch:'first',profile:'shared'});
  const profile=resolve(root,'.loop/profiles/shared.lock'),before=await readFile(profile,'utf8');
  await expect(launch(ev,{instance:'profile-contender',epoch:'second',profile:'shared'})).rejects.toMatchObject({code:'E_PROFILE_BUSY'});
  expect(await readFile(profile,'utf8')).toBe(before);
  await expect(stat(resolve(root,'.loop/instances/web/profile-contender/active.lock'))).rejects.toMatchObject({code:'ENOENT'});
  expect(JSON.parse(await readFile(resolve(root,'.loop/instances/web/profile-contender/second/launch.json'),'utf8')).state).toBe('failed');
  expect((await stat(resolve(root,'.loop/instances/web/profile-owner/active.lock'))).isFile()).toBe(true);
 }finally{if(owner)await owner.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test('stop request cancels a held prepare without early unlock',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 global.__loopPrepareStop={entered,gate,aborted:false,finished:false,quiesced:false};let pending:Promise<{running?:Awaited<ReturnType<typeof launch>>;error?:unknown}>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`async prepare({signal}){const t=globalThis.__loopPrepareStop;signal.addEventListener('abort',()=>{t.aborted=true;},{once:true});t.entered();await t.gate;t.finished=true;},quiesce(){const t=globalThis.__loopPrepareStop;if(!t.finished)throw Error('early quiesce');t.quiesced=true;}`));
  const ev=await evaluate({root,trustLocalConfig:true});pending=launch(ev,{instance:'preparing',epoch:'first',profile:'shared'}).then(running=>({running}),error=>({error}));await started;
  const dir=resolve(root,'.loop/instances/web/preparing/first'),lock=resolve(root,'.loop/instances/web/preparing/active.lock'),profile=resolve(root,'.loop/profiles/shared.lock');
  expect(JSON.parse(await readFile(resolve(dir,'launch.json'),'utf8')).state).toBe('starting');await writeFile(resolve(dir,'stop.request'),'stop\n');
  const deadline=Date.now()+3000;while(!global.__loopPrepareStop.aborted&&Date.now()<deadline)await Bun.sleep(10);
  expect(global.__loopPrepareStop.aborted).toBe(true);expect(global.__loopPrepareStop.finished).toBe(false);expect(await Bun.file(lock).exists()).toBe(true);expect(await Bun.file(profile).exists()).toBe(true);
  release();const outcome=await pending;expect(outcome.error).toMatchObject({code:'E_CANCELLED'});expect(global.__loopPrepareStop.quiesced).toBe(true);
  expect(JSON.parse(await readFile(resolve(dir,'launch.json'),'utf8')).state).toBe('stopped');expect(await Bun.file(lock).exists()).toBe(false);expect(await Bun.file(profile).exists()).toBe(false);
 }finally{release();const result=await pending?.catch(()=>undefined);if(result?.running)await result.running.stop().catch(()=>{});delete global.__loopPrepareStop;await rm(root,{recursive:true,force:true});}
},30000);
test('stop request does not hide a prepare failure',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});global.__loopPrepareFailure={entered,gate,aborted:false};
 let pending:Promise<{running?:Awaited<ReturnType<typeof launch>>;error?:unknown}>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`async prepare({signal}){const t=globalThis.__loopPrepareFailure;signal.addEventListener('abort',()=>{t.aborted=true;},{once:true});t.entered();await t.gate;throw Error('prepare failure after stop');}`));
  const ev=await evaluate({root,trustLocalConfig:true});pending=launch(ev,{instance:'prepare-failure',epoch:'first'}).then(running=>({running}),error=>({error}));await started;
  const dir=resolve(root,'.loop/instances/web/prepare-failure/first');await writeFile(resolve(dir,'stop.request'),'stop\n');const deadline=Date.now()+3000;while(!global.__loopPrepareFailure.aborted&&Date.now()<deadline)await Bun.sleep(10);expect(global.__loopPrepareFailure.aborted).toBe(true);
  release();const outcome=await pending;expect(String(outcome.error)).toContain('prepare failure after stop');const record=JSON.parse(await readFile(resolve(dir,'launch.json'),'utf8'));expect(record.state).toBe('failed');expect(record.failure).toContain('prepare failure after stop');
 }finally{release();const result=await pending?.catch(()=>undefined);if(result?.running)await result.running.stop().catch(()=>{});delete global.__loopPrepareFailure;await rm(root,{recursive:true,force:true});}
},30000);
test('quiesce-only plugin receives an owned context on stop',async()=>{
 const root=await fixture(),global=globalThis as any,lock=resolve(root,'.loop/instances/web/quiesce-only/active.lock');global.__loopQuiesceOnly={events:[],lock};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`quiesce(context){const test=globalThis.__loopQuiesceOnly;test.events.push(context.signal.aborted?'quiesce-aborted':'quiesce-live');context.resources.defer(async()=>{test.events.push(await Bun.file(test.lock).exists()?'dispose-locked':'dispose-unlocked');});}`));
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'quiesce-only',epoch:'first'});
  await running.stop();expect(global.__loopQuiesceOnly.events).toEqual(['quiesce-aborted','dispose-locked']);expect((running.inspect() as any).state).toBe('stopped');await expect(stat(lock)).rejects.toMatchObject({code:'ENOENT'});
 }finally{if(running)await running.stop().catch(()=>{});delete global.__loopQuiesceOnly;await rm(root,{recursive:true,force:true});}
},30000);
test('ready admission is single-flight and stop joins a pending hook before quiesce',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 global.__loopReadyTest={entered,gate,quiesced:false,hookReturned:false};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`prepare(){count++;}, async ready(){globalThis.__loopReadyTest.entered();await globalThis.__loopReadyTest.gate;globalThis.__loopReadyTest.hookReturned=true;}, quiesce(){if(!globalThis.__loopReadyTest.hookReturned)throw Error('quiesced before ready joined');globalThis.__loopReadyTest.quiesced=true;}`));
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'ready-test',epoch:'ready-test'});
  const endpoint=running.endpoint!,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  const first=fetch(endpoint+'/__loop/ready',{method:'POST',body:client});await started;
  expect((await fetch(endpoint+'/__loop/ready',{method:'POST',body:client})).status).toBe(409);
  let stopped=false;const stopping=running.stop().then(()=>{stopped=true;});
  const record=resolve(root,'.loop/instances/web/ready-test/ready-test/launch.json'),lock=resolve(root,'.loop/instances/web/ready-test/active.lock');
  const deadline=Date.now()+5000;while(Date.now()<deadline&&JSON.parse(await readFile(record,'utf8')).state!=='stopping')await Bun.sleep(10);
  expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopping');expect((await stat(lock)).isFile()).toBe(true);
  expect(stopped).toBe(false);expect(global.__loopReadyTest.quiesced).toBe(false);
  await expect(launch(ev,{instance:'ready-test',epoch:'competing-epoch'})).rejects.toMatchObject({code:'E_INSTANCE_BUSY'});
  expect(JSON.parse(await readFile(resolve(root,'.loop/instances/web/ready-test/competing-epoch/launch.json'),'utf8')).state).toBe('failed');
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);
  release();const readyResponse=await first;expect(readyResponse.status).toBe(200);expect(await readyResponse.json()).toEqual({state:'stopping'});await stopping;
  expect(global.__loopReadyTest.quiesced).toBe(true);expect((running.inspect() as any).state).toBe('stopped');
 }finally{release();if(running)await running.stop().catch(()=>{});delete global.__loopReadyTest;await rm(root,{recursive:true,force:true});}
},30000);
test('a registered client receives stopping when readiness arrives after abort',async()=>{
 const root=await fixture();if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'late-ready-stop',epoch:'first'});const endpoint=running.endpoint!,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  const stopping=running.stop(),record=resolve(root,'.loop/instances/web/late-ready-stop/first/launch.json'),deadline=Date.now()+5000;while((await Bun.file(record).json()).state!=='stopping'&&Date.now()<deadline)await Bun.sleep(10);
  const ready=await fetch(endpoint+'/__loop/ready',{method:'POST',body:client});expect(ready.status).toBe(200);expect(await ready.json()).toEqual({state:'stopping'});expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);await stopping;
 }finally{if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test('stop does not hide a ready hook failure',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});global.__loopReadyFailure={entered,gate};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();await writeFile(config,source.replace('prepare(){count++;}',`async ready(){const t=globalThis.__loopReadyFailure;t.entered();await t.gate;throw Error('ready failure after stop');}`));
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'ready-failure-stop',epoch:'first'});const endpoint=running.endpoint!,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  const ready=fetch(endpoint+'/__loop/ready',{method:'POST',body:client});await started;const stopping=running.stop();const record=resolve(root,'.loop/instances/web/ready-failure-stop/first/launch.json');const deadline=Date.now()+5000;while((await Bun.file(record).json()).state!=='stopping'&&Date.now()<deadline)await Bun.sleep(10);
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);release();expect((await ready).status).toBe(500);await stopping;const final=await Bun.file(record).json();expect(final.state).toBe('failed');expect(final.failure).toContain('ready failure after stop');
 }finally{release();if(running)await running.stop().catch(()=>{});delete global.__loopReadyFailure;await rm(root,{recursive:true,force:true});}
},30000);
test('failed stopping publication retains reservation and reports failure',async()=>{
 const root=await fixture();let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'failure-test',epoch:'first'});
  const record=resolve(root,'.loop/instances/web/failure-test/first/launch.json'),lock=resolve(root,'.loop/instances/web/failure-test/active.lock');
  if(!root.startsWith(resolve(tmpdir(),'loop-hk-'))||record!==resolve(root,'.loop/instances/web/failure-test/first/launch.json'))throw Error('Unexpected fixture deletion target');
  await unlink(record);await mkdir(record);
  await expect(running.stop()).rejects.toThrow('Launch cleanup failed');
  expect((await stat(lock)).isFile()).toBe(true);expect((running.inspect() as any).state).toBe('failed');
  await expect(launch(ev,{instance:'failure-test',epoch:'second'})).rejects.toMatchObject({code:'E_INSTANCE_BUSY'});
  expect((await stat(lock)).isFile()).toBe(true);
 }finally{if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test.skipIf(process.platform!=='win32')('terminal publication failure reports failure after releasing reservations',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 global.__loopTerminalTest={entered,gate};let running:Awaited<ReturnType<typeof launch>>|undefined,next:Awaited<ReturnType<typeof launch>>|undefined,held:Awaited<ReturnType<typeof open>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`prepare(){count++;}, async quiesce(){globalThis.__loopTerminalTest.entered();await globalThis.__loopTerminalTest.gate;}`));
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'terminal-test',epoch:'first'});
  const record=resolve(root,'.loop/instances/web/terminal-test/first/launch.json'),lock=resolve(root,'.loop/instances/web/terminal-test/active.lock');
  const stopping=running.stop();void stopping.catch(()=>{});await started;
  expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopping');
  held=await open(record,'r');release();
  await expect(stopping).rejects.toThrow('Launch cleanup failed');
  expect((running.inspect() as any).state).toBe('failed');expect((running.inspect() as any).failure).toBeString();
  expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopping');
  await expect(stat(lock)).rejects.toMatchObject({code:'ENOENT'});
  next=await launch(ev,{instance:'terminal-test',epoch:'second'});expect((next.inspect() as any).state).toBe('awaiting-browser');
  const cli=process.env.LOOP_TERMINAL_TEST_CLI;
  if(cli){
   const child=Bun.spawn([resolve(cli),'stop','terminal-test','--root',root,'--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});
   const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
   expect({code,stderr}).toEqual({code:0,stderr:''});expect(JSON.parse(stdout).result.state).toBe('stopped');
   expect((next.inspect() as any).state).toBe('stopped');expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopping');
  }
  await held.close();held=undefined;await next.stop();
 }finally{release();if(held)await held.close().catch(()=>{});if(next)await next.stop().catch(()=>{});if(running)await running.stop().catch(()=>{});delete global.__loopTerminalTest;await rm(root,{recursive:true,force:true});}
},30000);
test('startup and cleanup failures both survive while later disposers run',async()=>{
 const root=await fixture(),global=globalThis as any;global.__loopStartupCleanup={disposed:0};
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`prepare(context){context.resources.defer(()=>{globalThis.__loopStartupCleanup.disposed++;});throw Error('PRIMARY_PREPARE_SENTINEL');},quiesce(){throw Error('CLEANUP_SENTINEL');}`));
  const ev=await evaluate({root,trustLocalConfig:true});let failure:unknown;
  try{await launch(ev,{instance:'startup-cleanup',epoch:'first'});}catch(error){failure=error;}
  expect(failure).toBeInstanceOf(AggregateError);expect(global.__loopStartupCleanup.disposed).toBe(1);
  const base=resolve(root,'.loop/instances/web/startup-cleanup'),record=JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8'));
  expect(record.state).toBe('failed');expect(record.failure).toContain('PRIMARY_PREPARE_SENTINEL');expect(record.failure).toContain('CLEANUP_SENTINEL');expect(await readFile(resolve(base,'active.lock'),'utf8')).toBe('first');
 }finally{delete global.__loopStartupCleanup;await rm(root,{recursive:true,force:true});}
},30000);
test('failed quiescence keeps the reservation and records failure',async()=>{
 const root=await fixture();let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`quiesce(){throw Error('quiesce failed');}`));
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'quiesce-test',epoch:'first'});
  await expect(running.stop()).rejects.toThrow('Launch cleanup failed');
  const base=resolve(root,'.loop/instances/web/quiesce-test');
  expect((await stat(resolve(base,'active.lock'))).isFile()).toBe(true);
  expect(JSON.parse(await readFile(resolve(base,'first/launch.json'),'utf8')).state).toBe('failed');
  await expect(launch(ev,{instance:'quiesce-test',epoch:'second'})).rejects.toMatchObject({code:'E_INSTANCE_BUSY'});
 }finally{if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test('a profile unlock failure does not release the instance reservation',async()=>{
 const root=await fixture();let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'unlock-test',epoch:'first',profile:'test-profile'});
  const profile=resolve(root,'.loop/profiles/test-profile.lock'),instanceLock=resolve(root,'.loop/instances/web/unlock-test/active.lock');
  if(!root.startsWith(resolve(tmpdir(),'loop-hk-'))||profile!==resolve(root,'.loop/profiles/test-profile.lock'))throw Error('Unexpected fixture deletion target');
  await unlink(profile);await mkdir(profile);
  await expect(running.stop()).rejects.toThrow('Launch cleanup failed');
  expect((await stat(instanceLock)).isFile()).toBe(true);
  expect(JSON.parse(await readFile(resolve(root,'.loop/instances/web/unlock-test/first/launch.json'),'utf8')).state).toBe('failed');
 }finally{if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test('stop request during replacement fences promotion and joins cleanup',async()=>{
 const root=await fixture(),client=crypto.randomUUID();let running:Awaited<ReturnType<typeof launch>>|undefined,endpoint:string|undefined;
 try{
  const ev=await evaluate({root,trustLocalConfig:true});running=await launch(ev,{instance:'replace-stop',epoch:'first',dev:true});endpoint=running.endpoint!;
  expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  expect((await fetch(endpoint+'/__loop/ready',{method:'POST',body:client})).status).toBe(200);
  const original=(running.inspect() as any).planId;await writeFile(resolve(root,'app.ts'),'export function start() { return 7; }');
  let deadline=Date.now()+10000;while(Date.now()<deadline&&(running.inspect() as any).state!=='replacing')await Bun.sleep(20);
  expect((running.inspect() as any).state).toBe('replacing');
  await writeFile(resolve(root,'.loop/instances/web/replace-stop/first/stop.request'),'stop\n');
  deadline=Date.now()+3000;while(Date.now()<deadline&&(running.inspect() as any).state!=='stopping')await Bun.sleep(20);
  expect((running.inspect() as any).state).toBe('stopping');
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);
  await running.stop();expect((running.inspect() as any).state).toBe('stopped');expect((running.inspect() as any).planId).toBe(original);
  expect(JSON.parse(await readFile(resolve(root,'.loop/instances/web/replace-stop/first/launch.json'),'utf8')).state).toBe('stopped');
  await expect(stat(resolve(root,'.loop/instances/web/replace-stop/active.lock'))).rejects.toMatchObject({code:'ENOENT'});
 }finally{if(endpoint)await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client}).catch(()=>{});if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
},30000);
test('registered readiness arriving during replacement is cancelled without running hooks',async()=>{
 const root=await fixture(),global=globalThis as any;if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');global.__loopLateReady={count:0};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();await writeFile(config,source.replace('prepare(){count++;}',`ready(){globalThis.__loopLateReady.count++;}`));running=await launch(await evaluate({root,trustLocalConfig:true}),{instance:'late-ready-replace',epoch:'first',dev:true});
  const endpoint=running.endpoint!,client=crypto.randomUUID(),oldPlan=(running.inspect() as any).planId;expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);await writeFile(resolve(root,'app.ts'),'export function start() { return 5; }');
  let deadline=Date.now()+10000;while((running.inspect() as any).state!=='replacing'&&Date.now()<deadline)await Bun.sleep(20);expect((running.inspect() as any).state).toBe('replacing');const ready=await fetch(endpoint+'/__loop/ready',{method:'POST',body:client});expect(ready.status).toBe(200);expect(await ready.json()).toEqual({state:'replacing'});expect(global.__loopLateReady.count).toBe(0);
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);deadline=Date.now()+10000;while((running.inspect() as any).planId===oldPlan&&Date.now()<deadline)await Bun.sleep(20);expect((running.inspect() as any).planId).not.toBe(oldPlan);await running.stop();
 }finally{if(running)await running.stop().catch(()=>{});delete global.__loopLateReady;await rm(root,{recursive:true,force:true});}
},30000);
test('a disposed old-generation ready cannot activate a replacement',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 global.__loopGenerationTest={entered,gate,aborted:false};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`prepare(){count++;}, async ready({signal}){const t=globalThis.__loopGenerationTest;signal.addEventListener('abort',()=>{t.aborted=true;},{once:true});t.entered();await t.gate;if(signal.aborted)throw Object.assign(Error('cancelled'),{name:'AbortError'});}`));
  running=await launch(await evaluate({root,trustLocalConfig:true}),{instance:'generation-test',epoch:'generation-test',dev:true});
  const endpoint=running.endpoint!,oldClient=crypto.randomUUID(),oldPlan=(running.inspect() as any).planId;
  expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:oldClient})).status).toBe(200);
  const first=fetch(endpoint+'/__loop/ready',{method:'POST',body:oldClient});await started;
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:oldClient})).status).toBe(200);
  await writeFile(resolve(root,'app.ts'),'export function start() { return 2; }');
  let deadline=Date.now()+12000;while(Date.now()<deadline&&(running.inspect() as any).state!=='replacing'&&(running.inspect() as any).planId===oldPlan)await Bun.sleep(25);
  expect((running.inspect() as any).state).toBe('replacing');expect(global.__loopGenerationTest.aborted).toBe(true);expect((running.inspect() as any).planId).toBe(oldPlan);
  const record=resolve(root,'.loop/instances/web/generation-test/generation-test/launch.json');deadline=Date.now()+5000;while((await Bun.file(record).json()).state!=='replacing'&&Date.now()<deadline)await Bun.sleep(10);expect((await Bun.file(record).json()).state).toBe('replacing');
  release();const priorReady=await first;expect(priorReady.status).toBe(200);expect(await priorReady.json()).toEqual({state:'replacing'});
  deadline=Date.now()+12000;while(Date.now()<deadline&&(running.inspect() as any).planId===oldPlan)await Bun.sleep(25);
  expect((running.inspect() as any).planId).not.toBe(oldPlan);expect((running.inspect() as any).state).toBe('awaiting-browser');
  const newClient=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:newClient})).status).toBe(200);
  expect((await fetch(endpoint+'/__loop/ready',{method:'POST',body:newClient})).status).toBe(200);expect((running.inspect() as any).state).toBe('active');
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:newClient})).status).toBe(200);await running.stop();
 }finally{release();if(running)await running.stop().catch(()=>{});delete global.__loopGenerationTest;await rm(root,{recursive:true,force:true});}
},30000);
test('stop joins an old ready hook already blocking replacement',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});global.__loopReplacementStop={entered,gate,aborted:false};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();await writeFile(config,source.replace('prepare(){count++;}',`async ready({signal}){const t=globalThis.__loopReplacementStop;signal.addEventListener('abort',()=>{t.aborted=true;},{once:true});t.entered();await t.gate;}`));
  running=await launch(await evaluate({root,trustLocalConfig:true}),{instance:'replacement-ready-stop',epoch:'first',dev:true,profile:'shared'});const endpoint=running.endpoint!,oldPlan=(running.inspect() as any).planId,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  const ready=fetch(endpoint+'/__loop/ready',{method:'POST',body:client});await started;expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);await writeFile(resolve(root,'app.ts'),'export function start() { return 4; }');
  const deadline=Date.now()+10000;while(!(global.__loopReplacementStop.aborted)&&Date.now()<deadline)await Bun.sleep(20);expect(global.__loopReplacementStop.aborted).toBe(true);let finished=false;const stopping=running.stop().then(()=>{finished=true;});await Bun.sleep(50);
  expect(finished).toBe(false);expect((running.inspect() as any).planId).toBe(oldPlan);expect(await Bun.file(resolve(root,'.loop/instances/web/replacement-ready-stop/active.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);
  release();const reply=await ready;expect(reply.status).toBe(200);expect(await reply.json()).toEqual({state:'stopping'});await stopping;expect((running.inspect() as any).state).toBe('stopped');expect(await Bun.file(resolve(root,'.loop/instances/web/replacement-ready-stop/active.lock')).exists()).toBe(false);
 }finally{release();if(running)await running.stop().catch(()=>{});delete global.__loopReplacementStop;await rm(root,{recursive:true,force:true});}
},30000);
test('old readiness failure during replacement remains a launch failure',async()=>{
 const root=await fixture(),global=globalThis as any;let release!:()=>void,entered!:()=>void;
 if(!root.startsWith(resolve(tmpdir(),'loop-hk-')))throw Error('Unexpected fixture deletion target');const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});global.__loopReplacementFailure={entered,gate,aborted:false};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();await writeFile(config,source.replace('prepare(){count++;}',`async ready({signal}){const t=globalThis.__loopReplacementFailure;signal.addEventListener('abort',()=>{t.aborted=true;},{once:true});t.entered();await t.gate;throw Error('old ready failed during replacement');}`));
  running=await launch(await evaluate({root,trustLocalConfig:true}),{instance:'replacement-ready-failure',epoch:'first',dev:true});const endpoint=running.endpoint!,oldPlan=(running.inspect() as any).planId,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  const ready=fetch(endpoint+'/__loop/ready',{method:'POST',body:client});await started;expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);await writeFile(resolve(root,'app.ts'),'export function start() { return 3; }');
  const deadline=Date.now()+10000;while(!(global.__loopReplacementFailure.aborted)&&Date.now()<deadline)await Bun.sleep(20);expect(global.__loopReplacementFailure.aborted).toBe(true);expect((running.inspect() as any).planId).toBe(oldPlan);release();expect((await ready).status).toBe(500);
  const record=resolve(root,'.loop/instances/web/replacement-ready-failure/first/launch.json'),stopDeadline=Date.now()+10000;while(!['failed','stopped'].includes((await Bun.file(record).json()).state)&&Date.now()<stopDeadline)await Bun.sleep(20);const final=await Bun.file(record).json();expect(final.state).toBe('failed');expect(final.failure).toContain('old ready failed during replacement');expect(final.planId).toBe(oldPlan);
 }finally{release();if(running)await running.stop().catch(()=>{});delete global.__loopReplacementFailure;await rm(root,{recursive:true,force:true});}
},30000);
test('a failed ready hook requests cleanup without self-deadlock',async()=>{
 const root=await fixture(),global=globalThis as any;global.__loopFailedReadyTest={quiesced:false};let running:Awaited<ReturnType<typeof launch>>|undefined;
 try{
  const config=resolve(root,'loop.config.ts'),source=await Bun.file(config).text();
  await writeFile(config,source.replace('prepare(){count++;}',`prepare(){count++;}, ready(){throw Error('ready failed');}, quiesce(){globalThis.__loopFailedReadyTest.quiesced=true;}`));
  running=await launch(await evaluate({root,trustLocalConfig:true}),{instance:'failed-ready-test',epoch:'failed-ready-test'});
  const endpoint=running.endpoint!,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  expect((await fetch(endpoint+'/__loop/ready',{method:'POST',body:client})).status).toBe(500);
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);
  await running.stop();expect(global.__loopFailedReadyTest.quiesced).toBe(true);expect((running.inspect() as any).state).toBe('failed');
 }finally{if(running)await running.stop().catch(()=>{});delete global.__loopFailedReadyTest;await rm(root,{recursive:true,force:true});}
},30000);
test('real bundled child handshake, explicit trust refusal, evaluated closure, stale input',async()=>{const root=await fixture();try{await expect(evaluate({root})).rejects.toMatchObject({code:'E_CONFIG_TRUST'});const ev=await evaluate({root,trustLocalConfig:true});expect(ev.plan.plugins[0]?.hooks).toEqual(['prepare']);await writeFile(resolve(root,'app.ts'),'export function start(){return 2}');await expect(assertCurrent(ev)).rejects.toMatchObject({code:'E_STALE_INPUT'});
 const child=Bun.spawn([process.execPath,'--no-install','--no-env-file',resolve('crates/loop-cli/host-tools/dist/worker.js')],{cwd:root,stdin:'pipe',stdout:'pipe',stderr:'pipe'});const iterator=frames(child.stdout)[Symbol.asyncIterator]();child.stdin.write(frame({type:'hello',protocol:1,nonce:'n',supportedPlanSchemas:[1]}));const ack=await iterator.next();expect(ack.value.nonce).toBe('n');child.stdin.write(frame({type:'request',epoch:'e',id:'1',generation:1,operation:'evaluate',payload:{root,trustLocalConfig:true}}));expect((await iterator.next()).value.type).toBe('accepted');const result=(await iterator.next()).value;expect(result.type).toBe('completed');expect(result.result.targetId).toBe('web');child.stdin.write(frame({type:'request',epoch:'e',id:'2',generation:1,operation:'shutdown',payload:{}}));await iterator.next();expect((await iterator.next()).value.type).toBe('completed');child.stdin.end();expect(await child.exited).toBe(0);
 }finally{await rm(root,{recursive:true,force:true});}},30000);
