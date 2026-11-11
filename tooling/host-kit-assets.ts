/** Package evaluator/catalog assets with source and artifact identities; no runtime install step. */
import { resolve } from 'node:path';
const root=resolve(import.meta.dir,'..');
async function run(args:string[]) {const child=Bun.spawn(args,{cwd:root,stdout:'inherit',stderr:'inherit'});if(await child.exited)throw new Error(`Asset command failed: ${args.join(' ')}`);}
await run(['bun','crates/loop-cli/host-tools/build.ts']);
await run(['bun','build','crates/loop-cli/host-tools/skills/cli.ts','--target=bun','--outfile','crates/loop-cli/assets/skills.mjs']);
const sha=(bytes:Uint8Array)=>new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const sources:Record<string,string>={};
for(const glob of ['crates/loop-cli/host-tools/**/*.ts','crates/loop-cli/templates/**/*','skills/**/*','packages/*/dist/**/*']) for await(const path of new Bun.Glob(glob).scan({cwd:root,onlyFiles:true})) {
 if(path.includes('/node_modules/')||path.includes('\\node_modules\\'))continue;
 sources[path.replaceAll('\\','/')]=sha(new Uint8Array(await Bun.file(resolve(root,path)).arrayBuffer()));
}
for(const [source,target] of [['contracts/host-kit-protocol-golden.json','protocol-golden.json'],['scripts/manage.ps1','manage.ps1'],['rust-toolchain.toml','rust-toolchain.toml'],['crates/loop-host/wit/application.wit','application.wit']]) {
 const bytes=await Bun.file(resolve(root,source!)).bytes();
 sources[source!]=sha(bytes);
 await Bun.write(resolve(root,'crates/loop-cli/assets',target!),bytes);
}
const artifacts:Record<string,{bytes:number;sha256:string}>={};
for(const path of ['host-tools/dist/worker.js','assets/skills.mjs','assets/protocol-golden.json','assets/manage.ps1','assets/rust-toolchain.toml','assets/application.wit']) {const bytes=new Uint8Array(await Bun.file(resolve(root,'crates/loop-cli',path)).arrayBuffer());artifacts[path]={bytes:bytes.length,sha256:sha(bytes)};}
for await(const path of new Bun.Glob('templates/**/*').scan({cwd:resolve(root,'crates/loop-cli'),onlyFiles:true})) {
 const portable=path.replaceAll('\\','/');
 const bytes=await Bun.file(resolve(root,'crates/loop-cli',path)).bytes();
 artifacts[portable]={bytes:bytes.length,sha256:sha(bytes)};
}
await Bun.write(resolve(root,'crates/loop-cli/assets/inventory.json'),JSON.stringify({schemaVersion:1,evaluatorVersion:'0.1.0',bunVersion:Bun.version,artifacts,sources:Object.fromEntries(Object.entries(sources).sort(([a],[b])=>a.localeCompare(b)))},null,2)+'\n');
console.log(JSON.stringify(artifacts,null,2));
