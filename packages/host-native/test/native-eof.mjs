// Native owner crash/EOF conformance. The backend receives real pipe EOF while
// suspended on a Component event, not an in-process surface.close() substitute.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
const [exe,component,root]=process.argv.slice(2);if(!root)throw Error('Usage: node native-eof.mjs CLI_EXE SEMANTIC_WASM OUTPUT_DIR');
const output=resolve(root);await mkdir(output,{recursive:true});await copyFile(resolve(exe),join(output,'loop.exe'));await copyFile(resolve(component),join(output,'component.wasm'));
const hash=createHash('sha256').update(await readFile(join(output,'component.wasm'))).digest('hex');const exeHash=createHash('sha256').update(await readFile(join(output,'loop.exe'))).digest('hex');const receipts=[];
for(const stage of ['pending-event','partial-start']) {
 const epoch=randomUUID(),profile=join(output,'profiles',stage+'-'+epoch);const child=spawn(join(output,'loop.exe'),['native-component','--component',join(output,'component.wasm'),'--expected-sha256',hash,'--profile-dir',profile,'--instance-id','eof-test','--epoch',epoch,'--source','hello world','--writable'],{cwd:output,stdio:['pipe','pipe','pipe'],env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:''}});
 let error='',bytes=Buffer.alloc(0),exited=false;const frames=[];let readyResolve;const ready=new Promise(resolve=>{readyResolve=resolve});const exit=new Promise(resolve=>child.once('exit',(code,signal)=>{exited=true;resolve({code,signal})}));child.stderr.on('data',chunk=>{error+=chunk});child.stdout.on('data',chunk=>{bytes=Buffer.concat([bytes,chunk]);while(bytes.length>=4){const length=bytes.readUInt32LE(0);if(!length||length>1048576)throw Error('native framing corruption');if(bytes.length<length+4)break;const frame=JSON.parse(bytes.subarray(4,length+4));frames.push(frame);bytes=bytes.subarray(length+4);if(frame.type==='ready')readyResolve();}});
 const failTimer=setTimeout(()=>{if(!exited)child.kill();},20000);
 try {
  if(stage==='pending-event'){await Promise.race([ready,exit.then(value=>{throw Error('exited before ready '+JSON.stringify(value)+' '+error)})]);}
  const started=performance.now();child.stdin.end();const result=await exit;const elapsedMs=performance.now()-started;await writeFile(join(output,stage+'.log'),error);await writeFile(join(output,stage+'-observation.json'),JSON.stringify({stage,epoch,elapsedMs,exit:result,frames,error},null,2));if(result.code===0||result.signal)throw Error('EOF must be failed/cancelled ownership, not successful disposal: '+JSON.stringify(result));if(elapsedMs>=5000)throw Error('EOF owner stop exceeded5s: '+elapsedMs);
  const closed=frames.find(frame=>frame.type==='closed');if(!closed||closed.pendingEventReads!==0||closed.epoch!==epoch)throw Error('no closed pending0 receipt: '+error);
  if(stage==='pending-event'&&!error.includes('revision=0; pending=0; handles=0'))throw Error('pending EOF failed no-commit/resource proof: '+error);
  await writeFile(join(output,stage+'.log'),error);receipts.push({stage,epoch,pid:child.pid,profile,elapsedMs,exit:result,closed,ready:frames.some(f=>f.type==='ready'),noCommit:stage==='pending-event'});
 }finally{clearTimeout(failTimer);if(!exited){child.kill();await exit;}}
}
const receipt={schemaVersion:1,adapter:'production Tao/Wry/Wasmtime48 native backend pipe EOF; no debug port',executableSha256:exeHash,componentSha256:hash,instances:receipts};await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
