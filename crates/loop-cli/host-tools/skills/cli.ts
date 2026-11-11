import {bundle} from './bundle';
import {manage,type Request} from './manager';
export function parse(args:string[]):Request {
 const operation=args.shift(); if(!['list','inspect','install','update','remove','recover'].includes(operation!)) throw Error('E_SKILL_OPERATION');
 const request:Request={operation:operation as Request['operation']}; if(operation!=='list') {request.id=args.shift(); if(!request.id||request.id.startsWith('-')) throw Error('E_SKILL_ID');}
 const seen=new Set<string>();
 while(args.length) {const flag=args.shift()!; if(seen.has(flag)) throw Error('E_SKILL_FLAGS'); seen.add(flag);
 if(['--json','--dry-run','--write'].includes(flag)) {if(flag==='--write')request.write=true; if(flag==='--dry-run')request.dryRun=true; continue;}
 const key=({'--scope':'scope','--root':'root','--adapter':'adapter','--version':'version','--plan-digest':'planDigest'} as const)[flag as '--root']; if(!key) throw Error('E_SKILL_FLAGS'); const value=args.shift(); if(!value||value.startsWith('--'))throw Error('E_SKILL_FLAGS'); (request as any)[key]=value;
 }
 if(request.operation==='list' && Object.keys(request).some(k=>k!=='operation')) throw Error('E_SKILL_FLAGS');
 return request;
}
if(import.meta.main) {
 try {const request=parse(Bun.argv.slice(2)); const result=manage(bundle,request); console.log(JSON.stringify(result)); process.exitCode=result.conflicts.length?(result.conflicts.some(c=>/FLAGS|OPERATION|ADAPTER|VERSION|ROOT|ID|CATALOG|PAYLOAD|DIGEST|COMPATIBILITY/.test(c))?2:5):0;}
 catch(e:any) {console.log(JSON.stringify({schemaVersion:1,operation:'skills',status:'error',applied:false,actions:[],conflicts:[e.message],recovery:null}));process.exitCode=2;}
}
