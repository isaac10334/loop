/** Trusted-local evidence gate: connect a prior browser CLI receipt to actual Wasmtime fixture tests. */
import {writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const [moduleArg,browserArg,artifactsArg,outputArg]=process.argv.slice(2);
if(!moduleArg||!browserArg||!artifactsArg||!outputArg)throw Error('Usage: bun same-byte-headless.ts <trusted-fixture-artifact.ts> <browser-receipt.json> <artifact-dir> <new-receipt.json>');
const modulePath=resolve(moduleArg),browserPath=resolve(browserArg),artifacts=resolve(artifactsArg),output=resolve(outputArg);
if(await Bun.file(output).exists())throw Error('Receipt destination already exists');
// The fixture module is trusted local code; importing it is not static inspection.
const fixture=await import(pathToFileURL(modulePath).href);
if(typeof fixture.componentBase64!=='string'||typeof fixture.artifact?.sha256!=='string')throw Error('Invalid fixture artifact module');
const component=Buffer.from(fixture.componentBase64,'base64');
const hash=(data:Uint8Array)=>new Bun.CryptoHasher('sha256').update(data).digest('hex');
const componentSha256=hash(component),browser=await Bun.file(browserPath).json();
const relocatedBundle=join(browser.output,'relocated-static','app.js'),bundle=await Bun.file(relocatedBundle).text();
const manifest=await Bun.file(join(artifacts,'receipt.json')).json() as {receipts:{artifact:string;sha256:string;worldDigest:string}[]};
const hashes=await Promise.all(manifest.receipts.map(async item=>({...item,actualSha256:hash(await Bun.file(join(artifacts,item.artifact)).bytes())})));
const native=hashes.find(item=>item.artifact==='loop_document_guest.wasm');
const browserChecks=Array.isArray(browser.tests)?browser.tests.map((test:{name:string})=>test.name):[];
const preconditions={browserReceiptPassed:browser.passed===true&&browser.cleanup?.allOwnedLaunchesExited===true&&browser.cleanup?.chromeContextClosed===true,
 browserInteractionRecorded:browserChecks.includes('evaluated-cli-relocated-static-build-interaction')&&browserChecks.includes('actual-evaluated-pinned-plan-two-launches-stopA-leavesB'),
 browserBundleContainsExactPayload:bundle.includes(fixture.componentBase64)&&bundle.includes(componentSha256),
 fixtureDigestMatches:componentSha256===fixture.artifact.sha256,nativeDigestMatches:componentSha256===native?.actualSha256,
 worldMatches:fixture.artifact.worldDigest===native?.worldDigest,allFixtureDigestsMatch:hashes.length===6&&hashes.every(item=>item.actualSha256===item.sha256)};
if(Object.values(preconditions).some(value=>!value))throw Error('Browser/native artifact linkage preconditions failed: '+JSON.stringify(preconditions));
const env={...process.env,LOOP_DOCUMENT_ARTIFACT_DIR:artifacts};
const child=Bun.spawn(['cargo','test','--locked','-p','loop-host','--all-features','-j','2','--','--nocapture'],{env,stdout:'pipe',stderr:'pipe'});
const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
const hostPassCount=Number(stdout.match(/test result: ok\. (\d+) passed; 0 failed/)?.[1]??0);
const testChecks={exitSuccess:code===0,allHostTestsPassed:hostPassCount>=27,
 actualGuestRan:stdout.includes('current_component_async_and_runaway_isolation ... ok')&&stderr.includes('MEASURED native runaway fuel stop'),
 canonicalBudgetRan:stderr.includes('CANONICAL_BUDGET mode=oversized-invalid')&&stderr.includes('CANONICAL_BUDGET mode=oversized-result'),
 lifetimeRan:stderr.includes('LIFETIME retained borrowed handle'),noSkipMarker:!stderr.includes('SKIP real Component')};
const passed=Object.values(testChecks).every(Boolean);
const receipt={gate:'same-byte-headless-browser-receipt-and-native-tests',componentSha256,worldDigest:native?.worldDigest,componentBytes:component.length,modulePath,browserPath,relocatedBundle,browserCliSha256:browser.cliSha256,artifacts,hashes,preconditions,testChecks,nativeTests:{command:'cargo test --locked -p loop-host --all-features -j 2 -- --nocapture',code,stdout,stderr},passed,
 limits:['Trusted local fixture module is executed to read its artifact exports; receipt and bundle are local evidence','Browser evidence is a prior headless CLI run with a pretranslated plan; this does not prove pre-lift aggregate budget enforcement','Native evidence is Wasmtime host tests, not native CLI/window interaction or a full cross-host UI gate','Same SHA-256 links artifact bytes; no publication or installation is implied']};
await writeFile(output,JSON.stringify(receipt,null,2),{flag:'wx'});
console.log(JSON.stringify({gate:receipt.gate,componentSha256,componentBytes:component.length,preconditions,testChecks,passed,output,limits:receipt.limits},null,2));
if(!passed)process.exitCode=1;
