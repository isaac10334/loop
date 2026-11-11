/** Inspect the actual Cargo archive, not package --list; verify embedded inputs survive extraction. */
import { posix, resolve } from 'node:path';
const archive=resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Usage: bun tooling/host-kit-verification/crate-artifact.ts <crate> [--check-current <checkout>]');
const bytes=await Bun.file(archive).bytes(),files=await new Bun.Archive(bytes).files();
const root=[...files.keys()].find(path=>path.endsWith('/Cargo.toml'))?.split('/')[0];if(!root)throw Error('No crate manifest');
const failures:string[]=[],embedded:{source:string;path:string;sha256:string}[]=[];
const hash=(data:Uint8Array)=>new Bun.CryptoHasher('sha256').update(data).digest('hex');
for(const [path,file]of files)if(path.endsWith('.rs')){
 const text=await file.text();
 for(const match of text.matchAll(/include_(?:str|bytes)!\s*\(\s*"([^"]+)"\s*\)/g)){
  const target=posix.normalize(posix.join(posix.dirname(path),match[1]!));
  if(!target.startsWith(root+'/')||!files.has(target)){failures.push(`Embedded Rust input escapes/is absent: ${path} -> ${target}`);continue;}
  embedded.push({source:path.slice(root.length+1),path:target.slice(root.length+1),sha256:hash(new Uint8Array(await files.get(target)!.arrayBuffer()))});
 }
}
const inventoryEntry=files.get(root+'/assets/inventory.json');
let inventoryChecks=0,currentChecks=0;const unlistedEmbedded:string[]=[];
if(inventoryEntry){
 const inventory=JSON.parse(await inventoryEntry.text());
 for(const [path,raw]of Object.entries(inventory.artifacts??{})){
  const expected=raw as {bytes:number;sha256:string},file=files.get(root+'/'+path);
  if(!file){failures.push('Inventory artifact missing from archive: '+path);continue;}
  const data=new Uint8Array(await file.arrayBuffer());inventoryChecks++;
  if(data.length!==expected.bytes||hash(data)!==expected.sha256)failures.push('Inventory artifact digest mismatch: '+path);
 }
 for(const entry of embedded)if(entry.path!=='assets/inventory.json'&&!Object.hasOwn(inventory.artifacts??{},entry.path))unlistedEmbedded.push(entry.path);
 const flag=process.argv.indexOf('--check-current');if(flag>=0){const checkout=resolve(process.argv[flag+1]!);for(const [path,sha256]of Object.entries(inventory.sources??{})){currentChecks++;const file=Bun.file(resolve(checkout,path));if(!await file.exists()||hash(await file.bytes())!==sha256)failures.push('Embedded inventory source is stale: '+path);}}
}else failures.push('Missing embedded asset inventory');
const manifest=Bun.TOML.parse(await files.get(root+'/Cargo.toml')!.text()) as any;
console.log(JSON.stringify({gate:'HK09-actual-crate-embedded-inventory',archive,sha256:hash(bytes),files:files.size,embedded,inventoryChecks,currentChecks,unlistedEmbedded:[...new Set(unlistedEmbedded)],registryHost:manifest.dependencies?.['loop-host'],failures,passed:failures.length===0,limits:['Unlisted embedded inputs reported separately; archive existence and include closure are verified','Compilation and registry runtime compatibility require separate executable gates']},null,2));process.exitCode=failures.length?1:0;
