/** Independent HK09 consumer: only tarballs/public roots, outside the workspace. Never publishes/builds source. */
import { mkdtemp, readdir, writeFile, realpath, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, isAbsolute } from 'node:path';
const sourceRoot = resolve(import.meta.dir, '../..');
const tarballRoot = resolve(process.argv[2] ?? join(sourceRoot, 'target/npm-pack'));
const required = ['@loop-kit/capabilities', '@loop-kit/host', '@loop-kit/ui'];
const dependencies: Record<string,string> = {};
const receipts: {name:string;path:string;sha256:string}[] = [];
for (const file of await readdir(tarballRoot)) {
 if (!file.endsWith('.tgz')) continue;
 const path=join(tarballRoot,file), bytes=await Bun.file(path).bytes();
 const packed=await new Bun.Archive(bytes).files();
 const entry=packed.get('package/package.json'); if(!entry) continue;
 const manifest=JSON.parse(await entry.text());
 if (!manifest.name?.startsWith('@loop-kit/')) continue;
 if(dependencies[manifest.name]) throw Error(`Duplicate public tarball ${manifest.name}`);
 for(const spec of Object.values(manifest.dependencies??{}) as string[]) if(/^(workspace:|file:|link:)|[A-Z]:[\\/]|station/i.test(spec)) throw Error(`Nonpublic dependency ${manifest.name}: ${spec}`);
 if(!packed.has('package/dist/index.js')||!packed.has('package/dist/index.d.ts')) throw Error(`Missing public build ${manifest.name}`);
 for (const [entryName,entryBytes] of packed) if (/^package\/dist\/.*\.(?:js|d\.ts)$/.test(entryName)) {
  const text=await entryBytes.text();
  if (/__stationLocalLinkProof|[A-Za-z]:[\\/](?:src|Users)[\\/]|from\s*['\"][^'\"]*station/i.test(text)) throw Error(`Checkout/Station implementation leaked into ${manifest.name}/${entryName}`);
 }
 dependencies[manifest.name]='file:'+path.replaceAll('\\','/');
 receipts.push({name:manifest.name,path,sha256:new Bun.CryptoHasher('sha256').update(bytes).digest('hex')});
}
for(const name of required) if(!dependencies[name]) throw Error(`Missing required tarball ${name}`);
const consumer=await mkdtemp(join(tmpdir(),'loop-hk09-public-'));
if(!relative(sourceRoot,consumer).startsWith('..')) throw Error('Consumer must be outside checkout');
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies,overrides:dependencies}));
async function run(argv:string[]) {const child=Bun.spawn(argv,{cwd:consumer,stdout:'inherit',stderr:'inherit',env:{...process.env,NODE_PATH:'',NODE_OPTIONS:'',BUN_OPTIONS:''}});if(await child.exited)throw Error(`Failed: ${argv.join(' ')}`);}
await run([process.execPath,'install','--ignore-scripts','--no-progress']);
for(const name of Object.keys(dependencies)) {const path=join(consumer,'node_modules',...name.split('/')),actual=await realpath(path),rel=relative(consumer,actual);if((await lstat(path)).isSymbolicLink() || rel==='..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel))throw Error(`Installed dependency escaped consumer: ${name}`);}
await writeFile(join(consumer,'consumer.ts'),String.raw`
import { createHash } from 'node:crypto';
import { defineCapability } from '@loop-kit/capabilities';
import { createHost, defineConfig, defineHostKit, defineHostPlugin, extractHostConfig, resolveHostPlan, hostPlanData } from '@loop-kit/host';
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
const profile={id:'independent:profile/headless',version:'1.0.0'};
let hookCalls=0;
const plugin=defineHostPlugin({apiVersion:1,identity:{id:'independent:plugin/counter',version:'1.0.0'},key:'counter',targets:['browser'],runtime:[],prepare(){hookCalls++}});
const kit=defineHostKit({apiVersion:1,identity:{id:'independent:kit/custom',version:'1.0.0'},kind:'browser',profile,options:{},hosts:[{key:'application',realm:'application',profile}],coordinator:{specifier:'./custom.ts',export:'bootstrap'},plugins:[plugin]});
const config=defineConfig({schemaVersion:1,source:{manifest:'loop.package.json'},targets:[{id:'independent',kit,application:{specifier:'./app.ts',export:'start'}}]});
const digest='a'.repeat(64), hash=text=>createHash('sha256').update(text).digest('hex');
const plan=resolveHostPlan(extractHostConfig(config),{modules:[{specifier:'./custom.ts',export:'bootstrap',sha256:digest},{specifier:'./app.ts',export:'start',sha256:digest}],sourceSnapshotDigest:digest,configDigest:digest,lockDigests:[],toolchain:[],provenance:{}},hash);
assert(plan.kit.id==='independent:kit/custom'&&hookCalls===0,'External kit must resolve without special dispatch or hook effects');
assert(plan.plugins[0].hooks[0]==='prepare','Coordinator hook metadata missing');
let reads=0,rejected=false;try{hostPlanData({get effect(){reads++;return 1}})}catch{rejected=true}assert(rejected&&reads===0,'Data boundary invoked getter');
rejected=false;try{hostPlanData({callback(){}})}catch{rejected=true}assert(rejected,'Callback crossed plan boundary');
const sparse=[];sparse[1]=1;rejected=false;try{hostPlanData(sparse)}catch{rejected=true}assert(rejected,'Interior sparse-array hole crossed JSON boundary');
rejected=false;try{defineHostKit({plugins:[],apiVersion:99} as any)}catch{rejected=true}assert(rejected,'Invalid custom kit accepted by public factory');
const capability=defineCapability<{increment():number}>({id:'independent:counter/value',version:'1'});
const a=createHost(),b=createHost(); let disposed=0;
for(const host of [a,b]) {let count=0;host.provide(capability,{create:()=>({increment:()=>++count}),dispose:()=>{disposed++}})}
const sa=a.scope(),sb=b.scope(),ha=await sa.acquire(capability),hb=await sb.acquire(capability);
assert(ha.value.increment()===1&&hb.value.increment()===1,'Host state leaked across instances');
await a.dispose();assert(hb.value.increment()===2&&!hb.signal.aborted,'Stop A damaged B');await b.dispose();assert(disposed===2,'Provider cleanup not exactly once');
for(const name of PACKAGE_NAMES) {const api=await import(name);assert(Object.keys(api).length>0,'Public root is empty: '+name);for(const sub of ['/src/index.ts','/dist/index.js']) {let denied=false;try{await import(name+sub)}catch{denied=true}assert(denied,'Private export exposed: '+name+sub)}}
console.log('HK09 public custom-kit/provider conformance passed; no Station imports');
`.replace('PACKAGE_NAMES',JSON.stringify(Object.keys(dependencies))));
await run([process.execPath,'consumer.ts']);
// Keep package imports external so Node independently enforces exports and installed-root resolution.
await run([process.execPath,'build','consumer.ts','--target=node','--packages=external','--outfile=consumer.mjs']);
await run(['node','consumer.mjs']);
console.log(JSON.stringify({gate:'HK09-independent-public-consumer',consumer,tarballs:receipts,sourceImports:false,stationImports:false},null,2));
