/** Offline trusted-local skill transactions. No config imports, network, or implicit roots. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
export const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export type Inventory = { path: string; bytes: number; sha256: string }[];
export interface Entry { id: string; version: string; description: string; compatibility: {managerSchema:number;catalogSchema:number;adapters:Record<string,number>}; source:{kind:string;relativeRoot:string}; digest:{algorithm:string;value:string}; inventory:Inventory; destinations:string[] }
export interface Bundle { schemaVersion:number; entries:Entry[]; files:Record<string,Uint8Array> }
export interface Request { operation:'list'|'inspect'|'install'|'update'|'remove'|'recover'; id?:string; scope?:'project'|'user'; root?:string; adapter?:string; version?:string; write?:boolean; dryRun?:boolean; planDigest?:string }
export interface Result { schemaVersion:1; operation:string; request:Request; status:string; applied:boolean; actions:unknown[]; conflicts:string[]; recovery:string|null; [key:string]:unknown }
function fail(message:string):never { throw new Error(message); }
export function portable(value:string):string {
 if (!value || value.includes('\\') || value.startsWith('/') || value.includes(':') || value.includes('\0')) fail('E_SKILL_PATH');
 for(const part of value.split('/')) if(!part || part==='.' || part==='..' || /[. ]$/.test(part) || /[<>"|?*\x00-\x1f]/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)) fail('E_SKILL_PATH');
 return value;
}
const digest = (inventory:Inventory) => hash('loop-skill-v1\n'+inventory.map(f=>`${f.path}\0${f.bytes}\0${f.sha256}\n`).join(''));
function noLinks(target:string) {
 const absolute=path.resolve(target), parsed=path.parse(absolute); let current=parsed.root;
 for(const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
  portable(part);
  if(fs.existsSync(current)) { const siblings=fs.readdirSync(current); const aliases=siblings.filter(n=>n.toLowerCase()===part.toLowerCase()); if(aliases.some(n=>n!==part)) fail('E_SKILL_CASE_ALIAS'); }
  current=path.join(current,part);
  try { const s=fs.lstatSync(current); if(s.isSymbolicLink()) fail('E_SKILL_LINK'); } catch(e:any) { if(e.code==='ENOENT') break; throw e; }
 }
}
function readJson(file:string):any { noLinks(file); return JSON.parse(fs.readFileSync(file,'utf8')); }
function tree(root:string, allowedEmpty?:Set<string>):Inventory {
 noLinks(root); if(!fs.existsSync(root)) return [];
 if(!fs.lstatSync(root).isDirectory()) fail('E_SKILL_TYPE');
 const result:Inventory=[]; const folded=new Set<string>();
 function visit(dir:string,prefix:string) { for(const name of fs.readdirSync(dir).sort()) { const rel=portable(prefix+name); if(folded.has(rel.toLowerCase())) fail('E_SKILL_CASE_ALIAS'); folded.add(rel.toLowerCase()); const file=path.join(dir,name); noLinks(file); const s=fs.lstatSync(file); if(s.isDirectory()) { const children=fs.readdirSync(file); if(!children.length && !allowedEmpty?.has(rel)) fail('E_SKILL_UNKNOWN_DIRECTORY'); visit(file,rel+'/'); } else if(s.isFile()) { const bytes=fs.readFileSync(file); result.push({path:rel,bytes:bytes.length,sha256:hash(bytes)}); } else fail('E_SKILL_TYPE'); } }
 visit(root,''); return result.sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function validateBundle(bundle:Bundle) {
 if(bundle.schemaVersion!==1 || !Array.isArray(bundle.entries)) fail('E_SKILL_CATALOG'); const ids=new Set<string>();
 for(const e of bundle.entries) { portable(e.id); if(e.id.includes('/') || ids.has(e.id.toLowerCase())) fail('E_SKILL_ID'); ids.add(e.id.toLowerCase()); portable(e.source.relativeRoot);
 if(e.source.kind!=='bundled'||e.compatibility.managerSchema!==1||e.compatibility.catalogSchema!==1||e.digest.algorithm!=='sha256') fail('E_SKILL_COMPATIBILITY');
 const names=new Set<string>(); let previous=''; for(const f of e.inventory) { portable(f.path); if(names.has(f.path.toLowerCase()) || (previous && Buffer.compare(Buffer.from(previous),Buffer.from(f.path))>=0)) fail('E_SKILL_INVENTORY'); names.add(f.path.toLowerCase()); previous=f.path; const bytes=bundle.files[e.source.relativeRoot+'/'+f.path]; if(!bytes || bytes.length!==f.bytes || hash(bytes)!==f.sha256) fail('E_SKILL_PAYLOAD'); }
 if(digest(e.inventory)!==e.digest.value) fail('E_SKILL_DIGEST');
 const keys=Object.keys(bundle.files).filter(k=>k.startsWith(e.source.relativeRoot+'/')).map(k=>k.slice(e.source.relativeRoot.length+1)).sort(); if(!equal(keys,e.inventory.map(f=>f.path).sort())) fail('E_SKILL_INVENTORY');
 }
}
interface Receipt { owner:'loop-skills-v1'; id:string; version:string; adapter:string; root:string; digest:string; inventory:Inventory; createdDirectories:string[] }
interface Journal { owner:'loop-skills-v1'; id:string; root:string; before:Receipt|null; after:Receipt|null }
/** Apply revalidates whole-tree digest under exclusive lock. Detected same-user races fail; this is not a sandbox. */
export function manage(bundle:Bundle, request:Request, hooks:{fault?:(phase:string)=>void}={}):Result {
 const result:Result={schemaVersion:1,operation:request.operation,request,status:'error',applied:false,actions:[],conflicts:[],recovery:null};
 try {
 validateBundle(bundle); if(request.write && request.dryRun) fail('E_SKILL_FLAGS');
 if(request.operation==='list') { if(request.write) fail('E_SKILL_FLAGS'); return {...result,status:'ok',entries:bundle.entries.map(({id,version,description,digest})=>({id,version,description,digest}))}; }
 const entry=bundle.entries.find(e=>e.id===request.id); if(!entry) fail('E_SKILL_ID');
 if(request.version && request.version!==entry.version) fail('E_SKILL_VERSION');
 if(request.adapter!=='codex-v1'||!entry.destinations.includes(request.adapter)||entry.compatibility.adapters[request.adapter]!==1) fail('E_SKILL_ADAPTER');
 if(!request.root || !['project','user'].includes(request.scope!)) fail('E_SKILL_ROOT');
 const selectedRoot=path.resolve(request.root); noLinks(selectedRoot); if(!fs.existsSync(selectedRoot)||!fs.statSync(selectedRoot).isDirectory()) fail('E_SKILL_ROOT');
 const root=fs.realpathSync(selectedRoot); noLinks(root);
 const parent=path.join(root,request.scope==='project'?'.agents/skills':'skills');
 const state=path.join(parent,'.loop-skill-state'); const destination=path.join(parent,entry.id);
 const receiptPath=path.join(state,entry.id+'.json'), journalPath=path.join(state,entry.id+'.journal.json');
 const stage=path.join(state,entry.id+'.stage'), backup=path.join(state,entry.id+'.backup'), lock=path.join(state,entry.id+'.lock');
 const next=receiptPath+'.next';
 [parent,state,destination,receiptPath,journalPath,stage,backup,lock,next].forEach(noLinks);
 Object.assign(result,{destination,stateRoot:state,catalogDigest:hash(JSON.stringify(bundle.entries)),payloadDigest:entry.digest.value,backend:'trusted-local; file fsync, no directory fsync guarantee'});
 const receipt:Receipt|null=fs.existsSync(receiptPath)?readJson(receiptPath):null;
 function valid(r:any):asserts r is Receipt { if(!r||r.owner!=='loop-skills-v1'||r.id!==entry!.id||r.root!==root||r.adapter!==request.adapter||!Array.isArray(r.inventory)||!Array.isArray(r.createdDirectories)||digest(r.inventory)!==r.digest) fail('E_SKILL_RECEIPT'); r.createdDirectories.forEach((d:any)=>portable(d)); const seen=new Set<string>(); r.inventory.forEach((f:any)=>{portable(f.path); if(seen.has(f.path.toLowerCase())||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256)) fail('E_SKILL_RECEIPT'); seen.add(f.path.toLowerCase());}); }
 if(receipt) valid(receipt);
 if(fs.existsSync(journalPath) && request.operation!=='recover') return {...result,status:'recovery-needed',recovery:'explicit recover --write required',conflicts:['E_SKILL_RECOVERY']};
 let deadLock=false; let deadOwner:unknown;
 if(fs.existsSync(lock)) {
 const owner=readJson(lock); if(owner.owner!=='loop-skills-v1'||owner.root!==root||owner.id!==entry.id||!Number.isSafeInteger(owner.pid)||owner.pid<=0) fail('E_SKILL_LOCK');
 try { process.kill(owner.pid,0); fail('E_SKILL_BUSY'); } catch(e:any) {if(e.code!=='ESRCH') throw e;}
 if(request.operation!=='recover') fail('E_SKILL_RECOVERY'); deadLock=true; deadOwner=owner;
 }
 function acquire() {
 const gate=lock+'.recovery'; let gateFd:number|undefined;
 try {
 if(deadLock) {noLinks(gate);gateFd=fs.openSync(gate,'wx');noLinks(lock);if(!equal(readJson(lock),deadOwner))fail('E_SKILL_STALE_PLAN');fs.unlinkSync(lock);}
 const fd=fs.openSync(lock,'wx');try{fs.writeFileSync(fd,JSON.stringify({owner:'loop-skills-v1',root,id:entry!.id,pid:process.pid}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 } finally {if(gateFd!==undefined){fs.closeSync(gateFd);fs.unlinkSync(gate);}}
 }
 const current=tree(destination); const exists=fs.existsSync(destination);
 if(request.operation!=='recover') {
 if(exists&&!receipt) fail('E_SKILL_UNMANAGED'); if(receipt&&(!exists||!equal(current,receipt.inventory))) fail('E_SKILL_LOCAL_EDITS');
 if(fs.existsSync(stage)||fs.existsSync(backup)||fs.existsSync(next)) fail('E_SKILL_RECOVERY');
 }
 if(request.operation==='inspect') return {...result,status:receipt?'installed':'absent',installed:receipt};
 if(request.operation==='recover') {
 if(!fs.existsSync(journalPath)) return {...result,status:'absent'};
 const j:Journal=readJson(journalPath); if(j.owner!=='loop-skills-v1'||j.id!==entry.id||j.root!==root) fail('E_SKILL_JOURNAL'); if(j.before) valid(j.before); if(j.after) valid(j.after);
 // Receipt is the commit point. Before commit restore the old generation; after it only clean verified remnants.
 if(fs.existsSync(next)&&!equal(readJson(next),j.after)) fail('E_SKILL_RECOVERY_CONTENT');
 const committed=equal(receipt,j.after); const target=committed?j.after:j.before;
 const stageDirs=new Set((j.after?.inventory??[]).flatMap(f=>f.path.split('/').slice(0,-1).map((_,i)=>f.path.split('/').slice(0,i+1).join('/'))));
 const backupDirs=new Set((j.before?.inventory??[]).flatMap(f=>f.path.split('/').slice(0,-1).map((_,i)=>f.path.split('/').slice(0,i+1).join('/'))));
 if(fs.existsSync(backup)&&(!j.before||(committed?tree(backup,backupDirs).some(f=>!j.before!.inventory.some(expected=>equal(f,expected))):!equal(tree(backup),j.before.inventory)))) fail('E_SKILL_RECOVERY_CONTENT');
 if(fs.existsSync(stage)&&(!j.after||tree(stage,stageDirs).some(f=>!j.after!.inventory.some(expected=>equal(f,expected))))) fail('E_SKILL_RECOVERY_CONTENT');
 if(exists && ![j.before,j.after].some(r=>r&&equal(current,r.inventory))) fail('E_SKILL_RECOVERY_CONTENT');
 if(target&&!exists&&!fs.existsSync(backup)&&!fs.existsSync(stage)) fail('E_SKILL_RECOVERY_CONTENT');
 result.status='planned'; result.recovery=committed?'cleanup':'rollback'; result.actions=[{kind:result.recovery}];
 if(!request.write) return result;
 const recoverySnapshot=JSON.stringify({destination:tree(destination),backup:tree(backup,committed?backupDirs:undefined),stage:tree(stage,stageDirs),receipt:fs.existsSync(receiptPath)?readJson(receiptPath):null,journal:readJson(journalPath)});
 acquire(); try {
 [destination,backup,stage,receiptPath,journalPath,next].forEach(noLinks);
 if(recoverySnapshot!==JSON.stringify({destination:tree(destination),backup:tree(backup,committed?backupDirs:undefined),stage:tree(stage,stageDirs),receipt:fs.existsSync(receiptPath)?readJson(receiptPath):null,journal:readJson(journalPath)})) fail('E_SKILL_STALE_PLAN');
 if(!committed) { if(exists && (!j.before||!equal(current,j.before.inventory))) fs.rmSync(destination,{recursive:true}); if(j.before&&!fs.existsSync(destination)) fs.renameSync(backup,destination); }
 if(committed && j.after && !fs.existsSync(destination)) fail('E_SKILL_RECOVERY_CONTENT');
 for(const dir of [stage,backup]) if(fs.existsSync(dir)) fs.rmSync(dir,{recursive:true}); if(fs.existsSync(next)) fs.unlinkSync(next); fs.unlinkSync(journalPath);
 return {...result,status:'recovered',applied:true,recovery:null};
 } finally { fs.unlinkSync(lock); }
 }
 const removing=request.operation==='remove';
 if(!['install','update','remove'].includes(request.operation)) fail('E_SKILL_OPERATION');
 if(request.operation==='update'&&!receipt) fail('E_SKILL_NOT_INSTALLED');
 const destinationRelative=path.relative(root,destination).split(path.sep).join('/');
 const createdDirectories=[...new Set([...(receipt?.createdDirectories??[]),...[path.dirname(parent),parent,state].filter(dir=>dir!==root&&!fs.existsSync(dir)).map(dir=>path.relative(root,dir).split(path.sep).join('/')),destinationRelative,...entry.inventory.flatMap(f=>f.path.split('/').slice(0,-1).map((_,i)=>destinationRelative+'/'+f.path.split('/').slice(0,i+1).join('/')))])].sort();
 const after:Receipt|null=removing?null:{owner:'loop-skills-v1',id:entry.id,version:entry.version,adapter:request.adapter,root,digest:entry.digest.value,inventory:entry.inventory,createdDirectories};
 const files=new Set([...current.map(f=>f.path),...(after?.inventory??[]).map(f=>f.path)]);
 result.actions=[...files].sort().map(file=>({path:file,before:current.find(f=>f.path===file)?.sha256??null,after:after?.inventory.find(f=>f.path===file)?.sha256??null}));
 const planDigest=hash(JSON.stringify({root,destination,before:receipt,after,current})); Object.assign(result,{planDigest}); result.status='planned';
 if(request.planDigest&&request.planDigest!==planDigest) fail('E_SKILL_STALE_PLAN');
 if(removing&&!receipt) return {...result,status:'absent',actions:[]};
 if(!removing&&receipt&&receipt.digest===entry.digest.value&&receipt.version===entry.version) return {...result,status:'unchanged',actions:[]};
 if(!request.write) return result;
 fs.mkdirSync(state,{recursive:true}); noLinks(state); acquire();
 const durable=(file:string,data:unknown)=>{ const fd=fs.openSync(file,'wx'); try {fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd);} finally {fs.closeSync(fd);} };
 try {
 [destination,state,stage,backup].forEach(noLinks); if(!equal(tree(destination),current)||fs.existsSync(destination)!==exists||!equal(fs.existsSync(receiptPath)?readJson(receiptPath):null,receipt)) fail('E_SKILL_STALE_PLAN');
 durable(journalPath,{owner:'loop-skills-v1',id:entry.id,root,before:receipt,after}); hooks.fault?.('journal');
 if(after) { fs.mkdirSync(stage); for(const f of entry.inventory) { const file=path.join(stage,f.path); fs.mkdirSync(path.dirname(file),{recursive:true}); const fd=fs.openSync(file,'wx'); try{ fs.writeFileSync(fd,bundle.files[entry.source.relativeRoot+'/'+f.path]); fs.fsyncSync(fd); }finally{fs.closeSync(fd);} } if(!equal(tree(stage),after.inventory)) fail('E_SKILL_PAYLOAD'); hooks.fault?.('staged'); }
 if(exists) { hooks.fault?.('before-backup'); fs.renameSync(destination,backup); hooks.fault?.('after-backup'); }
 if(after) { hooks.fault?.('before-promote'); fs.renameSync(stage,destination); hooks.fault?.('after-promote'); }
 hooks.fault?.('before-receipt');
 if(after) { const temp=receiptPath+'.next'; durable(temp,after); hooks.fault?.('before-receipt-rename'); fs.renameSync(temp,receiptPath); } else if(receipt) fs.unlinkSync(receiptPath);
 hooks.fault?.('after-receipt');
 if(fs.existsSync(backup)) fs.rmSync(backup,{recursive:true}); fs.unlinkSync(journalPath);
 return {...result,status:removing?'removed':'installed',applied:true};
 } finally { fs.unlinkSync(lock); }
 } catch(e:any) { result.status='conflict'; result.conflicts=[e.message]; return result; }
}
