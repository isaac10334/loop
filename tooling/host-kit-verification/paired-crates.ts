/** Compile extracted trusted CLI/host archives together, with an explicit local host patch. */
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {validateCratePaths,validatePairedLock,type LockPackage} from './registry-crate-validation';

let phase='arguments',stage:string|null=null;
try{
 const [cliArg,hostArg,targetArg]=process.argv.slice(2);
 if(!cliArg||!hostArg)throw Error('Usage: bun tooling/host-kit-verification/paired-crates.ts <cli.crate> <host.crate> [cargo-target-directory]');
 phase='stage';stage=await mkdtemp(join(tmpdir(),'loop-paired-crates-'));
 async function extract(argument:string,crate:'loop-cli'|'loop-host'){
  phase=`read-${crate}`;const archive=resolve(argument),bytes=await Bun.file(archive).bytes();
  phase=`decode-${crate}`;const files=await new Bun.Archive(bytes).files(),root=validateCratePaths([...files.keys()],crate);
  phase=`extract-${crate}`;for(const [path,file] of files){const parts=path.split('/');await mkdir(join(stage!,...parts.slice(0,-1)),{recursive:true});await writeFile(join(stage!,...parts),new Uint8Array(await file.arrayBuffer()));}
  const directory=join(stage!,root),parsed=Bun.TOML.parse(await readFile(join(directory,'Cargo.toml'),'utf8')) as {package?:{name?:string;version?:string}};
  if(parsed.package?.name!==crate||typeof parsed.package.version!=='string'||root!==`${crate}-${parsed.package.version}`)throw Error(`Invalid ${crate} manifest identity`);
  return {archive,sha256:new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),files:files.size,directory,version:parsed.package.version};
 }
 const cli=await extract(cliArg,'loop-cli'),host=await extract(hostArg,'loop-host');
 const manifest=join(cli.directory,'Cargo.toml'),config=`patch.crates-io.loop-host.path=${JSON.stringify(host.directory.replaceAll('\\','/'))}`;
 const env:Record<string,string|undefined>={...process.env,CARGO_NET_OFFLINE:'true'};if(targetArg)env.CARGO_TARGET_DIR=resolve(targetArg);
 async function cargo(args:string[]){const child=Bun.spawn(['cargo',...args,'--config',config],{cwd:cli.directory,env,stdout:'pipe',stderr:'pipe'});const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);return {code,stdout,stderr};}
 phase='generate-lockfile';const generate=await cargo(['generate-lockfile','--offline','--manifest-path',manifest]);let check:Awaited<ReturnType<typeof cargo>>|null=null,lockError:string|null=null,packageCount=0;
 if(generate.code===0){phase='validate-lock';const lock=Bun.TOML.parse(await readFile(join(cli.directory,'Cargo.lock'),'utf8')) as {package?:LockPackage[]};const packages=lock.package??[];packageCount=packages.length;try{validatePairedLock(packages,cli.version,host.version);}catch(error){lockError=String(error);}if(!lockError){phase='cargo-check';check=await cargo(['check','--offline','--locked','--manifest-path',manifest,'--all-targets','--all-features','-j','2']);}}
 const passed=generate.code===0&&!lockError&&check?.code===0;
 const receipt={gate:'paired-extracted-archives-local-host-patch',stage,archives:{cli,host},offline:true,config,packageCount,lockError,generate,check,passed,limits:['The host is an explicit local patch, not the published registry dependency','Trusted local archives only: decompression is not resource-bounded','Uses ambient Cargo configuration and compiler; source replacement or a reused target can affect provenance','Compilation only: no publication, installed UI or browser conformance is implied']};
 phase='write-receipt';await writeFile(join(stage,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({...receipt,generate:{code:generate.code,stderr:generate.stderr},check:check&&{code:check.code,stderr:check.stderr}},null,2));if(!passed)process.exitCode=1;
}catch(error){const failure={gate:'paired-extracted-archives-local-host-patch',stage,phase,passed:false,error:String(error)};if(stage)try{await writeFile(join(stage,'receipt.json'),JSON.stringify(failure,null,2));}catch{}console.log(JSON.stringify(failure,null,2));process.exitCode=1;}
