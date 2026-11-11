// Isolated because this replaces the Polyengine imports and worker channel globals.
import {beforeAll,expect,mock,test} from 'bun:test';

if(process.env.LOOP_ISOLATED_COMPONENT_BUDGET!=='1'){
 test.skip('isolated worker decoded-value guards',()=>{});
}else{
 const DOC='loop:document-tool/documents@0.1.0';
 class FakeComponentException extends Error{constructor(readonly payload:unknown){super('component');}}
 let scenario:{kind:'revision';value:unknown}|{kind:'detail';value:string}|{kind:'output';value:string}|{kind:'conflict';value:string}|{kind:'raw-failure';value:unknown}={kind:'revision',value:'0'},messages:any[]=[],resolveReady!:()=>void,resolveFinal!:(value:any)=>void;
 const component=new Uint8Array([1,2,3]),digest=new Bun.CryptoHasher('sha256').update(component).digest('hex'),plan={component:{sha256:digest},worldDigest:'world'};
 mock.module('@polyengine/runtime/shim',()=>({Translator:{async create(){return {translate(){return {plan,adapters:{}};}};}}}));
 mock.module('@polyengine/runtime/embedder',()=>({requiredImports:()=>[{interfaceId:DOC,leaf:'document'}],instantiate:async()=>({exports:{async replaceText(doc:any){if(scenario.kind==='revision')return doc.write(scenario.value,'small');if(scenario.kind==='output')return scenario.value;if(scenario.kind==='conflict')throw new FakeComponentException({kind:'conflict',value:{revision:'0',source:scenario.value}});if(scenario.kind==='raw-failure')throw new FakeComponentException(scenario.value);throw new FakeComponentException({kind:'invalid-source',value:scenario.value});}}})}));
 mock.module('@polyengine/protocol',()=>({ComponentException:FakeComponentException}));
 const channel=globalThis as any;
 channel.postMessage=(message:any)=>{messages.push(message);if(message.type==='ready')resolveReady();else if(message.type==='host')queueMicrotask(()=>channel.onmessage({data:{type:'hostResult',id:message.id,error:{kind:'invalid-source',value:'host rejected'}}}));else if(message.type==='result'||message.type==='fatal')resolveFinal(message);};
 async function call(next:typeof scenario){scenario=next;messages=[];const done=new Promise<any>(resolve=>{resolveFinal=resolve;});channel.onmessage({data:{type:'call',id:1,operation:'replaceText',from:'a',to:'b'}});const timeout=Bun.sleep(2000).then(()=>{throw Error('worker result timeout');});const result=await Promise.race([done,timeout]);return {result,messages:[...messages]};}
 beforeAll(async()=>{const {installPolyengineWorker}=await import('../../src/worker.js');installPolyengineWorker();const ready=new Promise<void>(resolve=>{resolveReady=resolve;});channel.onmessage({data:{type:'init',component,artifact:{sha256:digest,worldDigest:'world',profile:'document'}}});await ready;});
 test('invalid expected revision is rejected before a host message',async()=>{
  const allowed=await call({kind:'revision',value:'a'.repeat(128)});expect(allowed.messages.filter(message=>message.type==='host')).toHaveLength(1);
  const rejected=await call({kind:'revision',value:'a'.repeat(129)});expect(rejected.messages.filter(message=>message.type==='host')).toHaveLength(0);expect(rejected.result.error).toEqual({kind:'invalid-source',value:'Invalid expected revision'});
  const multibyteAllowed=await call({kind:'revision',value:'é'.repeat(64)});expect(multibyteAllowed.messages.filter(message=>message.type==='host')).toHaveLength(1);
  const multibyteRejected=await call({kind:'revision',value:'é'.repeat(65)});expect(multibyteRejected.messages.filter(message=>message.type==='host')).toHaveLength(0);expect(multibyteRejected.result.error.kind).toBe('invalid-source');
  const malformed=await call({kind:'revision',value:42});expect(malformed.messages.filter(message=>message.type==='host')).toHaveLength(0);expect(malformed.result.error.kind).toBe('invalid-source');
 });
 test('decoded result allows bounded metadata overhead like the native host',async()=>{
  const atLimit=await call({kind:'output',value:'x'.repeat(1048832)});expect(atLimit.result.value).toHaveLength(1048832);
  const overLimit=await call({kind:'output',value:'x'.repeat(1048833)});expect(overLimit.result.type).toBe('fatal');
  const wideLimit=await call({kind:'output',value:'é'.repeat(524416)});expect(wideLimit.result.value).toHaveLength(524416);
  const wideOver=await call({kind:'output',value:'é'.repeat(524417)});expect(wideOver.result.type).toBe('fatal');
 });
 test('bounded failure fields do not reject JSON-escaped conflict sources',async()=>{
  const conflict=await call({kind:'conflict',value:'\n'.repeat(530000)});expect(conflict.result.error.kind).toBe('conflict');expect(conflict.result.error.value.source).toHaveLength(530000);
  const extra=await call({kind:'raw-failure',value:{kind:'conflict',value:{revision:'0',source:'ok',extra:'x'.repeat(1048577)}}});expect(extra.result.type).toBe('fatal');expect(extra.messages.filter(message=>message.type==='result')).toHaveLength(0);
 });
 test('oversized decoded error detail is rejected before a second encoding',async()=>{
  const original=TextEncoder.prototype.encode;let largeEncodes=0;
  try{
   TextEncoder.prototype.encode=function(input?:string){if(typeof input==='string'&&input.length>65536)largeEncodes++;return original.call(this,input);};
   const allowed=await call({kind:'detail',value:'a'.repeat(65536)});expect(allowed.result.error.value).toHaveLength(65536);largeEncodes=0;
   const tooLong=await call({kind:'detail',value:'a'.repeat(65537)});expect(tooLong.result.type).toBe('fatal');expect(largeEncodes).toBe(0);
   const wide=await call({kind:'detail',value:'é'.repeat(32769)});expect(wide.result.type).toBe('fatal');expect(largeEncodes).toBe(0);
  }finally{TextEncoder.prototype.encode=original;}
 });
}
