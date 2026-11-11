/** Exercise an explicitly selected fresh CLI binary. Roots and TEMP stay in the fixture. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {hash} from '../../crates/loop-cli/host-tools/skills/manager';
import {bundle} from '../../crates/loop-cli/host-tools/skills/bundle';
const executable=process.env.LOOP_CLI;
if(!executable||!fs.existsSync(executable))throw Error('Set LOOP_CLI to the freshly built executable');
const root=path.resolve('target/skills-cli-smoke/'+Date.now());fs.mkdirSync(root,{recursive:true});
const project=path.join(root,'project'),user=path.join(root,'user'),temp=path.join(root,'temp');for(const dir of [project,user,temp])fs.mkdirSync(dir);
function snapshot():string {const result:any[]=[];const visit=(dir:string)=>{for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name),s=fs.lstatSync(file);result.push([path.relative(root,file),s.mode,s.mtimeMs,s.isFile()?hash(fs.readFileSync(file)):null]);if(s.isDirectory())visit(file);}};visit(root);return JSON.stringify(result);}
const commands:any[]=[];
function invoke(args:string[],expected:string,code=0,zeroWrite=false) {const before=zeroWrite?snapshot():null;const child=Bun.spawnSync([path.resolve(executable!),'skills',...args],{cwd:root,env:{...process.env,TEMP:temp,TMP:temp,BUN_RUNTIME_TRANSPILER_CACHE_PATH:'0'},stdout:'pipe',stderr:'pipe'});const stdout=new TextDecoder().decode(child.stdout),stderr=new TextDecoder().decode(child.stderr);let result:any;try{result=JSON.parse(stdout);}catch{throw Error(`No machine JSON: ${args.join(' ')}: ${stdout} ${stderr}`);}if(child.exitCode!==code||result.status!==expected)throw Error(`Unexpected CLI result: ${args.join(' ')}: ${child.exitCode} ${stdout} ${stderr}`);if(zeroWrite&&before!==snapshot())throw Error('Read-only CLI command changed fixture: '+args.join(' '));commands.push({args,exitCode:child.exitCode,result,stderr,zeroWrite});return result;}
const listed=invoke(['list','--json'],'ok',0,true);
if(JSON.stringify(listed.entries.map((e:any)=>({id:e.id,version:e.version,digest:e.digest})))!==JSON.stringify(bundle.entries.map(e=>({id:e.id,version:e.version,digest:e.digest}))))throw Error('CLI embedded catalog differs from current source');
for(const [scope,selected] of [['project',project],['user',user]] as const) {
 const flags=['--scope',scope,'--root',selected,'--adapter','codex-v1'];
 invoke(['inspect','loop-host-kits',...flags],'absent',0,true);
 const plan=invoke(['install','loop-host-kits',...flags,'--dry-run'],'planned',0,true);
 const installed=invoke(['install','loop-host-kits',...flags,'--write','--plan-digest',plan.planDigest],'installed');
 const entry=bundle.entries[0]!;if(installed.payloadDigest!==entry.digest.value)throw Error('CLI installed stale payload digest');
 for(const file of entry.inventory){const bytes=fs.readFileSync(path.join(installed.destination,file.path));if(bytes.length!==file.bytes||hash(bytes)!==file.sha256)throw Error('CLI installed stale payload bytes: '+file.path);}
 invoke(['inspect','loop-host-kits',...flags],'installed',0,true);
 invoke(['install','loop-host-kits',...flags,'--write'],'unchanged',0,true);
 invoke(['update','loop-host-kits',...flags,'--write'],'unchanged',0,true);
 invoke(['remove','loop-host-kits',...flags],'planned',0,true);
 invoke(['remove','loop-host-kits',...flags,'--write'],'removed');
 invoke(['remove','loop-host-kits',...flags,'--write'],'absent',0,true);
 invoke(['recover','loop-host-kits',...flags],'absent',0,true);
 invoke(['install','loop-host-kits',...flags,'--write','--dry-run'],'conflict',2,true);
}
const receipt={executable:path.resolve(executable),executableSha256:hash(fs.readFileSync(executable)),root,toolchain:{bun:Bun.version},commands};
const receiptPath=path.resolve('target/skills-cli-smoke/receipt.json');fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2));console.log(JSON.stringify({receipt:receiptPath,commands:commands.length,zeroWriteChecks:commands.filter(c=>c.zeroWrite).length}));
