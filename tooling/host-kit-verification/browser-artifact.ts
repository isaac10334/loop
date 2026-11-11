/** Verify already-built browser outputs by bytes. No server, browser, source rebuild, or checkout source imports. */
import { resolve, join } from 'node:path';
const directory=resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('Usage: bun tooling/host-kit-verification/browser-artifact.ts <artifact-dir> [relocated-dir]');
const relocated=resolve(process.argv[3]??directory+'-relocated');
const hash=(bytes:Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const files=[];
const receiptFile=Bun.file(join(directory,'build-receipt.json'));
const declared=await receiptFile.exists()?(await receiptFile.json()).inventory as {path:string;bytes:number;sha256:string}[]:[];
for(const entry of declared)if(!/^[a-z][a-z0-9.-]*$/.test(entry.path))throw Error('Nonportable artifact inventory path: '+entry.path);
for(const name of new Set(['index.html','app.js','worker.js','components.json',...declared.map(entry=>entry.path)])){ 
 const a=await Bun.file(join(directory,name)).bytes(),b=await Bun.file(join(relocated,name)).bytes();
 const sha256=hash(a);if(sha256!==hash(b))throw Error(`Relocated output differs: ${name}`);
 const recorded=declared.find(entry=>entry.path===name);if(recorded&&(recorded.sha256!==sha256||recorded.bytes!==a.byteLength))throw Error(`Build inventory differs from emitted bytes: ${name}`);
 if(name.endsWith('.js')){
  const text=new TextDecoder().decode(a);
  for(const pattern of [/\bBun\s*\./,/from\s*['"]node:/,/@loop-kit\/host-native/,/@polyengine\/translator/,/[a-z]:[\\/]Users[\\/]/i,/__stationLocalLinkProof/,/\b(?:pairingSecret|pairingToken|devPairingToken)\s*[:=]/])
   if(pattern.test(text))throw Error(`Nonportable/dev-only input in static output ${name}: ${pattern}`);
 }
 files.push({path:name,bytes:a.byteLength,sha256});
}
const artifacts=await Bun.file(join(directory,'components.json')).json();
const components=[];
for(const [name,raw] of Object.entries(artifacts)){
 const data=raw as any,bytes=new Uint8Array(Buffer.from(data.bytes,'base64')),sha256=hash(bytes);
 if(sha256!==data.artifact.sha256||data.translation.plan.component.sha256!==sha256||data.translation.plan.worldDigest!==data.artifact.worldDigest)throw Error(`Component/translation identity mismatch ${name}`);
 const adapters=(data.translation.adapters as [string,number[]][]).map(([key,bytes])=>({key,bytes:bytes.length,sha256:hash(new Uint8Array(bytes))}));
 const translationSha256=hash(new TextEncoder().encode(JSON.stringify({plan:JSON.stringify(data.translation.plan),adapters:[...adapters].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(({key,sha256})=>({path:key,sha256}))})));
 if(data.artifact.translationSha256!==translationSha256)throw Error(`Prepared translation pin absent/mismatched ${name}`);
 components.push({name,sha256,bytes:bytes.length,worldDigest:data.artifact.worldDigest,profile:data.artifact.profile,translationSha256,adapters});
}
console.log(JSON.stringify({gate:'HK09-browser-static-byte-relocation',directory,relocated,files,components,scope:'Static bytes + supplied prepared translation inventory, not publisher trust or a second translator derivation'},null,2));
