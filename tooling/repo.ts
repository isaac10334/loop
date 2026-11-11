/** Repository commands share the same inspected package graph and deterministic failure codes. */
import { inspect, affectedPackages, type Policy } from './architecture';
import { inspectRustBoundaries } from './rust-boundaries';
import { resolve } from 'node:path';
import { watch } from 'node:fs';
const root=resolve(import.meta.dir,'..');
const policy=await Bun.file(resolve(import.meta.dir,'architecture-policy.json')).json() as Policy;
const args=process.argv.slice(2),command=args[0],json=args.includes('--json');
const graph=inspect(root,policy);
const output=(value:unknown)=>console.log(JSON.stringify(value,null,2));
async function run(argv:string[],cwd=root){const child=Bun.spawn(argv,{cwd,stdout:'inherit',stderr:'inherit'});const code=await child.exited;if(code)process.exit(code);}
const selected=(name:string|undefined)=>{const pkg=graph.packages.find(pkg=>pkg.name===name||pkg.name.endsWith('/'+name));if(!pkg)throw new Error(`Unknown package ${name}`);return pkg;};
const ordered=(names:Set<string>)=>{const result:typeof graph.packages=[];const visited=new Set<string>();const visit=(name:string)=>{if(visited.has(name))return;visited.add(name);for(const dependency of graph.packages.find(pkg=>pkg.name===name)!.allows)if(names.has(dependency))visit(dependency);result.push(selected(name));};for(const name of names)visit(name);return result;};
try{
 switch(command){
 case 'graph': output(graph);break;
 case 'check': {const rust=inspectRustBoundaries(root);if(json)output({...graph,rust});else {for(const violation of graph.violations)console.error(`${violation.file} -> ${violation.target}: [${violation.rule}] ${violation.message}${violation.publicEntrypoint?`; public entrypoint: ${violation.publicEntrypoint}`:''}`);for(const violation of rust.violations)console.error(`${violation.manifest}: [${violation.rule}] ${violation.message}`);console.log(`${graph.packages.length} packages, ${graph.edges.length} source edges, ${graph.violations.length} TS violations, ${graph.exceptionCount} exceptions; ${rust.crates.length} Rust crates, ${rust.edges.length} declared edges, ${rust.violations.length} Rust violations`);}if(graph.violations.length||rust.violations.length)process.exitCode=1;break;}
 case 'context': {const pkg=selected(args[1]);output({...pkg,publicDependencies:pkg.allows,dependents:graph.packages.filter(candidate=>candidate.allows.includes(pkg.name)).map(candidate=>candidate.name),forbiddenChanges:['No Station dependency','Preserve public exports and wire identities','No platform imports in inward layers'],verify:`bun run repo verify ${pkg.name}`,readme:resolve(root,pkg.path,'README.md'),architecture:resolve(root,'ARCHITECTURE.md'),violations:graph.violations.filter(item=>item.file.startsWith(pkg.path+'/'))});break;}
 case 'affected': {
  const flag=args.indexOf('--base');const argv=flag>=0?['git','diff','--name-only',args[flag+1]??'HEAD','--']:['git','diff','--name-only','HEAD','--'];
  const child=Bun.spawn(argv,{cwd:root,stdout:'pipe',stderr:'inherit'});const changed=(await new Response(child.stdout).text()).trim().split(/\r?\n/);if(await child.exited)throw new Error('git diff failed');
  const untracked=Bun.spawn(['git','ls-files','--others','--exclude-standard'],{cwd:root,stdout:'pipe'});changed.push(...(await new Response(untracked.stdout).text()).trim().split(/\r?\n/));if(await untracked.exited)throw new Error('git ls-files failed');
  const names=new Set(affectedPackages(graph.packages,changed));
  output({changed:changed.filter(Boolean),packages:ordered(names).map(pkg=>pkg.name)});break;}
 case 'verify': {if(graph.violations.length||inspectRustBoundaries(root).violations.length)throw new Error('Architecture check failed; run bun run repo check --rust');const names=new Set<string>();const add=(name:string)=>{if(names.has(name))return;names.add(name);for(const dependency of selected(name).allows)add(dependency);};if(args[1]==='all'||!args[1])for(const pkg of graph.packages)add(pkg.name);else add(selected(args[1]).name);for(const pkg of ordered(names))for(const task of ['build','typecheck','test'])if(task in pkg.scripts)await run(['bun','run',task],resolve(root,pkg.path));await run(['bun','test','tooling']);if(args[1]==='all'||!args[1])await run(['bun','run','check:packages']);break;}
 case 'watch': { let queued=false,building=false;const build=async()=>{queued=true;if(building)return;building=true;while(queued){queued=false;const child=Bun.spawn(['bun','run','repo','build'],{cwd:root,stdout:'inherit',stderr:'inherit'});if(await child.exited)console.error('Build failed; watching for the next source edit');}building=false;};await build();for(const pkg of graph.packages)watch(resolve(root,pkg.path,'src'),{recursive:true},()=>{void build();});console.log('Watching all Loop Kit sources; rebuilds run in dependency order. Ctrl+C stops.');await new Promise(()=>{});break; }
 case 'build': for(const pkg of ordered(new Set(graph.packages.map(pkg=>pkg.name))))await run(['bun','run','build'],resolve(root,pkg.path));break;
 default: console.error('Usage: bun run repo <graph|check|affected [--base REF]|verify [package|all]|context package|watch> [--json]');process.exitCode=2;
 }
}catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1;}
