/** Ordered atomic publication of one launch's inert diagnostic records. */
import { open, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

type SnapshotWriter = (destination:string, snapshot:string) => Promise<void>;

/** Replace a file through a unique same-directory sibling; never unlink the destination.
 * Rename failures (including Windows sharing violations) propagate. This guarantees
 * atomic visibility where the filesystem supports replacement, not crash durability.
 */
export async function writeLaunchSnapshot(destination:string, snapshot:string):Promise<void> {
  const target=resolve(destination), directory=dirname(target);
  const temporary=join(directory,`.loop-launch-${randomUUID()}.tmp`);
  if(dirname(temporary)!==directory) throw new Error('Invalid launch snapshot temporary path');
  const file=await open(temporary,'wx');
  let primary:unknown, failed=false, moved=false, closed=false;
  try {
    await file.writeFile(snapshot,'utf8');
    await file.close(); closed=true;
    // Windows readers/security scanners can transiently hold the destination without
    // delete-sharing. Retry boundedly, but never delete the destination as a fallback.
    for(let attempt=0;;attempt++) {
      try { await rename(temporary,target); break; }
      catch(error) {
        if(!['EPERM','EACCES','EBUSY'].includes((error as NodeJS.ErrnoException).code??'')||attempt>=100) throw error;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
    }
    moved=true;
  } catch(error) {
    primary=error; failed=true;
    if(!closed) try { await file.close(); } catch(closeError) { primary=new AggregateError([primary,closeError],'Launch snapshot write and close failed'); }
  }
  if(!moved) {
    try { await unlink(temporary); }
    catch(error) {
      if((error as NodeJS.ErrnoException).code!=='ENOENT') {
        if(failed) throw new AggregateError([primary,error],'Launch snapshot write and cleanup failed');
        throw error;
      }
    }
  }
  if(failed) throw primary;
}

/** A launch owns one publisher. Snapshots are serialized at submission, writes run
 * in submission order, and sealing synchronously rejects all subsequent submissions.
 * A failed write rejects its own caller but does not suppress later cleanup records.
 */
export function createLaunchRecordPublisher(destination:string, write:SnapshotWriter=writeLaunchSnapshot) {
  let tail:Promise<void>=Promise.resolve(), sealed=false;
  function enqueue(record:unknown):Promise<void> {
    const snapshot=JSON.stringify(record);
    if(typeof snapshot!=='string') throw new TypeError('Launch record must be JSON serializable');
    const pending=tail.then(()=>write(destination,snapshot));
    tail=pending.catch(()=>{});
    return pending;
  }
  return {
    publish(record:unknown):Promise<void> {
      if(sealed) return Promise.reject(new Error('Launch record publisher is sealed'));
      return enqueue(record);
    },
    finish(record:unknown):Promise<void> {
      if(sealed) return Promise.reject(new Error('Launch record publisher is sealed'));
      sealed=true;
      return enqueue(record);
    },
  };
}
