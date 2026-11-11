import {test,expect} from 'bun:test';
import {closeNativeProcess} from '../../crates/loop-cli/host-tools/native-process';
const never=()=>new Promise<never>(()=>{});
test('native process close waits for graceful exit and reader',async()=>{
 let resolveExit!:(code:number)=>void,kills=0;const exited=new Promise<number>(resolve=>{resolveExit=resolve;});
 const child={stdin:{end(){resolveExit(0);}},kill(){kills++;},exited,exitCode:0};
 await closeNativeProcess(child,Promise.resolve(),20);expect(kills).toBe(0);
});
test('native process close bounds failed termination and preserves both errors',async()=>{
 let kills=0;const child={stdin:{end(){throw Error('END_SENTINEL');}},kill(){kills++;throw Error('KILL_SENTINEL');},exited:never(),exitCode:null};
 const started=Date.now();let failure:unknown;try{await closeNativeProcess(child,never(),20);}catch(error){failure=error;}
 expect(failure).toBeInstanceOf(AggregateError);const errors=(failure as AggregateError).errors;expect(errors.map(String).join(';')).toContain('END_SENTINEL');expect(errors.map(String).join(';')).toContain('KILL_SENTINEL');
 expect(errors.some((error:any)=>error.code==='E_RUNTIME_FORCED_STOP')).toBe(true);expect(kills).toBe(1);expect(Date.now()-started).toBeLessThan(1000);
});
test('native process close reports a forced exit and a stuck stdout reader',async()=>{
 let killed=0,resolveExit!:(code:number)=>void;const exited=new Promise<number>(resolve=>{resolveExit=resolve;});
 const child={stdin:{end(){}},kill(){killed++;resolveExit(1);},exited,exitCode:null};
 let failure:unknown;try{await closeNativeProcess(child,never(),20);}catch(error){failure=error;}
 expect(failure).toBeInstanceOf(AggregateError);const codes=(failure as AggregateError).errors.map((error:any)=>error.code);
 expect(codes).toContain('E_RUNTIME_FORCED_STOP');expect(codes).toContain('E_RUNTIME_PIPE_TIMEOUT');expect(killed).toBe(1);
});
test('native process close reports forced termination of a real headless child',async()=>{
 const child=Bun.spawn([process.execPath,'-e','setTimeout(()=>process.exit(0),4000)'],{stdin:'pipe',stdout:'pipe',stderr:'ignore'});
 const reader=(async()=>{for await(const _ of child.stdout){/* drain */}})();let exited=false;void child.exited.then(()=>{exited=true;});
 try{await expect(closeNativeProcess(child,reader,150)).rejects.toMatchObject({code:'E_RUNTIME_FORCED_STOP'});const joined=await Promise.race([child.exited.then(()=>true),Bun.sleep(2000).then(()=>false)]);expect(joined).toBe(true);}
 finally{if(!exited)child.kill();await child.exited;}
},10000);
test('native process close reports an abnormal unforced exit',async()=>{
 const child={stdin:{end(){}},kill(){throw Error('should not kill');},exited:Promise.resolve(3),exitCode:3};
 await expect(closeNativeProcess(child,Promise.resolve(),20)).rejects.toMatchObject({code:'E_RUNTIME_EXIT'});
});
