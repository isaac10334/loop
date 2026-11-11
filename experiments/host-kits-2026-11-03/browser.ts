// DISPOSABLE ONLY: installed PUBLIC export targets; never copy these local paths to a package.
import { Translator } from "@polyengine/runtime/shim";
import { instantiate, requiredImports } from "@polyengine/runtime/embedder";
import { ComponentException } from "@polyengine/protocol";
const WORLD="sha256:9d978bf670230e8d972ba5c359a5be6227b9b313c037e298318422eeadc72e0c";
const DOC="loop:document-tool/documents@0.1.0";
const WASI=new Set(["wasi:io/poll@0.2.9","wasi:io/error@0.2.9","wasi:io/streams@0.2.9","wasi:cli/terminal-input@0.2.9","wasi:cli/terminal-output@0.2.9","wasi:cli/exit@0.2.9","wasi:cli/stdin@0.2.9","wasi:cli/stdout@0.2.9","wasi:cli/stderr@0.2.9","wasi:clocks/monotonic-clock@0.2.9","wasi:cli/environment@0.2.9","wasi:cli/terminal-stdin@0.2.9","wasi:cli/terminal-stdout@0.2.9","wasi:cli/terminal-stderr@0.2.9"]);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
const error=(kind:string,value?:unknown)=>new ComponentException(value===undefined?{kind}:{kind,value});
let live=0,pending=0;
export const documentCounts=()=>({live,pending});
export class Document {
  #policy:any;
  constructor(policy:any) { this.#policy=policy;live++; }
  check(write=false) { const p=this.#policy;if(p.closed||p.revoked)throw error("revoked");if(p.cancelled)throw error("cancelled");if(p.principal!=="fixture-author"||(write&&!p.write))throw error("denied");return p; }
  async read() {const p=this.#policy;p.events.push("read-enter");pending++;await sleep(35);pending--;p.events.push("read-resume");this.check();return {revision:String(p.revision),source:p.source};}
  async write(expectedRevision:string,source:string) { const p=this.#policy;p.events.push("write-enter");pending++;await sleep(35);pending--;p.events.push("write-resume");this.check(true);if(new TextEncoder().encode(source).length>65536)throw error("invalid-source","64KiB limit");if(String(p.revision)!==expectedRevision)throw error("conflict",{revision:String(p.revision),source:p.source});p.revision++;p.source=source;p.events.push("commit");return {revision:String(p.revision),source}; }
  [Symbol.dispose]() {if(!this.#policy.closed){this.#policy.closed=true;live--;}}
}
export const policy=(write=true)=>({revision:0,source:"hello world",principal:"fixture-author",write,revoked:false,cancelled:false,closed:false,events:[] as string[]});
export function providers(leaves:any[]) {
 const imports:any={[DOC]:{Document}};const denied:any[]=[];
 for(const leaf of leaves){if(leaf.interfaceId===DOC)continue;if(!WASI.has(leaf.interfaceId))throw Error("profile denied "+leaf.interfaceId);const iface=imports[leaf.interfaceId]??={};const deny=()=>{denied.push(leaf.interfaceId+"."+leaf.leaf);throw Error("unused runtime import denied")};if(leaf.kind==="resource")iface[leaf.jsName]=class {};else if(leaf.jsClass){const cls=iface[leaf.jsClass]??=class {};cls.prototype[leaf.jsName]=deny;}else iface[leaf.jsName]=deny;}
 return {imports,denied};
}
const decode=(b64:string)=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
(window as any).bootProbe=async (input:any)=>{
 const started=performance.now(); const bytes=decode(input.component),translatorBytes=decode(input.translator);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),v=>v.toString(16).padStart(2,"0")).join("");assert(hash===input.sha256,"source artifact bytes mismatch");
 const translator=await Translator.create(translatorBytes), translated=translator.translate(bytes);assert(translated.plan.worldDigest===WORLD,"world profile mismatch");
 const leaves=requiredImports(translated.plan), p=providers(leaves);
 const make=()=>instantiate({plan:translated.plan,adapters:translated.adapters,componentBytes:bytes},p.imports);
 const instantiateStart=performance.now(), instance=await make();
 const receipt:any={browser:navigator.userAgent,componentSha256:hash,worldDigest:translated.plan.worldDigest,jspi:{Suspending:typeof WebAssembly.Suspending,promising:typeof WebAssembly.promising},setupMs:performance.now()-started,instantiateMs:performance.now()-instantiateStart,tests:[],deniedRuntimeCalls:p.denied};
 const result=async(fn:()=>Promise<any>)=>{try{return {ok:await fn()}}catch(e:any){return {error:e.payload??{message:String(e),stack:e.stack}}}};
 const close=(d:Document)=>d[Symbol.dispose]();
 (window as any).receipt=receipt;
 document.querySelector("#run")!.addEventListener("click",async()=>{
  try{const grant=policy(),d=new Document(grant),value=(document.querySelector("#replacement") as HTMLInputElement).value;let settled=false;const t=performance.now();const call=instance.exports.replaceText(d,"hello",value).finally(()=>settled=true);await sleep(15);assert(!settled,"guest did not genuinely suspend");assert(grant.events[0]==="read-enter","guest did not enter actual read import");const output=await call;assert(output===`${input.expectedPrefix??""}revision=1;source=${value} world`,"fresh guest result mismatch");assert(performance.now()-t>=60,"missing delayed read/write");receipt.tests.push({name:"real-browser-input-granted-async",output,callMs:performance.now()-t,events:[...grant.events]});(document.querySelector("#output") as HTMLElement).textContent=output;grant.revoked=true;const revoked=await result(()=>instance.exports.replaceText(d,"world","forbidden"));assert(revoked.error?.kind==="revoked"&&grant.revision===1,"revoked mutation");receipt.tests.push({name:"retained-resource-revoked",...revoked});close(d);
   const viewer=policy(false),vd=new Document(viewer);const denied=await result(()=>instance.exports.replaceText(vd,"hello","viewer"));assert(denied.error?.kind==="denied"&&viewer.revision===0,"viewer mutation");receipt.tests.push({name:"viewer-denied",...denied});close(vd);
   const wrong=policy();wrong.principal="other";const wd=new Document(wrong);const deniedPrincipal=await result(()=>instance.exports.replaceText(wd,"hello","wrong"));assert(deniedPrincipal.error?.kind==="denied"&&wrong.revision===0,"wrong principal mutation");receipt.tests.push({name:"wrong-principal-denied",...deniedPrincipal});close(wd);
   // A host facade object forged without the private policy must fail, not mint authority.
   const forgedInstance=await make(),forged=await result(()=>forgedInstance.exports.replaceText(Object.create(Document.prototype),"hello","forged"));assert(!!forged.error,"forged resource succeeded");receipt.tests.push({name:"forged-resource-trap",...forged});
   const race=policy(),rd=new Document(race),other=await make();const drafts=["A","B"];const wins=await Promise.all([result(()=>instance.exports.replaceText(rd,"hello",drafts[0])),result(()=>other.exports.replaceText(rd,"hello",drafts[1]))]);assert(wins.filter(x=>x.ok).length===1&&wins.filter(x=>x.error?.kind==="conflict").length===1&&race.revision===1,"CAS not one winner");receipt.tests.push({name:"two-instance-cas-race",results:wins,draftsUnchanged:drafts,events:[...race.events]});close(rd);
   for(const [phase,delay,cancel] of [["before-read",10,false],["during-write",50,false],["cancel-before-commit",50,true],["after-commit",100,false]] as const){const state=policy(),d=new Document(state);const call=result(()=>instance.exports.replaceText(d,"hello","race"));const timer=sleep(delay).then(()=>{if(cancel)state.cancelled=true;else state.revoked=true});const [out]=await Promise.all([call,timer]);if(delay<70){assert(out.error?.kind===(cancel?"cancelled":"revoked")&&state.revision===0,"cancel/revoke committed")}else{assert(!!out.ok&&state.revision===1,"committed outcome lost")};receipt.tests.push({name:phase,...out,revision:state.revision,events:[...state.events]});close(d);}
   assert(live===0&&pending===0,"resource/task leak");assert(p.denied.length===0,"unexpected WASI runtime call");receipt.cleanup={liveHostDocuments:live,pendingHostCalls:pending,borrowedOnly:true,guestOwnedDrop:"not exercised",instanceDispose:"no public disposal API; isolated browser process closed by supervisor"};receipt.done=true;
  }catch(e:any){receipt.failure={message:String(e),stack:e.stack};receipt.done=true;}
 });
 return {componentSha256:hash,worldDigest:receipt.worldDigest,ready:true};
};
