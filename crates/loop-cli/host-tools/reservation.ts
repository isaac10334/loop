/** Exclusive same-user reservation creation with explicit ownership and failure reporting. */
import {open} from 'node:fs/promises';

type Handle={writeFile(data:string):Promise<void>;close():Promise<void>};
type OpenExclusive=(path:string)=>Promise<Handle>;
const openExclusive:OpenExclusive=path=>open(path,'wx');

/** Register ownership immediately after exclusive creation so the caller can safely
 * clean up even when writing or closing fails. The synchronous ownership callback must
 * not throw; callers use it only to assign the owned path. Never claim ownership on
 * contention. This is not a defense against malicious same-user replacement of the path.
 */
export async function acquireReservation(path:string,contents:string,onOwned:()=>void,busy:{code:string;message:string},openFile:OpenExclusive=openExclusive):Promise<void>{
 let file:Handle;
 try{file=await openFile(path);}catch(error){
  if((error as NodeJS.ErrnoException)?.code==='EEXIST')throw Object.assign(new Error(busy.message),{code:busy.code});
  throw error;
 }
 const failures:unknown[]=[];
 try{onOwned();await file.writeFile(contents);}catch(error){failures.push(error);}
 try{await file.close();}catch(error){failures.push(error);}
 if(failures.length===1)throw failures[0];
 if(failures.length>1)throw new AggregateError(failures,'Reservation write and close failed');
}
