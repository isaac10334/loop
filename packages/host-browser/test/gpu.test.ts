import { describe, expect, test } from 'bun:test';
import { createGpuSession } from '../src/index.js';

function deferred<T>() { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>resolve=r); return {promise,resolve}; }
function fixture() {
 const lost=deferred<{message:string}>(); let destroyed=0, unconfigured=0, buffers=0;
 const device={lost:lost.promise,destroy(){destroyed++;}};
 const adapter={requestDevice:async()=>device};
 const gpu={requestAdapter:async()=>adapter};
 const context={unconfigure(){unconfigured++;}};
 return {gpu,device,adapter,lost,context,buffer:()=>({destroy(){buffers++;}}),counts:()=>[destroyed,unconfigured,buffers]};
}
describe('injected GPU session',()=>{
 test('missing GPU and missing adapter fail',async()=>{
  await expect(createGpuSession({})).rejects.toThrow('WebGPU unavailable');
  await expect(createGpuSession({gpu:{requestAdapter:async()=>null}})).rejects.toThrow('No WebGPU adapter');
 });
 test('device acquisition failure and adapter cancellation',async()=>{
  await expect(createGpuSession({gpu:{requestAdapter:async()=>({requestDevice:async()=>{throw Error('device');}})}})).rejects.toThrow('device');
  const pending=deferred<ReturnType<typeof fixture>['adapter'] | null>(), abort=new AbortController();
  const start=createGpuSession({gpu:{requestAdapter:()=>pending.promise},signal:abort.signal});
  abort.abort();await expect(start).rejects.toBeDefined();pending.resolve(null);
 });
 test('partial initialization unwinds and siblings remain independent',async()=>{
  const a=fixture(), b=fixture(); const one=await createGpuSession({gpu:a.gpu}), two=await createGpuSession({gpu:b.gpu});
  one.trackBuffer(a.buffer());
  expect(()=>one.configure(a.context,()=>{throw Error('configure');})).toThrow('configure');
  one.dispose();one.dispose();expect(a.counts()).toEqual([1,1,1]);expect(two.active).toBe(true);expect(b.counts()).toEqual([0,0,0]);two.dispose();
 });
 test('abort while device pending rejects and destroys late device',async()=>{
  const f=fixture(), pending=deferred<typeof f.device>(), abort=new AbortController();
  const start=createGpuSession({gpu:{requestAdapter:async()=>({requestDevice:()=>pending.promise})},signal:abort.signal});
  await Promise.resolve(); await Promise.resolve(); abort.abort(); await expect(start).rejects.toBeDefined();
  pending.resolve(f.device); await Promise.resolve();await Promise.resolve();expect(f.counts()[0]).toBe(1);
 });
 test('loss cleans once and notifies; later disposal does nothing',async()=>{
  const f=fixture();let notices=0;const session=await createGpuSession({gpu:f.gpu,onLost:()=>notices++});
  session.trackBuffer(f.buffer());session.configure(f.context,()=>{});f.lost.resolve({message:'lost'});
  await Promise.resolve();await Promise.resolve();expect(session.active).toBe(false);expect(notices).toBe(1);session.dispose();expect(f.counts()).toEqual([1,1,1]);
 });
 test('cleanup attempts every resource on error',async()=>{
  const f=fixture();const session=await createGpuSession({gpu:f.gpu});session.trackBuffer({destroy(){throw Error('buffer');}});session.trackBuffer(f.buffer());session.configure(f.context,()=>{});
  expect(()=>session.dispose()).toThrow('WebGPU cleanup failed');expect(f.counts()).toEqual([1,1,1]);session.dispose();
 });
});
