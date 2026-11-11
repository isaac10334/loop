/** Copy the produced binary outside checkout and verify embedded starters/catalog/evaluator through CLI only. */
import { mkdtemp, mkdir, copyFile, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const binary=resolve(process.argv[2]??''),tarballs=resolve(process.argv[3]??'target/npm-pack');
if(!process.argv[2])throw Error('Usage: bun tooling/host-kit-verification/relocated-cli.ts <produced-loop.exe> [public-tarball-directory]');
const stage=await mkdtemp(join(tmpdir(),'loop-hk09-cli-')),exe=join(stage,'loop.exe');await copyFile(binary,exe);
const sha256=new Bun.CryptoHasher('sha256').update(await Bun.file(exe).bytes()).digest('hex');
const results:{name:string;passed:boolean;detail?:unknown}[]=[];
const environment:Record<string,string|undefined>={...process.env,NODE_PATH:'',NODE_OPTIONS:'',BUN_OPTIONS:'',BUN_RUNTIME_TRANSPILER_CACHE_PATH:'0'};delete environment.LOOP_HOST_SOURCE;
async function run(args:string[],expected=0,cwd=stage){const child=Bun.spawn([exe,...args],{cwd,stdout:'pipe',stderr:'pipe',env:environment});const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);return {stdout,stderr,code,expected};}
const record=(name:string,passed:boolean,detail?:unknown)=>{results.push({name,passed,detail});if(!passed)console.error('MISSING GATE: '+name+' '+JSON.stringify(detail));};
for(const kit of ['browser','native']){const path=join(stage,kit),r=await run(['create',path,'--kit',kit,'--json']);record(`embedded ${kit} starter`,r.code===0,r);}
for(const language of ['rust','typescript']){const path=join(stage,'legacy-'+language),r=await run(['create',path,'--template','desktop','--language',language,'--yes']);record(`embedded legacy ${language} starter`,r.code===0,r);}
const beforeSkills=(await readdir(stage)).sort();const catalog=await run(['skills','list','--json']);
record('embedded offline skill catalog outside checkout',catalog.code===0&&catalog.stdout.includes('loop-host-kits'),catalog);
record('catalog inspection creates no files in relocated cwd',JSON.stringify(beforeSkills)===JSON.stringify((await readdir(stage)).sort()));
// Exercise the actual native starter's evaluator without ever starting a native backend/window.
const nativeProject=join(stage,'native');
const nativeManifest=JSON.parse(await readFile(join(nativeProject,'package.json'),'utf8'));
const nativeDeps:Record<string,string>={};
for(const name of ['capabilities','host','host-native','ui'])nativeDeps['@loop-kit/'+name]='file:'+join(tarballs,`loop-kit-${name}-0.1.0.tgz`).replaceAll('\\','/');
await writeFile(join(nativeProject,'package.json'),JSON.stringify({...nativeManifest,dependencies:nativeDeps,overrides:nativeDeps},null,2)+'\n');
const nativeInstall=Bun.spawn([process.execPath,'install','--offline','--ignore-scripts','--no-progress'],{cwd:nativeProject,stdout:'pipe',stderr:'pipe',env:environment});
const [nativeInstallOut,nativeInstallErr,nativeInstallCode]=await Promise.all([new Response(nativeInstall.stdout).text(),new Response(nativeInstall.stderr).text(),nativeInstall.exited]);
if(nativeInstallCode!==0)throw Error(`Offline native fixture preparation failed (${nativeInstallCode}): ${nativeInstallOut} ${nativeInstallErr}`);
const nativeConfig=join(nativeProject,'loop.config.ts'),nativeMarker=join(nativeProject,'native-executed.txt');
const nativeConfigText=await readFile(nativeConfig,'utf8');
await writeFile(nativeConfig,nativeConfigText+"\nimport {appendFileSync as markNativeEvaluation} from 'node:fs';\nmarkNativeEvaluation(new URL('./native-executed.txt',import.meta.url),'executed');\n");
const nativeStatic=await run(['inspect',nativeProject,'--json']);
let staticValue:any;try{staticValue=JSON.parse(nativeStatic.stdout);}catch{}
record('native static inspection does not execute config',nativeStatic.code===0&&staticValue?.executedConfig===false&&staticValue?.result?.config?.evaluated===false&&!await Bun.file(nativeMarker).exists(),nativeStatic);
const nativeDenied=await run(['inspect',nativeProject,'--evaluate-config','--target','desktop','--json']);
record('native evaluation requires trust',nativeDenied.code===3&&nativeDenied.stdout.includes('E_CONFIG_TRUST')&&!await Bun.file(nativeMarker).exists(),nativeDenied);
const nativeEvaluated=await run(['inspect',nativeProject,'--evaluate-config','--target','desktop','--trust-local-config','--json']);
let nativeValue:any;try{nativeValue=JSON.parse(nativeEvaluated.stdout);}catch{}
const nativePlan=nativeValue?.result;
record('native starter resolves installed public native profile without UI',nativeEvaluated.code===0&&nativeValue?.executedConfig===true&&await Bun.file(nativeMarker).exists()&&nativePlan?.kind==='desktop'&&nativePlan?.kit?.id==='loop:kit/native'&&nativePlan?.profile?.id==='loop:profile/native-ts'&&nativePlan?.coordinator?.specifier==='@loop-kit/host-native'&&/^[a-f0-9]{64}$/.test(nativePlan?.planId??''),{planId:nativePlan?.planId,kit:nativePlan?.kit,profile:nativePlan?.profile,coordinator:nativePlan?.coordinator,error:nativeEvaluated.stderr});
if(nativePlan?.planId){const tampered=structuredClone(nativePlan);tampered.planId='0'.repeat(64);const path=join(nativeProject,'tampered-plan.json');await writeFile(path,JSON.stringify(tampered));const check=await run(['inspect',nativeProject,'--plan',path,'--json']);record('native stored plan digest tampering rejects',check.code!==0&&check.stdout.includes('E_PLAN_DIGEST'),check);}
// Lock drift must be rejected before another trusted config execution occurs.
const nativePackage=join(nativeProject,'package.json'),nativePackageText=await readFile(nativePackage,'utf8');
const staleNativeManifest=JSON.parse(nativePackageText);staleNativeManifest.dependencies['@loop-kit/host-native']='99.0.0';
await writeFile(nativePackage,JSON.stringify(staleNativeManifest,null,2)+'\n');
const staleNative=await run(['inspect',nativeProject,'--evaluate-config','--target','desktop','--trust-local-config','--json']);
const markerAfterStale=await readFile(nativeMarker,'utf8').catch(()=>null);
record('stale native dependency is rejected before config executes',staleNative.code!==0&&staleNative.stdout.includes('E_PREPARE_REQUIRED')&&markerAfterStale==='executed',staleNative);
await writeFile(nativePackage,nativePackageText);
const project=join(stage,'project');await mkdir(project);
const dependencies:Record<string,string>={};for(const name of ['capabilities','host','ui','workspace'])dependencies['@loop-kit/'+name]='file:'+join(tarballs,`loop-kit-${name}-0.1.0.tgz`).replaceAll('\\','/');
await writeFile(join(project,'package.json'),JSON.stringify({private:true,type:'module',dependencies,overrides:dependencies}));
const install=Bun.spawn([process.execPath,'install','--offline','--ignore-scripts','--no-progress'],{cwd:project,stdout:'inherit',stderr:'inherit',env:environment});if(await install.exited)throw Error('Outside project public package preparation failed');
await writeFile(join(project,'helper.ts'),'export const value=1;\n');
await writeFile(join(project,'app.ts'),'export function start() {}\n');
await writeFile(join(project,'coordinator.ts'),'export function bootstrap() {}\n');
await writeFile(join(project,'loop.package.json'),JSON.stringify({version:1,id:'independent-cli',sourcePaths:['app.ts','coordinator.ts','helper.ts','loop.config.ts']}));
await writeFile(join(project,'loop.config.ts'),`import {defineConfig,defineHostKit} from '@loop-kit/host';import {writeFileSync} from 'node:fs';import {value} from './helper.ts';writeFileSync(new URL('./executed.txt',import.meta.url),'executed');const profile={id:'independent:profile/headless',version:'1.0.0'};export default defineConfig({schemaVersion:1,source:{manifest:'loop.package.json'},targets:[{id:'independent',kit:defineHostKit({apiVersion:1,identity:{id:'independent:kit/custom',version:'1.0.0'},kind:'browser',profile,options:{value},hosts:[{key:'application',realm:'application',profile}],coordinator:{specifier:'./coordinator.ts',export:'bootstrap'},plugins:[]}),application:{specifier:'./app.ts',export:'start'}}]});`);
const marker=join(project,'executed.txt');
const inert=await run(['inspect',project,'--json']);record('static inspect imports no config',inert.code===0&&!await Bun.file(marker).exists(),inert);
const denied=await run(['inspect',project,'--evaluate-config','--json']);record('evaluation requires explicit trust before code executes',denied.code===3&&!await Bun.file(marker).exists(),denied);
const evaluate=async()=>{const result=await run(['inspect',project,'--evaluate-config','--trust-local-config','--json']);let value:any;try{value=JSON.parse(result.stdout);}catch{}return {...result,value};};
const first=await evaluate();record('embedded evaluator resolves installed public packages outside checkout',first.code===0&&await Bun.file(marker).exists(),first);
await writeFile(join(project,'helper.ts'),'export const value=2;\n');const second=await evaluate();
const plan=(value:any)=>value?.result?.plan??value?.result;
record('fresh evaluation changes plan identity for transitive config helper',second.code===0&&!!plan(first.value)?.planId&&plan(first.value).planId!==plan(second.value)?.planId,{first:plan(first.value)?.planId,second:plan(second.value)?.planId,error:second.stderr});
if(plan(second.value)?.planId){const stored=structuredClone(plan(second.value));stored.planId='0'.repeat(64);const path=join(project,'tampered-plan.json');await writeFile(path,JSON.stringify(stored));const check=await run(['inspect',project,'--plan',path,'--json']);record('stored plan digest tampering rejects',check.code!==0,check);}
const receipt={gate:'HK09-relocated-CLI-embedded-assets',stage,executableSha256:sha256,results,passed:results.every(r=>r.passed),limits:['Creates all embedded starters; does not compile legacy registry guests','Read-only skills cwd inventory is not a whole-system no-write monitor','Offline local tarballs and cached dependencies required; no checkout runtime source imported','Native target is inspected only; no native backend, Component execution or window is exercised']};
await writeFile(join(stage,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,results:results.map(result=>result.passed?{name:result.name,passed:true}:result)},null,2));process.exitCode=receipt.passed?0:1;
