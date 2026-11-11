import { Translator } from "@polyengine/runtime/shim";
import { instantiate, requiredImports } from "@polyengine/runtime/embedder";
import { validateFrame } from "@loop-kit/ui"; // Disposable resolver reads the checkout's public export; NOT packed-consumer proof.
import { Document, policy, providers, documentCounts } from "./browser.ts";
const UI="loopkit:ui/surfaces@0.1.0";
const WORLD="sha256:8f91fe49f2e999c6c9ff4d89146d7fa2b84eabe5c09a802c32290e3c1cfa99e1";
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
let surfaceCount=0,waiters=0,listeners=0;
class Surface {
 closed=false;revoked=false;granted=true;frame:any;sequence=0;waiter:any;queue:string[]=[];frames:any[]=[];button?:HTMLButtonElement;handler?:()=>void;
 constructor(readonly root:HTMLElement) {surfaceCount++;}
 render(text:string) {if(this.closed||this.revoked||!this.granted)throw Error("surface render denied/revoked");if(text.length>65536)throw Error("frame bound");const frame=validateFrame(JSON.parse(text));assert(frame.revision===(this.frame?this.frame.revision+1:0),"stale frame");this.unlisten();this.frame=frame;this.frames.push(frame);this.root.replaceChildren();if(frame.root.type==="button"){const button=document.createElement("button");button.textContent=frame.root.text;button.setAttribute("aria-label",frame.root.label);button.disabled=!!frame.root.disabled;button.id="guest-button";const handler=()=>this.event({revision:frame.revision,sequence:this.sequence+1,key:frame.root.key,type:"activate"});button.addEventListener("click",handler);listeners++;this.button=button;this.handler=handler;this.root.append(button);}else if(frame.root.type==="text"){const output=document.createElement("output");output.id="guest-output";output.textContent=frame.root.text;this.root.append(output);}else throw Error("fixture renderer only supports button/text");}
 event(event:any) {if(this.closed||this.revoked||!this.granted||!this.frame||event.revision!==this.frame.revision||event.sequence<=this.sequence||event.key!==this.frame.root.key||event.type!=="activate"||this.frame.root.disabled)throw Error("stale/unknown/disabled/disposed event denied");if(JSON.stringify(event).length>1024)throw Error("event bound");this.sequence=event.sequence;const data=JSON.stringify(event);if(this.waiter){const w=this.waiter;this.waiter=undefined;waiters--;w(data)}else{assert(this.queue.length===0,"one pending event bound");this.queue.push(data)}}
 nextEvent() {if(this.closed||this.revoked||!this.granted)return undefined;if(this.queue.length)return this.queue.shift();assert(!this.waiter,"one pending read");waiters++;return new Promise<string|undefined>(r=>this.waiter=r);}
 unlisten(){if(this.button&&this.handler){this.button.removeEventListener("click",this.handler);listeners--;}this.button=undefined;this.handler=undefined;}
 [Symbol.dispose](){if(this.closed)return;this.closed=true;this.unlisten();this.root.replaceChildren();this.queue=[];if(this.waiter){const w=this.waiter;this.waiter=undefined;waiters--;w(undefined)}surfaceCount--;}
}
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const outcome=async(p:Promise<any>)=>{try{return {ok:await p}}catch(e:any){return {error:e.payload??String(e)}}};
(window as any).bootSemantic=async(input:any)=>{
 const bytes=decode(input.component),translator=await Translator.create(decode(input.translator)),translated=translator.translate(bytes);assert(translated.plan.component.sha256===input.sha256&&translated.plan.worldDigest===WORLD,"extension bytes/world mismatch");const leaves=requiredImports(translated.plan),p=providers(leaves.filter(l=>l.interfaceId!==UI));p.imports[UI]={Surface};const make=()=>instantiate({plan:translated.plan,adapters:translated.adapters,componentBytes:bytes},p.imports);
 const instance=await make(),state=policy(),doc=new Document(state),surface=new Surface(document.querySelector("#semantic-root")!);const receipt:any={profile:"SEPARATE document+semantic surface extension, NOT G1",componentSha256:input.sha256,worldDigest:WORLD,tests:[],done:false};(window as any).semanticReceipt=receipt;
 let settled=false;const task=outcome(instance.exports.run(doc,surface)).then(v=>{settled=true;return v});
 await new Promise(r=>setTimeout(r,30));assert(!settled&&waiters===1&&state.revision===0,"guest did not suspend waiting semantic event");receipt.tests.push({name:"await-real-button",suspended:true,pendingEventReads:waiters});
 for(const event of [{revision:9,sequence:1,key:"replace",type:"activate"},{revision:0,sequence:0,key:"replace",type:"activate"},{revision:0,sequence:1,key:"unknown",type:"activate"}]){let denied=false;try{surface.event(event)}catch{denied=true}assert(denied,"invalid event accepted");receipt.tests.push({name:"invalid-stale-duplicate-event-denied",event});}
 surface.frame.root.disabled=true;let disabled=false;try{surface.event({revision:0,sequence:1,key:"replace",type:"activate"})}catch{disabled=true}surface.frame.root.disabled=false;assert(disabled,"disabled event accepted");receipt.tests.push({name:"disabled-event-denied"});
 (window as any).finishSemantic=async()=>{
  const result=await task;assert(result.ok==="revision=1;source=semantic world","semantic document action failed");assert(state.revision===1,"no actual document commit");receipt.tests.push({name:"real-button-component-document-frame",...result,frames:surface.frames,documentEvents:state.events});
  const rendered=document.querySelector("#guest-output")?.textContent;assert(rendered==="semantic world","new guest frame not rendered");receipt.renderedOutput=rendered;
  surface[Symbol.dispose]();doc[Symbol.dispose]();let late=false;try{surface.event({revision:1,sequence:2,key:"result",type:"activate"})}catch{late=true}assert(late,"late event accepted");receipt.tests.push({name:"post-disposal-event-denied"});
  for(const mode of ["close-pending","document-denied","document-revoked","surface-denied"]){const state=policy(mode!=="document-denied"),d=new Document(state),root=document.createElement("section");document.body.append(root);const s=new Surface(root),inst=await make();if(mode==="surface-denied")s.granted=false;const call=outcome(inst.exports.run(d,s));await new Promise(r=>setTimeout(r,20));if(mode==="close-pending")s[Symbol.dispose]();else if(mode!=="surface-denied"){if(mode==="document-revoked")state.revoked=true;s.event({revision:0,sequence:1,key:"replace",type:"activate"})}const out=await call;assert(!!out.error&&state.revision===0,"denied/disposed lane mutated");receipt.tests.push({name:mode,...out,revision:state.revision});s[Symbol.dispose]();d[Symbol.dispose]();root.remove();}
  const counts=documentCounts();assert(counts.live===0&&counts.pending===0&&surfaceCount===0&&waiters===0&&listeners===0,"semantic cleanup leak");receipt.cleanup={...counts,surfaces:surfaceCount,pendingEventReads:waiters,listeners};receipt.deniedRuntimeCalls=p.denied;receipt.done=true;return receipt;
 };
 return {ready:true,componentSha256:input.sha256,worldDigest:WORLD};
};
