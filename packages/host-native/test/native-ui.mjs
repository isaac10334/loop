// Actual Windows WebView2 interaction; accepts an installed/relocated CLI.
// No experiment executable, copied probe runtime, fixed debug port or Station access.
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const [executable, artifact, outputRoot, playwrightModule] = process.argv.slice(2);
if (!playwrightModule) throw Error('Usage: node native-ui.mjs CLI_EXE SEMANTIC_WASM OUTPUT_DIR PLAYWRIGHT_MODULE');
const output=resolve(outputRoot);await mkdir(output,{recursive:true});
const relocated=join(output,'standalone');await mkdir(relocated,{recursive:true});
await copyFile(resolve(executable),join(relocated,'loop.exe'));await copyFile(resolve(artifact),join(relocated,'component.wasm'));
const bytes=await readFile(join(relocated,'component.wasm')),sha256=createHash('sha256').update(bytes).digest('hex');
const executableSha256=createHash('sha256').update(await readFile(join(relocated,'loop.exe'))).digest('hex');
const {chromium}=await import(pathToFileURL(resolve(playwrightModule)).href);
const owned=[];
function frame(value){const body=Buffer.from(JSON.stringify(value)),length=Buffer.alloc(4);length.writeUInt32LE(body.length);return Buffer.concat([length,body]);}
async function launch(id){
 const epoch=randomUUID(),profile=join(relocated,'profiles',id+'-'+epoch);
 const child=spawn(join(relocated,'loop.exe'),['native-component','--component',join(relocated,'component.wasm'),'--expected-sha256',sha256,'--profile-dir',profile,'--instance-id',id,'--epoch',epoch,'--source','hello world','--writable'],{cwd:relocated,stdio:['pipe','pipe','pipe'],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=0 --remote-debugging-address=127.0.0.1 --no-first-run'}});
 let log='',pending=Buffer.alloc(0);const messages=[];let ended=false;const exited=new Promise(resolve=>child.once('exit',(code,signal)=>{ended=true;resolve({code,signal});}));child.stderr.on('data',chunk=>{log+=chunk;});child.stdout.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=4){const length=pending.readUInt32LE(0);if(!length||length>1048576)throw Error('invalid backend frame');if(pending.length<4+length)break;messages.push(JSON.parse(pending.subarray(4,length+4)));pending=pending.subarray(length+4);}});
 const instance={child,epoch,profile,exited,messages,get log(){return log},get ended(){return ended},browser:null};owned.push(instance);
 let active;const deadline=Date.now()+20000;while(Date.now()<deadline&&!active&&!ended){for(const file of [join(profile,'DevToolsActivePort'),join(profile,'EBWebView','DevToolsActivePort')]){try{active=await readFile(file,'utf8');break;}catch{}}if(!active)await new Promise(r=>setTimeout(r,50));}
 if(!active)throw Error('No owned DevToolsActivePort: '+log);const port=Number(active.split(/\r?\n/)[0]);if(!port||[43157,43158,43159].includes(port))throw Error('Forbidden debug port');
 // Inspect the exact listener executable/profile before opening any browser API.
 const script=`$c=Get-NetTCPConnection -State Listen -LocalPort ${port};$c|ForEach-Object{Get-CimInstance Win32_Process -Filter ('ProcessId='+$_.OwningProcess)}|Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine|ConvertTo-Json -Compress`;
 const owner=JSON.parse(execFileSync('pwsh',['-NoProfile','-Command',script],{encoding:'utf8'}));const owners=Array.isArray(owner)?owner:[owner];if(!owners.some(p=>String(p.CommandLine).includes(profile)&&String(p.ExecutablePath).toLowerCase().endsWith('msedgewebview2.exe')))throw Error('Port owner/profile mismatch');
 instance.browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const context=instance.browser.contexts()[0];const page=context.pages()[0]??await context.waitForEvent('page');await page.waitForURL(/loop-native/, {timeout:10000});await page.getByRole('button',{name:'Replace document',exact:true}).waitFor({timeout:15000});
 const readyDeadline=Date.now()+5000;while(!messages.some(m=>m.type==='ready')&&Date.now()<readyDeadline)await new Promise(r=>setTimeout(r,10));if(!messages.some(m=>m.type==='ready'&&m.epoch===epoch))throw Error('No exact native ready');
 return Object.assign(instance,{page,port,owners});
}
async function close(instance){instance.child.stdin.write(frame({type:'close',epoch:instance.epoch}));const result=await Promise.race([instance.exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('Shutdown >6s')),6000))]);if(result.code!==0)throw Error('Native failed: '+JSON.stringify(result)+' '+instance.log);const receipt=instance.messages.find(m=>m.type==='closed');if(!receipt||receipt.epoch!==instance.epoch||receipt.pendingEventReads!==0)throw Error('Missing clean closed receipt');await writeFile(join(output,instance.epoch+'.log'),instance.log);return {exit:result,closed:receipt};}
try{
 const a=await launch('a'),b=await launch('b');await a.page.getByRole('button',{name:'Replace document',exact:true}).click();await a.page.getByText('semantic world',{exact:true}).waitFor();await a.page.screenshot({path:join(output,'pointer.png')});const closedA=await close(a);
 if(b.ended)throw Error('Stopping A stopped B');await b.page.getByRole('button',{name:'Replace document',exact:true}).focus();await b.page.keyboard.press('Enter');await b.page.getByText('semantic world',{exact:true}).waitFor();await b.page.screenshot({path:join(output,'keyboard.png')});const closedB=await close(b);
 const restarted=await launch('a');if(restarted.epoch===a.epoch||restarted.profile===a.profile)throw Error('Restart reused epoch/profile');const closedRestart=await close(restarted);if(!restarted.log.includes('revision=0'))throw Error('Pending-close restart mutated document');
 const receipt={schemaVersion:1,adapter:'production loop-host Tao/Wry/WebView2 + Wasmtime48',executableSha256,componentSha256:sha256,relocatedDirectory:relocated,checkoutRuntimeDependencies:false,actions:['actual Playwright pointer click A','stop A leaves B active','actual keyboard Enter B','fresh A epoch/profile; close pending event before commit'],instances:[{id:'a',epoch:a.epoch,pid:a.child.pid,profile:a.profile,port:a.port,owners:a.owners,...closedA},{id:'b',epoch:b.epoch,pid:b.child.pid,profile:b.profile,port:b.port,owners:b.owners,...closedB},{id:'a-restarted',epoch:restarted.epoch,pid:restarted.child.pid,profile:restarted.profile,port:restarted.port,owners:restarted.owners,...closedRestart}]};await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{for(const instance of owned){if(instance.browser)await instance.browser.close().catch(()=>{});if(!instance.ended){console.error('Terminating only directly owned backend pid='+instance.child.pid);instance.child.kill();await instance.exited;}}}
