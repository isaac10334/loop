import {test,expect} from 'bun:test';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
const verifier=resolve('tooling/host-kit-verification/same-byte-headless.ts');
async function run(args:string[]){const child=Bun.spawn([process.execPath,verifier,...args],{stdout:'pipe',stderr:'pipe'});const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);return {stdout,stderr,code};}
test('same-byte verifier refuses missing arguments',async()=>{const result=await run([]);expect(result.code).not.toBe(0);expect(result.stderr).toContain('Usage:');});
test('same-byte verifier rejects a mismatched native artifact before running Cargo',async()=>{
 const root=await mkdtemp(join(tmpdir(),'loop-same-byte-test-'));if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected temporary root');
 try{
  const artifacts=join(root,'artifacts'),browser=join(root,'browser'),staticDir=join(browser,'relocated-static');await mkdir(artifacts);await mkdir(staticDir,{recursive:true});
  const bytes=Buffer.from('browser-component'),base64=bytes.toString('base64'),hash=new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),native=Buffer.from('different-component'),nativeHash=new Bun.CryptoHasher('sha256').update(native).digest('hex');
  const fixture=join(root,'artifact.ts');await writeFile(fixture,`export const componentBase64=${JSON.stringify(base64)};export const artifact=${JSON.stringify({sha256:hash,worldDigest:'sha256:world'})};`);
  await writeFile(join(staticDir,'app.js'),base64+hash);
  const manifest=[];for(const name of ['loop_document_guest.wasm','v2.wasm','semantic.wasm','runaway.wasm','budget.wasm','lifecycle.wasm']){await writeFile(join(artifacts,name),native);manifest.push({artifact:name,sha256:nativeHash,worldDigest:'sha256:world'});}
  await writeFile(join(artifacts,'receipt.json'),JSON.stringify({receipts:manifest}));
  const browserReceipt=join(root,'browser.json');await writeFile(browserReceipt,JSON.stringify({output:browser,passed:true,cleanup:{allOwnedLaunchesExited:true,chromeContextClosed:true},tests:[{name:'evaluated-cli-relocated-static-build-interaction'},{name:'actual-evaluated-pinned-plan-two-launches-stopA-leavesB'}]}));
  const output=join(root,'out.json'),result=await run([fixture,browserReceipt,artifacts,output]);expect(result.code).not.toBe(0);expect(result.stderr).toContain('nativeDigestMatches');expect(await Bun.file(output).exists()).toBe(false);
 }finally{await rm(root,{recursive:true,force:true});}
});
