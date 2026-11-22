import { expect, test } from 'bun:test';
import { defineCapability } from '@loop-kit/capabilities';
import { bootstrapHeadless, headless, extractHostConfig, resolveHostPlan, type ResolvedHostPlan } from '../src/index.js';

const cap = defineCapability<{value:number}>({id:'example:service/test',version:'1'});
const hash=(s:string)=>new Bun.CryptoHasher('sha256').update(s).digest('hex');
function plan(): ResolvedHostPlan {
 const kit=headless(); const config={schemaVersion:1 as const,source:{manifest:'./loop.package.json'},targets:[{id:'bot',kit,application:{specifier:'./app.ts',export:'start'},plugins:[{apiVersion:1 as const,identity:{id:'example:plugin/test',version:'1.0.0'},key:'provider',targets:['headless' as const],runtime:[{key:'setup',host:'application',requires:[],provides:[{kind:'provider' as const,host:'application',id:cap.id,version:cap.version}],entry:{specifier:'./provider.ts',export:'setup'},options:{}}]}]}]};
 return resolveHostPlan(extractHostConfig(config),{modules:[{...kit.coordinator,sha256:'a'.repeat(64)},{specifier:'./app.ts',export:'start',sha256:'b'.repeat(64)},{specifier:'./provider.ts',export:'setup',sha256:'c'.repeat(64)}],sourceSnapshotDigest:'d'.repeat(64),configDigest:'e'.repeat(64),lockDigests:[],toolchain:[],provenance:{}},hash);
}
test('headless siblings own registrations and leases independently',async()=>{
 let closed=0;const modules={'./provider.ts':{setup({host}:any){host.provide(cap,{create:()=>({value:1}),dispose(){closed++;}});}},'./app.ts':{async start({scope}:any){await scope.acquire(cap);}}};
 const a=new AbortController(),b=new AbortController();const first=await bootstrapHeadless({plan:plan(),modules,signal:a.signal});const second=await bootstrapHeadless({plan:plan(),modules,signal:b.signal});await first.dispose();await first.dispose();expect(closed).toBe(1);await second.dispose();expect(closed).toBe(2);
});
test('failed start and abort dispose partial owned resources',async()=>{
 let closed=0;const modules={'./provider.ts':{setup({host}:any){host.provide(cap,{create:()=>({value:1}),dispose(){closed++;}});}},'./app.ts':{async start({scope}:any){await scope.acquire(cap);throw Error('failed');}}};
 await expect(bootstrapHeadless({plan:plan(),modules,signal:new AbortController().signal})).rejects.toThrow('failed');expect(closed).toBe(1);
 const controller=new AbortController();const runtime=await bootstrapHeadless({plan:plan(),modules:{...modules,'./app.ts':{async start({scope}:any){await scope.acquire(cap);}}},signal:controller.signal});controller.abort();await runtime.dispose();expect(closed).toBe(2);
});
test('rejects mismatched receipts, unknown kinds and profiles',async()=>{
 const p=plan();await expect(bootstrapHeadless({plan:p,modules:{'./provider.ts':{setup(){}},'./app.ts':{start(){}}},signal:new AbortController().signal})).rejects.toMatchObject({code:'E_REGISTRATION_RECEIPT'});
 await expect(bootstrapHeadless({plan:{...p,profile:{id:'unknown:profile/test',version:'1.0.0'}},modules:{},signal:new AbortController().signal})).rejects.toMatchObject({code:'E_HEADLESS_PROFILE'});
 const kit={...headless(),kind:'unknown'};expect(()=>extractHostConfig({schemaVersion:1,source:{manifest:'x'},targets:[{id:'bot',kit,application:{specifier:'./app.ts',export:'start'}}]} as any)).toThrow('Unsupported');
});
