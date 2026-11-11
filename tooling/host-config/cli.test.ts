/** Opt-in real installed CLI gate: LOOP_TEST_CLI=<fresh binary> bun test this file. */
import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,cp,writeFile,readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {lockFixture} from './lock-fixture';
const binary=process.env.LOOP_TEST_CLI;
export async function prepareProject(cli:string,kit:'browser'|'native',base?:string){const root=base??await mkdtemp(resolve(tmpdir(),'loop-cli-hk-'));const result=await run(cli,['create',root,'--kit',kit,'--yes','--json']);expect(result.code).toBe(0);for(const name of ['host','capabilities','workspace','ui','host-browser','host-native','renderer-dom']){const out=resolve(root,'node_modules/@loop-kit',name);await mkdir(out,{recursive:true});await cp(resolve('packages',name,'dist'),resolve(out,'dist'),{recursive:true});await cp(resolve('packages',name,'package.json'),resolve(out,'package.json'));}await lockFixture(root,['@loop-kit/host','@loop-kit/capabilities','@loop-kit/workspace','@loop-kit/ui','@loop-kit/host-browser','@loop-kit/host-native','@loop-kit/renderer-dom']);return root;}
export async function run(cli:string,args:string[]){const p=Bun.spawn([cli,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',env:{...process.env,BUN_RUNTIME_TRANSPILER_CACHE_PATH:'0'}});const [stdout,stderr,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);return {stdout,stderr,code};}
async function active(root:string,target:string,instance:string,previous?:string){const base=resolve(root,'.loop/instances',target,instance);for(let i=0;i<200;i++){try{for(const epoch of await readdir(base)){if(epoch===previous)continue;const file=resolve(base,epoch,'launch.json');if(await Bun.file(file).exists()){const record=await Bun.file(file).json();if(['active','awaiting-browser'].includes(record.state))return record;}}}catch{}await new Promise(r=>setTimeout(r,50));}throw Error(`Instance did not activate at ${base}`);}
const gate=binary?test:test.skip;
gate('relocated CLI create/inspect/trust/build/run/stop/restart with real child',async()=>{const base=await mkdtemp(resolve(tmpdir(),'loop-cli-installed-'));const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);const root=await prepareProject(cli,'browser');const receipts:any={root,cli};
 const before=await readdir(root);const inspect=await run(cli,['inspect',root,'--json']);expect(inspect.code).toBe(0);expect(JSON.parse(inspect.stdout).executedConfig).toBe(false);expect(await readdir(root)).toEqual(before);
 const denied=await run(cli,['run',root,'--config','loop.config.ts','--target','web','--json']);expect(denied.code).toBe(3);expect(await Bun.file(resolve(root,'.loop')).exists()).toBe(false);
 const evaluated=await run(cli,['inspect',root,'--evaluate-config','--config','loop.config.ts','--trust-local-config','--json']);expect(evaluated.code,evaluated.stderr).toBe(0);const plan=JSON.parse(evaluated.stdout).result;const planFile=resolve(base,'plan.json');await writeFile(planFile,JSON.stringify(plan));expect((await run(cli,['inspect',root,'--plan',planFile,'--json'])).code).toBe(0);await writeFile(planFile,JSON.stringify({...plan,targetId:'corrupted'}));expect((await run(cli,['inspect',root,'--plan',planFile,'--json'])).code).not.toBe(0);
 const built=await run(cli,['build',root,'--config','loop.config.ts','--target','web','--trust-local-config','--json']);expect(built.code,built.stderr).toBe(0);expect(await Bun.file(resolve(root,'dist/web/index.html')).exists()).toBe(true);
 const start=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','web','--instance','smoke','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});try{const first=await active(root,'web','smoke');receipts.first=first;expect((await fetch(first.endpoint)).status).toBe(200);const stop=await run(cli,['stop','smoke','--root',root,'--json']);expect(stop.code,stop.stderr).toBe(0);expect((await run(cli,['stop','smoke','--root',root,'--json'])).code).toBe(0);expect(await start.exited).toBe(0);const restart=Bun.spawn([cli,'restart','smoke','--root',root,'--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});try{const second=await active(root,'web','smoke',first.epoch);receipts.second=second;expect(second.epoch).not.toBe(first.epoch);expect((await run(cli,['stop','smoke','--root',root,'--json'])).code).toBe(0);expect(await restart.exited).toBe(0);}finally{if(restart.exitCode===null){restart.kill();await restart.exited;}}}finally{if(start.exitCode===null){start.kill();await start.exited;}}
 receipts.cliSha256=new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex');
 receipts.checks=['relocated starter creation','static inspection reports no config execution and preserves root inventory','untrusted run refused','trusted evaluated plan and tampered digest rejection','browser build output','HTTP availability','idempotent stop','restart creates a new epoch','both owned foreground processes exit'];
 receipts.limits=['Copied local package builds and a relocated debug CLI, not a published release','HTTP probe only; no browser UI or Component guest was exercised','Static inspection did not check writes outside the project root'];
 const receiptPath=resolve('target/host-config-smoke',crypto.randomUUID()+'.json');await mkdir('target/host-config-smoke',{recursive:true});await writeFile(receiptPath,JSON.stringify(receipts,null,2),{flag:'wx'});console.log(`CLI smoke receipt: ${receiptPath}`);
},60000);

// Opt-in only: window avoidance depends on the reviewed CLI honoring prepare before native spawn.
const nativeFakeGate=binary&&process.env.LOOP_TEST_NATIVE_FAKE_CLI==='1'?test:test.skip;
nativeFakeGate('relocated native CLI uses real provider over a headless fake backend',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-native-fake-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'native'),config=resolve(root,'loop.config.ts'),original=await readFile(config,'utf8');
 if(!original.includes("import {defineConfig} from '@loop-kit/host';")||!original.includes('plugins:[statusPlugin()'))throw Error('Unexpected native scaffold grammar');
 const interceptor=`const fake=defineHostPlugin({apiVersion:1,identity:{id:'test:plugin/headless-backend',version:'1.0.0'},key:'headless-backend',targets:['desktop'],runtime:[],prepare(){const original=Bun.spawn;Bun.spawn=function(args,options){if(Array.isArray(args)&&typeof args[1]==='string'&&args[1].startsWith('native-')){if(args[1]!=='native-surface')throw Error('Unexpected native backend');return original([process.execPath,...args.slice(1)],options);}return original(args,options);};}});\n`;
 await writeFile(config,original.replace("import {defineConfig} from '@loop-kit/host';","import {defineConfig,defineHostPlugin} from '@loop-kit/host';").replace('export default defineConfig(',interceptor+'export default defineConfig(').replace('plugins:[statusPlugin()','plugins:[fake,statusPlugin()'));
 const backend=`const send=async value=>{const body=Buffer.from(JSON.stringify(value)),frame=Buffer.alloc(4+body.length);frame.writeUInt32LE(body.length);body.copy(frame,4);await new Promise((resolve,reject)=>process.stdout.write(frame,error=>error?reject(error):resolve()));};
const epoch=process.argv[process.argv.indexOf('--epoch')+1];setTimeout(()=>process.exit(2),15000).unref();await Bun.write('backend.pid',String(process.pid));await send({type:'ready',epoch,instanceId:'fake'});let pending=Buffer.alloc(0);
for await(const chunk of Bun.stdin.stream()){pending=Buffer.concat([pending,Buffer.from(chunk)]);while(pending.length>=4){const n=pending.readUInt32LE();if(pending.length<n+4)break;const message=JSON.parse(pending.subarray(4,n+4));pending=pending.subarray(n+4);if(message.type==='render'){await Bun.write('render-'+message.frame.revision+'.json',JSON.stringify(message));if(message.frame.revision===0)await send({type:'event',epoch,event:{revision:0,sequence:1,key:'next',type:'activate'}});}if(message.type==='close'){await Bun.write('closed.json',JSON.stringify(message));await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);}}}`;
 await writeFile(resolve(root,'native-surface'),backend);const manifestFile=resolve(root,'loop.package.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));manifest.sourcePaths.push('native-surface');await writeFile(manifestFile,JSON.stringify(manifest));
 const inspected=await run(cli,['inspect',root,'--evaluate-config','--config','loop.config.ts','--target','desktop','--trust-local-config','--json']);expect(inspected.code,inspected.stderr).toBe(0);const plan=JSON.parse(inspected.stdout).result;expect(plan.plugins.find((plugin:any)=>plugin.key==='headless-backend')?.hooks).toContain('prepare');
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','desktop','--instance','fake-native','--profile','shared','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});let completed=false;
 try{
  const launched=await active(root,'desktop','fake-native'),second=resolve(root,'render-1.json'),deadline=Date.now()+5000;while(!await Bun.file(second).exists()&&Date.now()<deadline)await Bun.sleep(20);expect(await Bun.file(second).exists()).toBe(true);
  const firstFrame=JSON.parse(await readFile(resolve(root,'render-0.json'),'utf8')).frame,secondFrame=JSON.parse(await readFile(second,'utf8')).frame;expect(firstFrame.root.children[0].text).toContain(': 1');expect(secondFrame.root.children[0].text).toContain(': 2');
  const pid=Number(await readFile(resolve(root,'backend.pid'),'utf8'));expect(processExists(pid)).toBe(true);const stopped=await run(cli,['stop','fake-native','--root',root,'--json']);expect(stopped.code,stopped.stderr).toBe(0);expect(await owner.exited).toBe(0);expect(processExists(pid)).toBe(false);
  expect(JSON.parse(await readFile(resolve(root,'closed.json'),'utf8')).type).toBe('close');expect(JSON.parse(await readFile(resolve(launched.path,'launch.json'),'utf8')).state).toBe('stopped');expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);
  const receipt={cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,planId:plan.planId,pid,frames:[firstFrame,secondFrame],backendExited:true,limits:['Trusted test plugin redirects native-surface to a Bun fake process; no Rust native backend, Tao/Wry window or Component guest was exercised','Window avoidance depends on the reviewed CLI honoring the inspected prepare hook and Bun.spawn interception; do not run this test with an unreviewed CLI if windows must be avoided','The fake process self-exits after 15 seconds; this is not a process-tree containment proof']};
  const receiptPath=resolve('target/native-headless-cli',crypto.randomUUID()+'.json');await mkdir(resolve('target/native-headless-cli'),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(`Headless native CLI receipt: ${receiptPath}`);completed=true;
 }finally{if(owner.exitCode===null){owner.kill();await owner.exited;}if(!completed)console.error(`Headless native fixture: ${root}; stderr=${await new Response(owner.stderr).text()}`);}
},60000);

nativeFakeGate('relocated native CLI holds reservations through cancelled readiness',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-native-ready-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'native'),config=resolve(root,'loop.config.ts'),original=await readFile(config,'utf8');
 if(!original.includes("import {defineConfig} from '@loop-kit/host';")||!original.includes('plugins:[statusPlugin()'))throw Error('Unexpected native scaffold grammar');
 const interceptor=`const fake=defineHostPlugin({apiVersion:1,identity:{id:'test:plugin/headless-backend',version:'1.0.0'},key:'headless-backend',targets:['desktop'],runtime:[],prepare(){const original=Bun.spawn;Bun.spawn=function(args,options){if(Array.isArray(args)&&typeof args[1]==='string'&&args[1].startsWith('native-')){if(args[1]!=='native-surface')throw Error('Unexpected native backend');return original([process.execPath,...args.slice(1)],options);}return original(args,options);};},async ready({signal}){signal.addEventListener('abort',()=>void Bun.write('abort-observed','1'),{once:true});await Bun.write('hook-entered','1');while(!await Bun.file('release-ready').exists())await Bun.sleep(20);await Bun.write('hook-finished','1');}});\n`;
 await writeFile(config,original.replace("import {defineConfig} from '@loop-kit/host';","import {defineConfig,defineHostPlugin} from '@loop-kit/host';").replace('export default defineConfig(',interceptor+'export default defineConfig(').replace('plugins:[statusPlugin()','plugins:[fake,statusPlugin()'));
 const backend=`const send=async value=>{const body=Buffer.from(JSON.stringify(value)),frame=Buffer.alloc(4+body.length);frame.writeUInt32LE(body.length);body.copy(frame,4);await new Promise((resolve,reject)=>process.stdout.write(frame,error=>error?reject(error):resolve()));};const epoch=process.argv[process.argv.indexOf('--epoch')+1];setTimeout(()=>process.exit(2),15000).unref();await Bun.write('backend.pid',String(process.pid));await send({type:'ready',epoch,instanceId:'fake'});while(!await Bun.file('hook-entered').exists())await Bun.sleep(10);await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);`;
 await writeFile(resolve(root,'native-surface'),backend);const manifestFile=resolve(root,'loop.package.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));manifest.sourcePaths.push('native-surface');await writeFile(manifestFile,JSON.stringify(manifest));
 const inspected=await run(cli,['inspect',root,'--evaluate-config','--config','loop.config.ts','--target','desktop','--trust-local-config','--json']);expect(inspected.code,inspected.stderr).toBe(0);const plan=JSON.parse(inspected.stdout).result,plugin=plan.plugins.find((item:any)=>item.key==='headless-backend');expect(plugin?.hooks).toContain('prepare');expect(plugin?.hooks).toContain('ready');
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','desktop','--instance','held-ready','--profile','shared','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});let completed=false;
 try{
  const abortMarker=resolve(root,'abort-observed'),deadline=Date.now()+8000;while(!await Bun.file(abortMarker).exists()&&Date.now()<deadline)await Bun.sleep(20);expect(await Bun.file(abortMarker).exists()).toBe(true);
  const instance=resolve(root,'.loop/instances/desktop/held-ready'),epoch=await readFile(resolve(instance,'active.lock'),'utf8');expect(epoch.length).toBeGreaterThan(0);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'hook-finished')).exists()).toBe(false);
  await writeFile(resolve(root,'release-ready'),'1');const code=await owner.exited,stdout=await new Response(owner.stdout).text(),stderr=await new Response(owner.stderr).text();expect(code,stderr+'\n'+stdout).toBe(130);expect(JSON.parse(stdout).diagnostics[0].code).toBe('E_CANCELLED');expect(await Bun.file(resolve(root,'hook-finished')).exists()).toBe(true);
  const record=JSON.parse(await readFile(resolve(instance,epoch,'launch.json'),'utf8'));expect(record.state).toBe('failed');expect(record.failure.toLowerCase()).toContain('cancelled');expect(await Bun.file(resolve(instance,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);
  const receipt={cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,planId:plan.planId,epoch,exitCode:code,abortObserved:true,instanceAndProfileHeldDuringReady:true,hookFinishedBeforeUnlock:true,recordState:record.state,limits:['Trusted prepare hook redirects native-surface to a Bun protocol fake; no Rust native backend, Tao/Wry window or Component guest was exercised','Window avoidance depends on the reviewed CLI honoring the inspected prepare hook and Bun.spawn interception','Fake backend self-exits after 15 seconds; this is not a process-tree containment proof']};
  const receiptPath=resolve('target/native-headless-cli',crypto.randomUUID()+'.json');await mkdir(resolve('target/native-headless-cli'),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(`Headless native readiness receipt: ${receiptPath}`);completed=true;
 }finally{await writeFile(resolve(root,'release-ready'),'1');if(owner.exitCode===null){owner.kill();await owner.exited;}if(!completed)console.error(`Native readiness fixture: ${root}`);}
},60000);

nativeFakeGate('relocated native CLI cancels a pending backend handshake',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-native-stop-handshake-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'native'),config=resolve(root,'loop.config.ts'),original=await readFile(config,'utf8');
 if(!original.includes("import {defineConfig} from '@loop-kit/host';")||!original.includes('plugins:[statusPlugin()'))throw Error('Unexpected native scaffold grammar');
 const interceptor=`const fake=defineHostPlugin({apiVersion:1,identity:{id:'test:plugin/headless-backend',version:'1.0.0'},key:'headless-backend',targets:['desktop'],runtime:[],prepare({signal}){signal.addEventListener('abort',()=>void Bun.write('handshake-aborted','1'),{once:true});const original=Bun.spawn;Bun.spawn=function(args,options){if(Array.isArray(args)&&typeof args[1]==='string'&&args[1].startsWith('native-')){if(args[1]!=='native-surface')throw Error('Unexpected native backend');return original([process.execPath,...args.slice(1)],options);}return original(args,options);};}});\n`;
 await writeFile(config,original.replace("import {defineConfig} from '@loop-kit/host';","import {defineConfig,defineHostPlugin} from '@loop-kit/host';").replace('export default defineConfig(',interceptor+'export default defineConfig(').replace('plugins:[statusPlugin()','plugins:[fake,statusPlugin()'));
 const backend=`const send=async value=>{const body=Buffer.from(JSON.stringify(value)),frame=Buffer.alloc(4+body.length);frame.writeUInt32LE(body.length);body.copy(frame,4);await new Promise((resolve,reject)=>process.stdout.write(frame,error=>error?reject(error):resolve()));};const epoch=process.argv[process.argv.indexOf('--epoch')+1];setTimeout(()=>process.exit(2),20000).unref();await Bun.write('backend.pid',String(process.pid));let pending=Buffer.alloc(0);for await(const chunk of Bun.stdin.stream()){pending=Buffer.concat([pending,Buffer.from(chunk)]);while(pending.length>=4){const n=pending.readUInt32LE();if(pending.length<n+4)break;const message=JSON.parse(pending.subarray(4,n+4));pending=pending.subarray(n+4);if(message.type==='close'){await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);}}}`;
 await writeFile(resolve(root,'native-surface'),backend);const manifestFile=resolve(root,'loop.package.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));manifest.sourcePaths.push('native-surface');await writeFile(manifestFile,JSON.stringify(manifest));
 const inspected=await run(cli,['inspect',root,'--evaluate-config','--config','loop.config.ts','--target','desktop','--trust-local-config','--json']);expect(inspected.code,inspected.stderr).toBe(0);expect(JSON.parse(inspected.stdout).result.plugins.find((item:any)=>item.key==='headless-backend')?.hooks).toContain('prepare');
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','desktop','--instance','native-handshake','--profile','shared','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});let completed=false;
 try{
  const marker=resolve(root,'backend.pid'),deadline=Date.now()+10000;while(!await Bun.file(marker).exists()&&Date.now()<deadline)await Bun.sleep(20);expect(await Bun.file(marker).exists()).toBe(true);
  const instance=resolve(root,'.loop/instances/desktop/native-handshake'),epoch=await readFile(resolve(instance,'active.lock'),'utf8'),record=resolve(instance,epoch,'launch.json'),pid=Number(await readFile(marker,'utf8'));expect(JSON.parse(await readFile(record,'utf8')).state).toBe('starting');expect(processExists(pid)).toBe(true);
  const stopped=await run(cli,['stop','native-handshake','--root',root,'--json']),ownerCode=await owner.exited,ownerOut=await new Response(owner.stdout).text(),ownerErr=await new Response(owner.stderr).text();
  expect(stopped.code,stopped.stderr+'\n'+stopped.stdout).toBe(0);expect(ownerCode,ownerErr+'\n'+ownerOut).toBe(130);expect(await Bun.file(resolve(root,'handshake-aborted')).exists()).toBe(true);expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopped');expect(await Bun.file(resolve(instance,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);expect(processExists(pid)).toBe(false);
  const receipt={cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,epoch,pid,stopCode:stopped.code,ownerCode,startingObserved:true,backendReady:false,backendExited:true,recordState:'stopped',limits:['Trusted prepare hook redirects native-surface to a Bun protocol fake; no Rust native backend, Tao/Wry window or Component guest was exercised','Window avoidance depends on the reviewed CLI honoring the inspected prepare hook and Bun.spawn interception','The fake backend has a 20-second self-exit; this does not prove process-tree containment']};
  const receiptPath=resolve('target/native-headless-cli',crypto.randomUUID()+'.json');await mkdir(resolve('target/native-headless-cli'),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(`Native handshake stop receipt: ${receiptPath}`);completed=true;
 }finally{if(owner.exitCode===null){owner.kill();await owner.exited;}if(!completed)console.error(`Native handshake stop fixture: ${root}`);}
},60000);

nativeFakeGate('relocated native CLI stops held readiness without early unlock',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-native-stop-ready-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'native'),config=resolve(root,'loop.config.ts'),original=await readFile(config,'utf8');
 if(!original.includes("import {defineConfig} from '@loop-kit/host';")||!original.includes('plugins:[statusPlugin()'))throw Error('Unexpected native scaffold grammar');
 const interceptor=`const fake=defineHostPlugin({apiVersion:1,identity:{id:'test:plugin/headless-backend',version:'1.0.0'},key:'headless-backend',targets:['desktop'],runtime:[],prepare(){const original=Bun.spawn;Bun.spawn=function(args,options){if(Array.isArray(args)&&typeof args[1]==='string'&&args[1].startsWith('native-')){if(args[1]!=='native-surface')throw Error('Unexpected native backend');return original([process.execPath,...args.slice(1)],options);}return original(args,options);};},async ready({signal}){signal.addEventListener('abort',()=>void Bun.write('ready-aborted','1'),{once:true});await Bun.write('ready-entered','1');while(!await Bun.file('release-ready').exists())await Bun.sleep(20);await Bun.write('ready-finished','1');}});\n`;
 await writeFile(config,original.replace("import {defineConfig} from '@loop-kit/host';","import {defineConfig,defineHostPlugin} from '@loop-kit/host';").replace('export default defineConfig(',interceptor+'export default defineConfig(').replace('plugins:[statusPlugin()','plugins:[fake,statusPlugin()'));
 const backend=`const send=async value=>{const body=Buffer.from(JSON.stringify(value)),frame=Buffer.alloc(4+body.length);frame.writeUInt32LE(body.length);body.copy(frame,4);await new Promise((resolve,reject)=>process.stdout.write(frame,error=>error?reject(error):resolve()));};const epoch=process.argv[process.argv.indexOf('--epoch')+1];setTimeout(()=>process.exit(2),20000).unref();await Bun.write('backend.pid',String(process.pid));await send({type:'ready',epoch,instanceId:'fake'});let pending=Buffer.alloc(0);for await(const chunk of Bun.stdin.stream()){pending=Buffer.concat([pending,Buffer.from(chunk)]);while(pending.length>=4){const n=pending.readUInt32LE();if(pending.length<n+4)break;const message=JSON.parse(pending.subarray(4,n+4));pending=pending.subarray(n+4);if(message.type==='close'){await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);}}}`;
 await writeFile(resolve(root,'native-surface'),backend);const manifestFile=resolve(root,'loop.package.json'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));manifest.sourcePaths.push('native-surface');await writeFile(manifestFile,JSON.stringify(manifest));
 const inspected=await run(cli,['inspect',root,'--evaluate-config','--config','loop.config.ts','--target','desktop','--trust-local-config','--json']);expect(inspected.code,inspected.stderr).toBe(0);const plugin=JSON.parse(inspected.stdout).result.plugins.find((item:any)=>item.key==='headless-backend');expect(plugin?.hooks).toContain('prepare');expect(plugin?.hooks).toContain('ready');
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','desktop','--instance','native-starting','--profile','shared','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});let stopClient:ReturnType<typeof Bun.spawn>|undefined,completed=false;
 try{
  const entered=resolve(root,'ready-entered'),abort=resolve(root,'ready-aborted'),deadline=Date.now()+10000;while(!await Bun.file(entered).exists()&&Date.now()<deadline)await Bun.sleep(20);expect(await Bun.file(entered).exists()).toBe(true);
  const instance=resolve(root,'.loop/instances/desktop/native-starting'),epoch=await readFile(resolve(instance,'active.lock'),'utf8'),record=resolve(instance,epoch,'launch.json'),pid=Number(await readFile(resolve(root,'backend.pid'),'utf8'));expect(JSON.parse(await readFile(record,'utf8')).state).toBe('starting');expect(processExists(pid)).toBe(true);
  const client=Bun.spawn([cli,'stop','native-starting','--root',root,'--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});stopClient=client;const abortDeadline=Date.now()+5000;while(!await Bun.file(abort).exists()&&Date.now()<abortDeadline)await Bun.sleep(20);
  expect(await Bun.file(abort).exists()).toBe(true);expect(await Bun.file(resolve(instance,'active.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'ready-finished')).exists()).toBe(false);
  await writeFile(resolve(root,'release-ready'),'1');const [stopCode,ownerCode]=await Promise.all([client.exited,owner.exited]);const stopOut=await new Response(client.stdout).text(),stopErr=await new Response(client.stderr).text(),ownerOut=await new Response(owner.stdout).text(),ownerErr=await new Response(owner.stderr).text();
  expect(stopCode,stopErr+'\n'+stopOut).toBe(0);expect(ownerCode,ownerErr+'\n'+ownerOut).toBe(130);expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopped');expect(await Bun.file(resolve(root,'ready-finished')).exists()).toBe(true);expect(await Bun.file(resolve(instance,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);expect(processExists(pid)).toBe(false);
  const receipt={cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,epoch,pid,stopCode,ownerCode,startingObserved:true,abortObserved:true,locksHeldThroughReady:true,backendExited:true,recordState:'stopped',limits:['Trusted prepare hook redirects native-surface to a Bun protocol fake; no Rust native backend, Tao/Wry window or Component guest was exercised','Window avoidance depends on the reviewed CLI honoring the inspected prepare hook and Bun.spawn interception','Noncooperative hooks can still delay cleanup; fake backend has a 20-second self-exit']};
  const receiptPath=resolve('target/native-headless-cli',crypto.randomUUID()+'.json');await mkdir(resolve('target/native-headless-cli'),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(`Native starting stop receipt: ${receiptPath}`);completed=true;
 }finally{await writeFile(resolve(root,'release-ready'),'1');if(stopClient&&stopClient.exitCode===null){stopClient.kill();await stopClient.exited;}if(owner.exitCode===null){owner.kill();await owner.exited;}if(!completed)console.error(`Native starting stop fixture: ${root}`);}
},60000);

async function addHookOnly(root:string,hook:'prepare'|'ready'|'quiesce',body:string,extra=''){
 const config=resolve(root,'loop.config.ts'),original=await readFile(config,'utf8');
 if(!original.includes("import {defineConfig} from '@loop-kit/host';")||!original.includes('plugins:[statusPlugin()'))throw Error('Unexpected scaffold grammar');
 const plugin=`const slow=defineHostPlugin({apiVersion:1,identity:{id:'test:plugin/slow',version:'1.0.0'},key:'slow',targets:['browser'],runtime:[],async ${hook}(){${body}}${extra}});\n`;
 const edited=original.replace("import {defineConfig} from '@loop-kit/host';","import {defineConfig,defineHostPlugin} from '@loop-kit/host';").replace('export default defineConfig(',plugin+'export default defineConfig(').replace('plugins:[statusPlugin()','plugins:[slow,statusPlugin()');
 await writeFile(config,edited);
}

gate('browser replacement joins old ready before reloading',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-replace-ready-browser-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);const root=await prepareProject(cli,'browser');
 await addHookOnly(root,'ready',"const {signal}=arguments[0];if(!await Bun.file('ready-seen').exists()){await Bun.write('ready-seen','1');signal.addEventListener('abort',()=>void Bun.write('ready-aborted','1'),{once:true});await Bun.write('ready-entered','1');while(!await Bun.file('release-ready').exists())await Bun.sleep(20);}");
 const child=Bun.spawn(['node',resolve('tooling/host-browser/replace-during-ready.mjs'),cli,root],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);expect(code,stderr+'\n'+stdout).toBe(0);console.log(stdout);
},60000);
gate('browser stop during ready finishes without a readiness error',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-stop-ready-browser-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);const root=await prepareProject(cli,'browser');
 await addHookOnly(root,'ready',"await Bun.write('ready-entered','1');while(!await Bun.file('release-ready').exists())await Bun.sleep(20);");
 const child=Bun.spawn(['node',resolve('tooling/host-browser/stop-during-ready.mjs'),cli,root],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);expect(code,stderr+'\n'+stdout).toBe(0);console.log(stdout);
},60000);
gate('relocated CLI refuses an unrecorded reservation despite stopped history',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-unrecorded-owner-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=resolve(base,'project'),instance=resolve(root,'.loop/instances/web/same'),old=resolve(instance,'old');await mkdir(old,{recursive:true});
 await writeFile(resolve(old,'launch.json'),JSON.stringify({schemaVersion:1,targetId:'web',instanceId:'same',epoch:'old',state:'stopped'}));await writeFile(resolve(instance,'active.lock'),'new');
 const result=await run(cli,['stop','same','--root',root,'--json']);expect(result.code,result.stderr+'\n'+result.stdout).toBe(4);expect(JSON.parse(result.stdout).diagnostics[0].code).toBe('E_RUNTIME_STOP');expect(await readFile(resolve(instance,'active.lock'),'utf8')).toBe('new');expect(await Bun.file(resolve(old,'stop.request')).exists()).toBe(false);
 const receipt={cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,exitCode:result.code,diagnostic:'E_RUNTIME_STOP',lockPreserved:true,limits:['Synthetic same-user filesystem fixture; does not prove an atomic cross-process snapshot','A lock acquired after lookup can still race this observation']};const receiptPath=resolve('target/host-config-unrecorded-lock',crypto.randomUUID()+'.json');await mkdir(resolve('target/host-config-unrecorded-lock'),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(`Unrecorded reservation receipt: ${receiptPath}`);
},60000);
gate('relocated CLI stops held prepare without releasing reservations early',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-start-stop-')),cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');
 await addHookOnly(root,'prepare',"const {signal}=arguments[0];signal.addEventListener('abort',()=>void Bun.write('prepare-aborted','1'),{once:true});await Bun.write('prepare-entered','1');while(!await Bun.file('release-prepare').exists())await Bun.sleep(20);await Bun.write('prepare-finished','1');");
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','web','--instance','preparing','--profile','shared','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});let stopClient:ReturnType<typeof Bun.spawn>|undefined,completed=false;
 try{
  const entered=resolve(root,'prepare-entered'),abort=resolve(root,'prepare-aborted'),deadline=Date.now()+10000;while(!await Bun.file(entered).exists()&&Date.now()<deadline)await Bun.sleep(20);expect(await Bun.file(entered).exists()).toBe(true);
  const instance=resolve(root,'.loop/instances/web/preparing'),epoch=await readFile(resolve(instance,'active.lock'),'utf8'),record=resolve(instance,epoch,'launch.json');expect(JSON.parse(await readFile(record,'utf8')).state).toBe('starting');
  const client=Bun.spawn([cli,'stop','preparing','--root',root,'--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});stopClient=client;const abortDeadline=Date.now()+5000;while(!await Bun.file(abort).exists()&&Date.now()<abortDeadline)await Bun.sleep(20);
  expect(await Bun.file(abort).exists()).toBe(true);expect(await Bun.file(resolve(instance,'active.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(true);expect(await Bun.file(resolve(root,'prepare-finished')).exists()).toBe(false);
  await writeFile(resolve(root,'release-prepare'),'1');const [stopCode,ownerCode]=await Promise.all([client.exited,owner.exited]);const stopOut=await new Response(client.stdout).text(),stopErr=await new Response(client.stderr).text(),ownerOut=await new Response(owner.stdout).text(),ownerErr=await new Response(owner.stderr).text();
  expect(stopCode,stopErr+'\n'+stopOut).toBe(0);expect(ownerCode,ownerErr+'\n'+ownerOut).toBe(130);expect(JSON.parse(await readFile(record,'utf8')).state).toBe('stopped');expect(await Bun.file(resolve(root,'prepare-finished')).exists()).toBe(true);expect(await Bun.file(resolve(instance,'active.lock')).exists()).toBe(false);expect(await Bun.file(resolve(root,'.loop/profiles/shared.lock')).exists()).toBe(false);
  const receipt={cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,epoch,stopCode,ownerCode,startingObserved:true,abortObserved:true,locksHeldThroughPrepare:true,recordState:'stopped',limits:['Browser profile only; no browser window or native UI was launched','Trusted prepare hook cooperatively returns after explicit release; noncooperative hooks can still delay cleanup']};
  const receiptPath=resolve('target/host-config-start-stop',crypto.randomUUID()+'.json');await mkdir(resolve('target/host-config-start-stop'),{recursive:true});await writeFile(receiptPath,JSON.stringify(receipt,null,2),{flag:'wx'});console.log(`Starting stop receipt: ${receiptPath}`);completed=true;
 }finally{await writeFile(resolve(root,'release-prepare'),'1');if(stopClient&&stopClient.exitCode===null){stopClient.kill();await stopClient.exited;}if(owner.exitCode===null){owner.kill();await owner.exited;}if(!completed)console.error(`Starting stop fixture: ${root}`);}
},60000);
gate('relocated CLI acknowledges two stops during slow cooperative quiescence',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-concurrent-stop-'));
 const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');
 await addHookOnly(root,'quiesce',"console.error('LOOP_TEST_QUIESCE');await new Promise(resolve=>setTimeout(resolve,7000));");
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','web','--instance','slow','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});
 try{
  const launched=await active(root,'web','slow'),client=crypto.randomUUID(),endpoint=launched.endpoint;
  expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  expect((await fetch(endpoint+'/__loop/ready',{method:'POST',body:client})).status).toBe(200);
  const started=Date.now(),first=run(cli,['stop','slow','--root',root,'--json']);
  const deadline=Date.now()+5000;let state='';
  while(Date.now()<deadline){state=(await Bun.file(resolve(launched.path,'launch.json')).json()).state;if(state==='stopping')break;await Bun.sleep(20);}
  expect(state).toBe('stopping');
  const second=run(cli,['stop','slow','--root',root,'--json']);
  expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);
  const [a,b]=await Promise.all([first,second]);
  expect(a.code,a.stderr).toBe(0);expect(b.code,b.stderr).toBe(0);expect(Date.now()-started).toBeGreaterThan(6500);
  expect((await owner.exited)).toBe(0);const logs=await new Response(owner.stderr).text();expect(logs.match(/LOOP_TEST_QUIESCE/g)??[]).toHaveLength(1);
  expect((await Bun.file(resolve(launched.path,'launch.json')).json()).state).toBe('stopped');
 }finally{if(owner.exitCode===null){owner.kill();await owner.exited;}}
},45000);

function processExists(pid:number){try{process.kill(pid,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error;}}
gate('relocated CLI terminates an owned descendant after a noncooperative stop',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-owned-descendant-'));
 const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');
 await addHookOnly(root,'ready',`const child=Bun.spawn([process.execPath,'-e','setTimeout(()=>process.exit(0),25000)'],{stdin:'ignore',stdout:'ignore',stderr:'ignore'});await Bun.write(${JSON.stringify(resolve(root,'descendant-pid.txt'))},String(child.pid));await new Promise(()=>{});`);
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','web','--instance','descendant','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});
 const abort=new AbortController(),stderr=new Response(owner.stderr).text();let ready:Promise<unknown>|undefined,complete=false;const readyState:{status?:number;error?:string}={};
 try{
  const launched=await active(root,'web','descendant'),client=crypto.randomUUID();
  expect((await fetch(launched.endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
  ready=fetch(launched.endpoint+'/__loop/ready',{method:'POST',body:client,signal:abort.signal}).then(response=>{readyState.status=response.status;}).catch(error=>{readyState.error=String(error);});
  const markerPath=resolve(root,'descendant-pid.txt'),deadline=Date.now()+5000;
  while(!await Bun.file(markerPath).exists()&&Date.now()<deadline)await Bun.sleep(20);
  expect(await Bun.file(markerPath).exists(),JSON.stringify(readyState)).toBe(true);const pid=Number(await Bun.file(markerPath).text());expect(Number.isSafeInteger(pid)&&pid>0).toBe(true);expect(processExists(pid)).toBe(true);
  const start=Date.now(),stop=await run(cli,['stop','descendant','--root',root,'--json']);const ownerCode=await owner.exited,elapsedMs=Date.now()-start;
  const ownerOut=await new Response(owner.stdout).text();expect(stop.code).toBe(4);expect(ownerCode).toBe(4);expect(ownerOut).toContain('E_RUNTIME_STOP_TIMEOUT');
  expect(elapsedMs).toBeLessThan(20000);expect(processExists(pid)).toBe(false);
  expect((await Bun.file(resolve(launched.path,'launch.json')).json()).state).toBe('stopping');expect(await readFile(resolve(root,'.loop/instances/web/descendant/active.lock'),'utf8')).toBe(launched.epoch);
  const output=resolve('target/process-tree-test',crypto.randomUUID()+'.json');await mkdir(resolve('target/process-tree-test'),{recursive:true});
  await writeFile(output,JSON.stringify({cliSha256:new Bun.CryptoHasher('sha256').update(await Bun.file(cli).bytes()).digest('hex'),root,pid,observedAliveBefore:true,observedAliveAfter:false,elapsedMs,ownerCode,stopCode:stop.code,recordState:'stopping',reservationRetained:true,limits:['One ordinary descendant; not escaped or independently verified multi-generation descendants','PID probing is best-effort and does not prove complete process-tree containment','Fixture child also self-exits after 25 seconds']},null,2),{flag:'wx'});console.log(`Process-tree receipt: ${output}`);complete=true;
 }finally{abort.abort();if(ready)await ready;if(owner.exitCode===null){owner.kill();await owner.exited;}const logs=await stderr;if(!complete)console.error(`Descendant fixture: ${root}; ready=${JSON.stringify(readyState)}; stderr=${logs}`);}
},45000);

gate('relocated CLI cleans up after an unprintable startup throw',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-unprintable-startup-'));
 const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');await addHookOnly(root,'prepare',"throw {get message(){throw Error('message getter');},toString(){throw Error('toString');}};");
 const result=await run(cli,['run',root,'--config','loop.config.ts','--target','web','--instance','unprintable','--trust-local-config','--json']);
 expect(result.code,result.stderr).toBe(4);const diagnostic=JSON.parse(result.stdout).diagnostics[0];expect(diagnostic.code).toBe('E_RUNTIME');expect(diagnostic.message).toContain('[unprintable error]');
 expect(await Bun.file(resolve(root,'.loop/instances/web/unprintable/active.lock')).exists()).toBe(false);
},45000);

gate('relocated CLI reports a null startup throw without protocol failure',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-null-startup-'));
 const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');await addHookOnly(root,'prepare','throw null;');
 const result=await run(cli,['run',root,'--config','loop.config.ts','--target','web','--instance','null-throw','--trust-local-config','--json']);
 expect(result.code,result.stderr).toBe(4);const diagnostic=JSON.parse(result.stdout).diagnostics[0];expect(diagnostic.code).toBe('E_RUNTIME');expect(diagnostic.message).toContain('null');
},45000);

gate('relocated CLI preserves startup and cleanup failure details',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-startup-cleanup-'));
 const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');await addHookOnly(root,'prepare',"throw Error('PRIMARY_PREPARE_SENTINEL');",",async quiesce(){throw Error('CLEANUP_SENTINEL');}");
 const result=await run(cli,['run',root,'--config','loop.config.ts','--target','web','--instance','startup-failure','--trust-local-config','--json']);
 expect(result.code,result.stderr).toBe(4);const diagnostic=JSON.parse(result.stdout).diagnostics[0];
 expect(diagnostic.message).toContain('PRIMARY_PREPARE_SENTINEL');expect(diagnostic.message).toContain('CLEANUP_SENTINEL');
 const baseDir=resolve(root,'.loop/instances/web/startup-failure'),epoch=await readFile(resolve(baseDir,'active.lock'),'utf8');
 const record=await Bun.file(resolve(baseDir,epoch,'launch.json')).json();expect(record.state).toBe('failed');expect(record.failure).toContain('PRIMARY_PREPARE_SENTINEL');expect(record.failure).toContain('CLEANUP_SENTINEL');
},45000);

gate('relocated CLI retains reservation after quiesce-only failure',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'loop-cli-quiesce-failure-'));
 const cli=resolve(base,process.platform==='win32'?'loop.exe':'loop');await cp(binary!,cli);
 const root=await prepareProject(cli,'browser');await addHookOnly(root,'quiesce',"throw Error('intentional cleanup failure');");
 const owner=Bun.spawn([cli,'run',root,'--config','loop.config.ts','--target','web','--instance','failed','--trust-local-config','--json'],{stdin:'ignore',stdout:'pipe',stderr:'pipe'});
 try{
  const launched=await active(root,'web','failed');
  const stop=await run(cli,['stop','failed','--root',root,'--json']);expect(stop.code,stop.stderr).toBe(4);expect(JSON.parse(stop.stdout).diagnostics[0].code).toBe('E_RUNTIME_STOP');
  expect(await owner.exited).not.toBe(0);
  const record=await Bun.file(resolve(launched.path,'launch.json')).json();expect(record.state).toBe('failed');
  expect(await readFile(resolve(root,'.loop/instances/web/failed/active.lock'),'utf8')).toBe(launched.epoch);
  const retry=await run(cli,['stop','failed','--root',root,'--json']);expect(retry.code,retry.stderr).toBe(4);expect(JSON.parse(retry.stdout).diagnostics[0].code).toBe('E_RUNTIME_STOP');
 }finally{if(owner.exitCode===null){owner.kill();await owner.exited;}}
},45000);
