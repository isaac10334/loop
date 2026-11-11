import {resolve} from 'node:path';
const root=process.cwd();const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const expected={
 'artifacts/document-v1.wasm':'9b459aba2977774a5c119898bee6a82884f61e9299ca44d43141468aeaffe88b',
 'artifacts/document-v2.wasm':'4f93cbd53f2303634b1fdd62f8d1d2bad50c0bac7a5226bc89b4810a4458c9a1',
 'artifacts/document-semantic.wasm':'e8a5aa7730b6060d6b00cbbffade98e68588b76619365ba220567ae048b3af3d',
};
for(const [path,digest]of Object.entries(expected)){assert(new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')===digest,'immutable artifact changed '+path);}
for(const name of ['browser-receipt.json','browser-receipt-v2.json','semantic-browser-receipt.json']){const r=await Bun.file(name).json();assert(r.done&&!r.failure&&!r.pageErrors.length,'browser receipt failed '+name);assert(!r.deniedRuntimeCalls.length,'runtime denial unexpectedly invoked');}
const desktop=await Bun.file('desktop-receipt.json').json(),ui=await Bun.file('desktop-ui-receipt.json').json();assert(desktop.closed&&desktop.workerJoined&&desktop.pendingEventReads===0,'desktop close/join failed');assert(ui.renderedOutput==='semantic world'&&!ui.pageErrors.length,'desktop real rendered output failed');assert(ui.componentSha256===expected['artifacts/document-semantic.wasm'],'desktop same bytes mismatch');
const a=new Bun.CryptoHasher('sha256').update(await Bun.file('semantic-guest/wit/deps/ui/surfaces.wit').arrayBuffer()).digest('hex'),b=new Bun.CryptoHasher('sha256').update(await Bun.file('C:/src/ilt/loop/packages/ui/wit/surfaces.wit').arrayBuffer()).digest('hex');assert(a===b,'public UI WIT provenance mismatch');
const text=await Bun.file('README.md').text();let links=0;for(const match of text.matchAll(/\]\(([^)]+)\)/g)){const target=match[1].replace(/^<|>$/g,'').split('#')[0];if(!target||/^https?:/.test(target))continue;assert(await Bun.file(resolve(root,target)).exists(),'missing receipt link '+target);links++;}
const inventory=await Bun.file('inventory.json').json();assert(inventory.files.some((f:any)=>f.path==='guest/src/lib.rs')&&inventory.files.some((f:any)=>f.path==='native/src/desktop.rs')&&inventory.files.some((f:any)=>f.path==='browser.bundle.js'),'incomplete source inventory');
console.log('PASS immutable3 artifacts, all current browser receipts, real desktop output+close/join, public UI WIT provenance, '+links+' README links and source inventory');
