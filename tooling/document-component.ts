/** Build and inspect current Rust guest bytes using installed, pinned public tools. */
import { defaultTranslator } from '@polyengine/translator';
import { requiredImports } from '@polyengine/runtime/embedder';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dir,'..');
const output=resolve(root,'target/document-tool');
await mkdir(output,{recursive:true});
const hash=(bytes:Uint8Array|string)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
function capture(args:string[]):string {const result=Bun.spawnSync(args,{cwd:root,stdout:'pipe',stderr:'pipe'});if(result.exitCode)throw new Error(new TextDecoder().decode(result.stderr));return new TextDecoder().decode(result.stdout).trim();}
const rustcPath=capture(['rustup','which','rustc']);
const cargoPath=capture(['rustup','which','cargo']);
const toolchain={rust:capture([rustcPath,'--version']),rustcPath,rustcSha256:hash(await Bun.file(rustcPath).bytes()),cargo:capture([cargoPath,'--version']),cargoPath,cargoSha256:hash(await Bun.file(cargoPath).bytes()),bun:Bun.version,bunSha256:hash(await Bun.file(process.execPath).bytes()),witBindgen:'0.61.1',polyengine:'0.6.7'};
const translator=await defaultTranslator();
const receipts=[];
for(const [folder,name] of [['guest','loop_document_guest'],['guest-v2','loop_document_guest_v2'],['semantic-guest','loop_document_semantic_guest'],['runaway-guest','loop_document_runaway_guest'],['budget-guest','loop_document_budget_guest'],['lifecycle-guest','loop_document_lifecycle_guest']]) {
 const dir=resolve(root,'contracts/document-tool',folder!);
 const child=Bun.spawn(['cargo','build','--offline','--locked','--release','--target','wasm32-wasip2','--manifest-path',resolve(dir,'Cargo.toml')],{cwd:root,stdout:'inherit',stderr:'inherit'});
 if(await child.exited) throw new Error(`Guest build failed: ${folder}`);
 const built=resolve(dir,`target/wasm32-wasip2/release/${name}.wasm`);
 const bytes=new Uint8Array(await Bun.file(built).arrayBuffer());
 const translated=translator.translate(bytes);
 const files:Record<string,string>={};
 for await(const path of new Bun.Glob('**/*').scan({cwd:dir,onlyFiles:true})) if(!path.startsWith('target/')&&!path.startsWith('target\\')) files[path.replaceAll('\\','/')]=hash(new Uint8Array(await Bun.file(resolve(dir,path)).arrayBuffer()));
 files['../wit/document.wit']=hash(await Bun.file(resolve(root,'contracts/document-tool/wit/document.wit')).text());
 const profile={schemaVersion:1,artifact:`${name}.wasm`,sha256:hash(bytes),component:translated.plan.component,worldDigest:translated.plan.worldDigest,imports:requiredImports(translated.plan),exports:translated.plan.exports,types:translated.plan.types,sourceFiles:files,toolchain};
 await Bun.write(resolve(output,`${name}.wasm`),bytes);
 await Bun.write(resolve(output,`${name}.profile.json`),JSON.stringify(profile,null,2)+'\n');
 receipts.push({artifact:profile.artifact,sha256:profile.sha256,worldDigest:profile.worldDigest});
}
await Bun.write(resolve(output,'receipt.json'),JSON.stringify({schemaVersion:1,receipts},null,2)+'\n');
console.log(JSON.stringify(receipts,null,2));
