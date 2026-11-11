/** Independent source-backed trust/lifecycle regression tests. Packed/browser/native receipts remain separate. */
import { describe, test, expect } from 'bun:test';
import { createDocumentOwner, DocumentOperationError, type DocumentFailure } from '../../packages/component-polyengine/src/documents';
import { createPolyengineSession } from '../../packages/component-polyengine/src/session';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const signal=()=>new AbortController().signal;
const owner=(source='initial')=>createDocumentOwner({source,authorize:()=>true});
async function denied(operation:Promise<unknown>,kind:DocumentFailure['kind']){try{await operation;throw Error('Operation unexpectedly succeeded');}catch(error){expect(error).toBeInstanceOf(DocumentOperationError);expect((error as DocumentOperationError).failure.kind).toBe(kind);}}
describe('HK09 nominal document grants recheck authority after await',()=>{
 test('plain diagnostic object is not a grant',async()=>{const document=owner();await denied(document.read({principal:'guest',read:true} as any,signal()),'denied');});
 test('ticket from another owner is denied',async()=>{const a=owner(),b=owner();await denied(b.read(a.issue({principal:'guest',read:true,write:true}),signal()),'denied');});
 test('extra owner field cannot substitute issuer identity',async()=>{const a=owner('attacker'),victim=owner('victim secret');let forged;try{forged=a.issue({principal:'guest',read:true,write:true,owner:victim} as any);}catch{return;}await denied(victim.read(forged,signal()),'denied');});
 test('rights cannot expand at a delayed write commit',async()=>{
  let release!:()=>void,allowed=true;
  const gate=new Promise<void>(r=>release=r),document=createDocumentOwner({source:'initial',authorize:()=>allowed,beforeOperation:async()=>gate});
  const grant=document.issue({principal:'guest',read:true,write:true}),write=document.write(grant,'0','forbidden',signal());
  allowed=false;release();await denied(write,'denied');expect(document.snapshot).toEqual({revision:'0',source:'initial'});
 });
 for(const change of ['revoke','generation','abort','dispose'] as const) test(`${change} during delayed write prevents commit`,async()=>{
  let release!:()=>void;const gate=new Promise<void>(r=>release=r),controller=new AbortController();
  const document=createDocumentOwner({source:'initial',authorize:()=>true,beforeOperation:async()=>gate}),grant=document.issue({principal:'guest',read:true,write:true});
  const write=document.write(grant,'0','forbidden',controller.signal);
  if(change==='revoke')document.revoke(grant);else if(change==='generation')document.advanceGeneration();else if(change==='abort')controller.abort();else document.dispose();
  release();await denied(write,change==='abort'?'cancelled':'revoked');expect(document.snapshot).toEqual({revision:'0',source:'initial'});
 });
 test('two concurrent CAS writes have exactly one commit',async()=>{
  const document=owner(),grant=document.issue({principal:'guest',read:true,write:true});
  const results=await Promise.allSettled([document.write(grant,'0','a',signal()),document.write(grant,'0','b',signal())]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(document.snapshot.revision).toBe('1');
  const failure=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(failure.reason.failure.kind).toBe('conflict');
 });
});
test('worker supervisor repeats the same failed disposal completion (controlled Worker unit)',async()=>{
 const Original=globalThis.Worker;let terminations=0,cleanups=0;
 class ControlledWorker {
  onmessage?: (event: {data: unknown}) => void;
  onerror?: unknown;
  postMessage(message: any){if(message.type==='init')queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));}
  terminate(){terminations++;}
 }
 globalThis.Worker=ControlledWorker as any;
 try{
  const document=owner(),grant=document.issue({principal:'guest',read:true,write:true});
  const session=await createPolyengineSession({workerUrl:'controlled-unit-only',componentBytes:new Uint8Array([0]),translation:{plan:{},adapters:new Map()} as any,artifact:{sha256:'a'.repeat(64),worldDigest:'sha256:'+'b'.repeat(64),translationSha256:'c'.repeat(64),profile:'semantic'},document:{owner:document,grant},surface:{render(){},async nextEvent(){return undefined},dispose(){cleanups++;throw Error('Expected cleanup fault');}}});
  const first=session.dispose(),second=session.dispose();expect(first).toBe(second);await expect(first).rejects.toThrow('Component cleanup failed');expect(terminations).toBe(1);expect(cleanups).toBe(1);
 }finally{globalThis.Worker=Original;}
});
test('native plain-data encoder rejects callback-bearing array prototypes in Node',async()=>{
 const stage=await mkdtemp(join(tmpdir(),'loop-hk09-node-native-'));
 const result=await Bun.build({entrypoints:[resolve(import.meta.dir,'../../packages/host-native/src/index.ts')],target:'node',outdir:stage,naming:'native.mjs'});
 expect(result.success).toBe(true);
 await writeFile(join(stage,'consumer.mjs'),`import {encodeNativeFrame} from './native.mjs';let called=0;const value=[];Object.setPrototypeOf(value,{toJSON(){called++;return {effect:true}}});let rejected=false;try{encodeNativeFrame(value)}catch{rejected=true}if(!rejected||called)throw Error('Native encoder accepted callback-bearing array prototype: '+JSON.stringify({rejected,called}));console.log('Node native plain-data guard passed');`);
 const child=Bun.spawn(['node','consumer.mjs'],{cwd:stage,stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 if(code)throw Error(`Node public-source regression failed (${stage})\n${stdout}\n${stderr}`);
 expect(stdout).toContain('guard passed');
});
