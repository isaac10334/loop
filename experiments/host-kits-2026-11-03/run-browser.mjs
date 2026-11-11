// Local, unshippable test runner. Uses only the installed Playwright public root export.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const root=process.cwd();
const artifact=process.argv[2]??'guest/target/wasm32-wasip2/release/async_document_guest.wasm';
const suffix=process.argv[3]??'';
const expectedPrefix=process.argv[4]??'';
const { createHash }=await import('node:crypto');
await mkdir(root+'/browser-tmp',{recursive:true});
process.env.TEMP=root+'/browser-tmp';process.env.TMP=root+'/browser-tmp';
const { chromium }=await import('file:///C:/Users/ijhar/Desktop/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs');
const context=await chromium.launchPersistentContext(root+'/browser-profile',{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:root+'/browser-tmp',args:['--no-first-run','--no-default-browser-check','--disable-background-networking']});
const errors=[],consoleLines=[];
let receipt;
try {
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>consoleLines.push(m.type()+': '+m.text()));
 await page.goto(pathToFileURL(root+'/browser.html').href);await page.addScriptTag({path:root+'/browser.bundle.js',type:'module'});await page.waitForFunction(()=>typeof window.bootProbe==='function');
 const component=await readFile(root+'/'+artifact);
 const input={component:component.toString('base64'),translator:(await readFile('C:/Users/ijhar/Desktop/station/node_modules/@polyengine/translator/esm/translator_shim.wasm')).toString('base64'),sha256:createHash('sha256').update(component).digest('hex'),expectedPrefix};
 console.log('Chrome actual version: '+context.browser()?.version());console.log('boot',await page.evaluate(input=>window.bootProbe(input),input));
 await page.locator('#replacement').fill('browser');await page.locator('#run').click();await page.waitForFunction(()=>window.receipt?.done,{},{timeout:20000});
 receipt=await page.evaluate(()=>window.receipt);receipt.pageErrors=errors;receipt.console=consoleLines;receipt.renderedOutput=await page.locator('#output').textContent();await page.screenshot({path:root+'/browser-result'+suffix+'.png'});await writeFile(root+'/browser-receipt'+suffix+'.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
 if(receipt.failure||errors.length)process.exitCode=1;
} finally { await context.close();console.log('CLEANUP isolated Chrome context/process closed'); }
