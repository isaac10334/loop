// Run in an isolated Bun process: the module mock must not leak to other supervisor tests.
import {test,expect,mock} from 'bun:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';

if(process.env.LOOP_ISOLATED_DEV_TEST!=='1'){
 test.skip('isolated development disposal failure',()=>{});
}else{
 mock.module(resolve('crates/loop-cli/host-tools/development.ts'),()=>({
  browserDevelopment:async()=>({dispose:()=>Promise.reject(Error('DEVELOPMENT_DISPOSAL_SENTINEL'))}),
 }));
 const {launch}=await import('../../../crates/loop-cli/host-tools/supervise');
 test('isolated development disposal failure',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'loop-dev-disposal-')),events:string[]=[],unhandled:unknown[]=[];
  const listener=(reason:unknown)=>{unhandled.push(reason);};process.on('unhandledRejection',listener);
  let running:Awaited<ReturnType<typeof launch>>|undefined;
  try{
   const hooks={prepare(context:any){events.push('prepare');context.resources.defer(()=>events.push('dispose'));},quiesce(){events.push('quiesce');}};
   const ev={root,files:new Map(),plan:{targetId:'web',planId:'test-plan',kind:'browser',kitOptions:{},plugins:[{key:'hooks'}]},hooks:new Map([['hooks',hooks]])} as any;
   running=await launch(ev,{instance:'dev-disposal',epoch:'first',dev:true});
   const endpoint=running.endpoint!,client=crypto.randomUUID();expect((await fetch(endpoint+'/__loop/client',{method:'POST',body:client})).status).toBe(200);
   const stopped=running.stop().catch(error=>error);await Bun.sleep(100);
   expect(unhandled).toEqual([]);expect((running.inspect() as any).state).toBe('stopping');
   expect((await fetch(endpoint+'/__loop/disposed',{method:'POST',body:client})).status).toBe(200);
   const failure=await stopped;expect(failure).toBeInstanceOf(AggregateError);expect(events).toEqual(['prepare','quiesce','dispose']);
   const record=JSON.parse(await readFile(resolve(root,'.loop/instances/web/dev-disposal/first/launch.json'),'utf8'));
   expect(record.state).toBe('failed');expect(record.failure).toContain('DEVELOPMENT_DISPOSAL_SENTINEL');
   expect(await readFile(resolve(root,'.loop/instances/web/dev-disposal/active.lock'),'utf8')).toBe('first');expect(unhandled).toEqual([]);
  }finally{process.off('unhandledRejection',listener);if(running)await running.stop().catch(()=>{});await rm(root,{recursive:true,force:true});}
 },15000);
}
