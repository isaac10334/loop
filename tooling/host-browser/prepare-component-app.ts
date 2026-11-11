/** Materialize a generated acceptance app in a preinstalled TEMP fixture, never repo manifests. */
import { resolve, join } from "node:path";
import { defaultTranslator } from "@polyengine/translator";
import { translationSha256 } from "@loop-kit/component-polyengine";
const root = resolve(process.argv[2] ?? "");
if (!process.argv[2] || !root.replaceAll("\\", "/").includes("/Temp/loop-hk09-official-") || !root.endsWith("browser-components")) throw new Error("Pass the explicitly prepared HK09 temporary components project");
const bytes = new Uint8Array(await Bun.file("target/document-tool/loop_document_guest.wasm").arrayBuffer());
const translator = await defaultTranslator(), translated = translator.translate(bytes);
const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const artifact = { sha256, worldDigest: translated.plan.worldDigest, profile: "document", translationSha256: await translationSha256(translated) };
await Bun.write(join(root,"src/artifact.ts"), `// Generated from current reviewed Component bytes through public translator0.6.7.\nexport const artifact = ${JSON.stringify(artifact)} as const;\nexport const componentBase64 = ${JSON.stringify(Buffer.from(bytes).toString("base64"))};\nexport const plan = ${JSON.stringify(translated.plan)};\nexport const adapterBytes = ${JSON.stringify([...translated.adapters].map(([k,v])=>[k,Array.from(v)]))} as [string,number[]][];\n`);
await Bun.write(join(root,"src/app.ts"), `import type { Host, Scope } from '@loop-kit/host';
import {h,type Surface} from '@loop-kit/ui';
import {createDocumentOwner,createPolyengineSession} from '@loop-kit/component-polyengine';
import {artifact,componentBase64,plan,adapterBytes} from './artifact';
const sourceMarker = 'source-v1';
export async function start({scope,surface,signal,workerUrl}: {host:Host;scope:Scope;surface:Surface;signal:AbortSignal;workerUrl?:string}) {
 const owner=createDocumentOwner({source:'hello world',authorize:p=>p==='fixture-author',beforeOperation:async()=>{await new Promise(r=>setTimeout(r,35));}});
 scope.defer(()=>owner.dispose());
 const grant=owner.issue({principal:'fixture-author',read:true,write:true});
 const session=await createPolyengineSession({workerUrl:workerUrl!,componentBytes:Uint8Array.from(atob(componentBase64),c=>c.charCodeAt(0)),translation:{plan,adapters:new Map(adapterBytes.map(([k,v])=>[k,new Uint8Array(v)]))} as never,artifact,document:{owner,grant},signal});
 const inspect=()=>({session:session.inspect(),document:owner.inspect(),snapshot:owner.snapshot,sourceMarker});
 const root=globalThis as unknown as {componentReceipt:unknown};root.componentReceipt=inspect();
 scope.defer(async()=>{await session.dispose();owner.dispose();root.componentReceipt=inspect();});
 let revision=0,changes=0,current='hello';
 const draw=async(text:string)=>{await surface.render({revision,root:h('column',{key:'root'},h('text',{key:'greeting',text:sourceMarker+';'+text}),h('button',{key:'replace',label:'Replace document',text:'Replace'}))});root.componentReceipt=inspect();};
 await draw(owner.snapshot.source);
 const task=scope.task(async()=>{while(!signal.aborted){const event=await surface.nextEvent();if(!event||signal.aborted)return;const next='component-'+(++changes);const result=await session.replaceText(current,next);if(signal.aborted)return;current=next;revision++;await draw(result);}});
 void task.result.catch(error=>{if(!signal.aborted)console.error(error);});
}
`);
const configFile=join(root,"loop.config.ts"), config=await Bun.file(configFile).text();
if (!config.includes("kit:browser({})")) throw new Error("Unexpected generated kit config (do not overwrite unrelated project)");
await Bun.write(configFile,config.replace("kit:browser({})","kit:browser({profile:'loop:profile/browser-components@0.1.0'})"));
const sourceFile=join(root,"loop.package.json"), source=await Bun.file(sourceFile).json();
await Bun.write(sourceFile,JSON.stringify({...source,sourcePaths:[...new Set([...source.sourcePaths,"src/artifact.ts"])]},null,2));
console.log(JSON.stringify({root,artifact,translatorBuildHash:translator.buildHash,sourceMarker:'source-v1'}));
