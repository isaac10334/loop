// Real evaluated-config -> CLI -> pinned public browser modules -> Chrome acceptance.
// Usage: node tooling/host-browser/cli-chrome.mjs <fresh loop.exe> <prepared project root>
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, cp } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [cliArg, rootArg, mode = 'ts'] = process.argv.slice(2);
const components = mode === 'components', buttonLabel = components ? 'Replace document' : 'Next greeting';
if (!cliArg || !rootArg) throw Error('Pass a freshly built CLI and explicitly prepared project root');
const cli = resolve(cliArg), root = resolve(rootArg), output = resolve('target/host-browser-cli',String(Date.now()));
await mkdir(output,{recursive:true});
const children = [], consoleErrors = [], pageErrors = [], launchLogs = [], failedRequests = [];
const run = async args => { const child=spawn(cli,args,{stdio:['ignore','pipe','pipe']}); let stdout='',stderr='';child.stdout.on('data',b=>stdout=(stdout+b).slice(-1048576));child.stderr.on('data',b=>stderr=(stderr+b).slice(-1048576));const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});if(code!==0)throw Error(`CLI ${args.join(' ')} exit${code}: ${stderr}\n${stdout}`);return {code,stdout,stderr}; };
async function launch(instance, operation='run', previousEpoch) {
 const args=operation==='restart'?['restart',instance,'--root',root,'--trust-local-config','--json']:['run',root,'--config','loop.config.ts','--target','web','--instance',instance,'--trust-local-config','--json'];
 const child=spawn(cli,args,{stdio:['ignore','pipe','pipe']});children.push(child);
 const log={instance,stdout:'',stderr:''};launchLogs.push(log);child.stdout.on('data',b=>log.stdout=(log.stdout+b).slice(-1048576));child.stderr.on('data',b=>log.stderr=(log.stderr+b).slice(-1048576));
 child.completion=new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
 const end=Date.now()+30000;
 while(Date.now()<end){try{for(const epoch of await readdir(join(root,'.loop/instances/web',instance))){const file=join(root,'.loop/instances/web',instance,epoch,'launch.json');const record=JSON.parse(await readFile(file,'utf8'));if(record.epoch!==previousEpoch&&['awaiting-browser','active'].includes(record.state))return {child,record,file};}}catch{} if(child.exitCode!==null)throw Error(`Launch exited ${child.exitCode}: ${log.stderr}`);await new Promise(r=>setTimeout(r,50));}
 throw Error('Timed out waiting for explicit instance endpoint');
}
const installed=process.env.PLAYWRIGHT_MODULE??'C:/Users/ijhar/Desktop/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(installed).href);
await mkdir(join(output,'tmp'),{recursive:true});process.env.TEMP=join(output,'tmp');process.env.TMP=join(output,'tmp');
const context=await chromium.launchPersistentContext(join(output,'profile'),{executablePath:process.env.CHROME_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:join(output,'tmp'),args:['--no-first-run','--no-default-browser-check','--disable-background-networking']});
const receipt={cli,cliSha256:createHash('sha256').update(await readFile(cli)).digest('hex'),root,output,mode,browser:context.browser()?.version(),tests:[],consoleErrors,pageErrors,failedRequests,launchLogs};
const instances=[]; let staticServer;
try{
 const evaluation=await run(['inspect',root,'--evaluate-config','--config','loop.config.ts','--target','web','--trust-local-config','--json']);
 const plan=JSON.parse(evaluation.stdout).result;receipt.plan={planId:plan.planId,kit:plan.kit,profile:plan.profile,application:plan.application,modules:plan.inputs.modules};
 if(!/^[a-f0-9]{64}$/.test(plan.planId)||plan.inputs.modules.some(m=>!/^[a-f0-9]{64}$/.test(m.sha256)))throw Error('Evaluation did not produce actual pinned plan');
 const built=await run(['build',root,'--config','loop.config.ts','--target','web','--trust-local-config','--json']);receipt.build=JSON.parse(built.stdout).result;
 const relocated=join(output,'relocated-static');await cp(join(root,'dist/web'),relocated,{recursive:true});
 staticServer=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const name=path==='/'?'index.html':path.slice(1);if(!['index.html','app.js','component-worker.js'].includes(name)){res.writeHead(404);res.end();return;}try{const bytes=await readFile(join(relocated,name));res.writeHead(200,{'content-type':name.endsWith('.js')?'application/javascript':'text/html'});res.end(bytes);}catch{res.writeHead(404);res.end();}});await new Promise(resolve=>staticServer.listen(0,'127.0.0.1',resolve));
 const staticPage=await context.newPage();staticPage.on('pageerror',e=>pageErrors.push(String(e)));staticPage.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});await staticPage.goto(`http://127.0.0.1:${staticServer.address().port}`);await staticPage.getByRole('button',{name:buttonLabel,exact:true}).click();await staticPage.waitForFunction(components=>{const text=document.querySelector('[data-loop-key="greeting"]')?.textContent;return components?text?.includes('component-1 world'):text?.endsWith(': 2');},components);receipt.tests.push({name:'evaluated-cli-relocated-static-build-interaction',root:relocated,greeting:await staticPage.locator('[data-loop-key="greeting"]').textContent()});await staticPage.close();
 const stamp=Date.now().toString(36),idA=`chrome-a-${stamp}`,idB=`chrome-b-${stamp}`;instances.push(idA,idB);
 const a=await launch(idA),b=await launch(idB);receipt.launches=[a.record,b.record];
 const pages=[];for(const item of [a,b]){const page=await context.newPage();pages.push(page);page.on('pageerror',e=>pageErrors.push(String(e)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});const ready=page.waitForResponse(response=>new URL(response.url()).pathname==='/__loop/ready'&&response.request().method()==='POST');await page.goto(item.record.endpoint);const reply=await ready;if(!reply.ok())throw Error(`Browser readiness failed: ${reply.status()}`);await page.getByRole('button',{name:buttonLabel,exact:true}).waitFor();await page.waitForFunction(async()=> (await(await fetch('/__loop/state')).json()).state==='active');}
 const [pa,pb]=pages;
 const beforeA=await pa.locator('[data-loop-key="greeting"]').textContent(),beforeB=await pb.locator('[data-loop-key="greeting"]').textContent();
 await pa.getByRole('button',{name:buttonLabel,exact:true}).click();await pb.getByRole('button',{name:buttonLabel,exact:true}).focus();await pb.keyboard.press('Enter');
 await pa.waitForFunction(old=>document.querySelector('[data-loop-key="greeting"]')?.textContent!==old,beforeA);await pb.waitForFunction(old=>document.querySelector('[data-loop-key="greeting"]')?.textContent!==old,beforeB);
 const bBeforeStop=await pb.locator('[data-loop-key="greeting"]').textContent();
 await run(['stop',idA,'--root',root,'--json']);if(await a.child.completion!==0)throw Error('A launch did not join with exit0');
 if(await pa.locator('#app').textContent()!=='')throw Error('A DOM not disposed before stop acknowledged');
 if(components){receipt.componentCleanupA=await pa.evaluate(()=>globalThis.componentReceipt);if(receipt.componentCleanupA.session.workers!==0||receipt.componentCleanupA.session.pendingHostCalls!==0||receipt.componentCleanupA.document.liveGrants!==0)throw Error('A component resources not drained before stop acknowledged');}
 await pb.getByRole('button',{name:buttonLabel,exact:true}).click();await pb.waitForFunction(old=>document.querySelector('[data-loop-key="greeting"]')?.textContent!==old,bBeforeStop);
 receipt.tests.push({name:'actual-evaluated-pinned-plan-two-launches-stopA-leavesB',planId:plan.planId,origins:[a.record.endpoint,b.record.endpoint],beforeA,beforeB,afterStopB:await pb.locator('[data-loop-key="greeting"]').textContent(),aStopped:JSON.parse(await readFile(a.file,'utf8')),bActive:JSON.parse(await readFile(b.file,'utf8'))});
 await pb.screenshot({path:join(output,'actual-cli.png')});
 const restarted=await launch(idA,'restart',a.record.epoch);const pr=await context.newPage();pr.on('pageerror',e=>pageErrors.push(String(e)));pr.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});pr.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));const restartedReady=pr.waitForResponse(response=>new URL(response.url()).pathname==='/__loop/ready'&&response.request().method()==='POST');await pr.goto(restarted.record.endpoint);const restartedReply=await restartedReady;if(!restartedReply.ok())throw Error(`Restart readiness failed: ${restartedReply.status()}`);await pr.getByRole('button',{name:buttonLabel,exact:true}).waitFor();await pr.waitForFunction(async()=> (await(await fetch('/__loop/state')).json()).state==='active');
 if(restarted.record.epoch===a.record.epoch)throw Error('Restart reused epoch');
 receipt.tests.push({name:'restart-fresh-epoch-host-state',oldEpoch:a.record.epoch,newEpoch:restarted.record.epoch,initial:await pr.locator('[data-loop-key="greeting"]').textContent(),bStillActive:JSON.parse(await readFile(b.file,'utf8')).state});
 await run(['stop',idA,'--root',root,'--json']);if(await restarted.child.completion!==0)throw Error('Restarted A did not join');
 await run(['stop',idB,'--root',root,'--json']);if(await b.child.completion!==0)throw Error('B launch did not join with exit0');
 if(pageErrors.length||consoleErrors.length)throw Error('Browser errors in actual CLI launch');receipt.passed=true;
}catch(error){receipt.failure={message:String(error),stack:error.stack};process.exitCode=1;}
finally{for(const instance of instances){try{await run(['stop',instance,'--root',root,'--json']);}catch{}}for(const child of children){if(child.exitCode===null)child.kill();}await context.close();if(staticServer)await new Promise(resolve=>staticServer.close(resolve));receipt.cleanup={allOwnedLaunchesExited:children.every(c=>c.exitCode!==null),chromeContextClosed:true};await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));}
