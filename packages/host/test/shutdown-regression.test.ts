import { test, expect } from 'bun:test';
import { createHost } from '../src/index.js';
import { defineCapability } from '@loop-kit/capabilities';

test('registration snapshots distinguish remove and same-key replacement without authority', async () => {
 const host=createHost();
 const cap=defineCapability<{value:number}>({id:'test:receipt/generation',version:'1'});
 const first=host.provide(cap,{create:()=>({value:1})});
 const original=host.inspect().providers[0]!.registrationId;
 expect(original).toBeString();
 await first.unregister();
 host.provide(cap,{create:()=>({value:2})});
 expect(host.inspect().providers[0]!.registrationId).not.toBe(original);
 await host.dispose();
});

test('host disposal aborts registration before joining task awaiting parent acquisition', async () => {
 const host=createHost(), scope=host.scope();
 const cap=defineCapability<{value:number}>({id:'test:shutdown/pending',version:'1'});
 let entered!:()=>void;
 const activating=new Promise<void>(resolve=>{entered=resolve;});
 const registration=host.provide(cap,{
  activate({signal}) { entered(); return new Promise<void>((resolve)=>{if(signal.aborted)resolve();else signal.addEventListener('abort',()=>resolve(),{once:true});}); },
  create:()=>({value:1}),
 });
 const task=scope.task(async()=>{await scope.acquire(cap);});
 void task.result.catch(()=>{});
 scope.defer(()=>registration.unregister());
 await activating;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {
  await Promise.race([host.dispose(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('shutdown deadlocked')),1000);})]);
 } finally {clearTimeout(timer);}
 expect(host.inspect().scopes).toHaveLength(0);
 expect(host.inspect().providers).toHaveLength(0);
});
