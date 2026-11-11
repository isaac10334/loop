// Isolated process: changes cwd to run a no-window fake native backend.
import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {startNativeRuntime,NativeStartupCleanupError} from '../../../crates/loop-cli/host-tools/native';
import {connectNativeSurface} from '@loop-kit/host-native';
import {h} from '@loop-kit/ui';

if(process.env.LOOP_ISOLATED_NATIVE_TEST!=='1'){
 test.skip('native partial-start process ownership',()=>{});
}else{
 function alive(pid:number){try{process.kill(pid,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error;}}
 const plan={kind:'desktop',profile:{id:'loop:profile/native-ts',version:'0.1.0'},kitOptions:{},coordinator:{specifier:'unit',export:'connect'},plugins:[]} as any;
 test('native partial-start process ownership',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-startup-')),previous=process.cwd();let pid=0;
  try{
   await writeFile(resolve(root,'native-surface'),"await Bun.write('backend.pid',String(process.pid));await new Promise(resolve=>setTimeout(resolve,4000));\n");process.chdir(root);
   const signal=new AbortController().signal,marker=resolve(root,'backend.pid');
   const connect=()=>{const deadline=Date.now()+2000;while(!existsSync(marker)&&Date.now()<deadline)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);if(!existsSync(marker))throw Error('Fake backend did not start');pid=Number(readFileSync(marker,'utf8'));if(!alive(pid))throw Error('Fake backend exited before connector');throw Error('CONNECT_SENTINEL');};
   const result=await startNativeRuntime({plan,modules:{unit:{connect}},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal,backend:process.execPath}).then(()=>null,error=>error);
   expect(String(result)).toContain('CONNECT_SENTINEL');expect(pid).toBeGreaterThan(0);expect(alive(pid)).toBe(false);
  }finally{process.chdir(previous);if(pid&&alive(pid))await Bun.sleep(4200);await rm(root,{recursive:true,force:true});}
 },12000);
 test('public native bridge renders and closes through a real headless fake backend',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-bridge-')),previous=process.cwd(),events:string[]=[];let pid=0,runtime:Awaited<ReturnType<typeof startNativeRuntime>>|undefined;
  try{
   const backend=`setTimeout(()=>process.exit(1),15000).unref();const epoch=process.argv[process.argv.indexOf('--epoch')+1];
const send=async value=>{const body=Buffer.from(JSON.stringify(value)),frame=Buffer.alloc(4+body.length);frame.writeUInt32LE(body.length);body.copy(frame,4);await new Promise((resolve,reject)=>process.stdout.write(frame,error=>error?reject(error):resolve()));};
await Bun.write('backend.pid',String(process.pid));await send({type:'ready',epoch,instanceId:'fake'});let pending=Buffer.alloc(0);
for await(const chunk of Bun.stdin.stream()){pending=Buffer.concat([pending,Buffer.from(chunk)]);while(pending.length>=4){const length=pending.readUInt32LE();if(pending.length<length+4)break;const message=JSON.parse(pending.subarray(4,length+4));pending=pending.subarray(length+4);if(message.type==='render'){await Bun.write('render.json',JSON.stringify(message));await send({type:'event',epoch,event:{revision:0,sequence:1,key:'replace',type:'activate'}});}if(message.type==='close'){await Bun.write('close.json',JSON.stringify(message));await send({type:'closed',epoch,pendingEventReads:0});process.exit(0);}}}`;
   await writeFile(resolve(root,'native-surface'),backend);process.chdir(root);
   const app={async start({scope,surface}:any){scope.defer(()=>events.push('scope-disposed'));surface.render({revision:0,root:h('button',{key:'replace',label:'Replace',text:'Replace'})});const event=await surface.nextEvent();events.push('event:'+event?.key);}};
   runtime=await startNativeRuntime({plan:{...plan,application:{specifier:'app',export:'start'}},modules:{unit:{connect:connectNativeSurface},app},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal:new AbortController().signal,backend:process.execPath});
   pid=Number(readFileSync(resolve(root,'backend.pid'),'utf8'));expect(alive(pid)).toBe(true);
   const renderPath=resolve(root,'render.json'),deadline=Date.now()+3000;while(!existsSync(renderPath)&&Date.now()<deadline)await Bun.sleep(20);
   expect(existsSync(renderPath)).toBe(true);const rendered=JSON.parse(readFileSync(renderPath,'utf8'));expect(rendered.type).toBe('render');expect(rendered.frame.root.label).toBe('Replace');expect(events).toEqual(['event:replace']);
   await runtime.dispose();expect(events).toEqual(['event:replace','scope-disposed']);const close=JSON.parse(readFileSync(resolve(root,'close.json'),'utf8'));expect(close).toEqual({type:'close',epoch:'first'});expect(alive(pid)).toBe(false);
  }finally{if(runtime)await runtime.dispose().catch(()=>{});process.chdir(previous);if(pid&&alive(pid))await Bun.sleep(1000);await rm(root,{recursive:true,force:true});}
 },12000);
 test('synchronous disposal failure is cached and does not reenter cleanup',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-dispose-')),original=Bun.spawn,controller=new AbortController();let calls=0;
  try{
   (Bun as any).spawn=()=>({stdin:{end(){},write(){},flush(){}},kill(){},exited:new Promise(()=>{}),stdout:new ReadableStream({})});
   const connect=()=>({surface:{},ready:Promise.resolve(),closed:new Promise(()=>{}),dispose(){calls++;controller.abort();throw Error('DISPOSE_SENTINEL');}});
   const runtime=await startNativeRuntime({plan:{...plan,application:{specifier:'app',export:'start'}},modules:{unit:{connect},app:{start(){}}},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal:controller.signal,backend:'fake'});
   const first=runtime.dispose(),second=runtime.dispose();expect(first).toBe(second);await expect(first).rejects.toThrow('Native runtime cleanup failed');expect(calls).toBe(1);
  }finally{(Bun as any).spawn=original;await rm(root,{recursive:true,force:true});}
 });
 test('reader failure is handled and duplicate closure signals notify once',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-reader-')),original=Bun.spawn,unhandled:unknown[]=[];let controller!:ReadableStreamDefaultController<Uint8Array>,resolveClosed!:()=>void,notifications=0;
  const listener=(reason:unknown)=>{unhandled.push(reason);};process.on('unhandledRejection',listener);
  try{
   const stdout=new ReadableStream<Uint8Array>({start(value){controller=value;}}),closed=new Promise<void>(resolve=>{resolveClosed=resolve;});
   (Bun as any).spawn=()=>({stdin:{end(){},write(){},flush(){}},kill(){},exited:Promise.resolve(0),exitCode:0,stdout});
   const connect=({transport}:any)=>({surface:{},ready:Promise.resolve(),closed,dispose(){return transport.close();}});
   const runtime=await startNativeRuntime({plan:{...plan,application:{specifier:'app',export:'start'}},modules:{unit:{connect},app:{start(){}}},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal:new AbortController().signal,backend:'fake',onClosed(){notifications++;}});
   controller.error(Error('READER_SENTINEL'));resolveClosed();await Bun.sleep(20);expect(notifications).toBe(1);expect(unhandled).toEqual([]);
   let failure:unknown;try{await runtime.dispose();}catch(error){failure=error;}
   expect(failure).toBeInstanceOf(AggregateError);expect((failure as AggregateError).errors.map(String).join(';')).toContain('READER_SENTINEL');
  }finally{process.off('unhandledRejection',listener);(Bun as any).spawn=original;await rm(root,{recursive:true,force:true});}
 });
 test('failed child termination is bounded and reports incomplete cleanup',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-kill-failure-')),original=Bun.spawn;let kills=0,cancels=0;
  try{
   (Bun as any).spawn=()=>({stdin:{end(){throw Error('STDIN_END_SENTINEL');}},kill(){kills++;throw Error('KILL_SENTINEL');},exited:new Promise(()=>{}),stdout:{async cancel(){cancels++;}}});
   const connect=()=>{throw Error('CONNECT_SENTINEL');},start=Date.now();
   const result=await startNativeRuntime({plan,modules:{unit:{connect}},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal:new AbortController().signal,backend:'fake'}).then(()=>null,error=>error);
   expect(result).toBeInstanceOf(NativeStartupCleanupError);const messages=(result as AggregateError).errors.map(String).join(';');
   expect(messages).toContain('CONNECT_SENTINEL');expect(messages).toContain('STDIN_END_SENTINEL');expect(messages).toContain('KILL_SENTINEL');expect(messages).toContain('cleanup deadline');
   expect(kills).toBe(1);expect(cancels).toBe(1);expect(Date.now()-start).toBeLessThan(8000);
  }finally{(Bun as any).spawn=original;await rm(root,{recursive:true,force:true});}
 },12000);
 test('abort joins an in-flight contribution and fences application startup',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-contribution-abort-')),original=Bun.spawn,controller=new AbortController(),events:string[]=[];let enter!:()=>void,release!:()=>void,started=false,disposed=0,settled=false;
  const entered=new Promise<void>(resolve=>{enter=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
  try{
   (Bun as any).spawn=()=>({stdin:{end(){},write(){},flush(){}},kill(){},exited:new Promise(()=>{}),stdout:new ReadableStream({})});
   const connect=()=>({surface:{},ready:Promise.resolve(),closed:new Promise(()=>{}),dispose(){disposed++;return Promise.resolve();}});
   const contribution={key:'held',host:'application',requires:[],provides:[],options:{},entry:{specifier:'provider',export:'setup'}};
   const starting=startNativeRuntime({plan:{...plan,plugins:[{contributions:[contribution]}],application:{specifier:'app',export:'start'}},modules:{unit:{connect},provider:{async setup({scope}:any){scope.defer(()=>events.push('scope-disposed'));enter();await gate;events.push('setup-finished');}},app:{start(){started=true;}}},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal:controller.signal,backend:'fake'}).then(()=>null,error=>error).finally(()=>{settled=true;});
   await entered;controller.abort();await Bun.sleep(20);expect(settled).toBe(false);expect(events).toEqual([]);release();const result=await starting;
   expect(String(result)).toContain('Native startup cancelled');expect(started).toBe(false);expect(disposed).toBe(1);expect(events).toEqual(['setup-finished','scope-disposed']);
  }finally{release();(Bun as any).spawn=original;await rm(root,{recursive:true,force:true});}
 });
 test('abort during coordinator setup does not wait on readiness',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-abort-during-')),previous=process.cwd(),controller=new AbortController();let disposeCalled=false;
  try{
   await writeFile(resolve(root,'native-surface'),"const timeout=setTimeout(()=>process.exit(0),3000);for await(const _ of Bun.stdin.stream()){}clearTimeout(timeout);\n");process.chdir(root);
   const connect=({transport}:any)=>{controller.abort();return {surface:{},ready:new Promise(()=>{}),closed:new Promise(()=>{}),dispose(){disposeCalled=true;return transport.close();}};};
   const started=startNativeRuntime({plan,modules:{unit:{connect}},root,profileDir:resolve(root,'profile'),instanceId:'test',epoch:'first',signal:controller.signal,backend:process.execPath}).then(()=>null,error=>error);
   const result=await Promise.race([started,Bun.sleep(2500).then(()=>Error('readiness timeout'))]);expect(String(result)).toContain('Native startup cancelled');expect(disposeCalled).toBe(true);
  }finally{process.chdir(previous);await rm(root,{recursive:true,force:true});}
 },12000);
 test('already-aborted native launch does not spawn or create profile parent',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-native-aborted-')),controller=new AbortController();controller.abort();let called=false;
  try{
   await expect(startNativeRuntime({plan,modules:{unit:{connect(){called=true;throw Error('unexpected');}}},root,profileDir:resolve(root,'profiles','unique'),instanceId:'test',epoch:'first',signal:controller.signal,backend:resolve(root,'missing.exe')})).rejects.toThrow('Native startup cancelled');
   expect(called).toBe(false);expect(existsSync(resolve(root,'profiles'))).toBe(false);
  }finally{await rm(root,{recursive:true,force:true});}
 });
}
