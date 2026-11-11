import {expect,test} from 'bun:test';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join,resolve} from 'node:path';
import {acquireReservation} from '../../crates/loop-cli/host-tools/reservation';

const busy={code:'E_TEST_BUSY',message:'reserved'};
test('exclusive contention neither claims nor modifies another reservation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'loop-reservation-test-')),path=join(dir,'active.lock');let owned=false;
 try{
  await writeFile(path,'existing');
  await expect(acquireReservation(path,'replacement',()=>{owned=true;},busy)).rejects.toMatchObject({code:'E_TEST_BUSY'});
  expect(owned).toBe(false);expect(await readFile(path,'utf8')).toBe('existing');
 }finally{
  if(!basename(dir).startsWith('loop-reservation-test-')||!resolve(dir).startsWith(resolve(tmpdir())))throw Error('Unexpected fixture cleanup');
  await rm(dir,{recursive:true,force:true});
 }
});
test('non-contention open errors propagate without claiming ownership',async()=>{
 const failure=Object.assign(new Error('denied'),{code:'EACCES'});let owned=false;
 await expect(acquireReservation('unused','x',()=>{owned=true;},busy,async()=>{throw failure;})).rejects.toBe(failure);
 expect(owned).toBe(false);
});
test('ownership is registered before a failed write and close is attempted',async()=>{
 const events:string[]=[],failure=new Error('disk full');
 await expect(acquireReservation('unused','x',()=>events.push('owned'),busy,async()=>({
  async writeFile(){events.push('write');throw failure;},async close(){events.push('close');}
 }))).rejects.toBe(failure);
 expect(events).toEqual(['owned','write','close']);
});
test('a close-only failure is returned after ownership is registered',async()=>{
 const failure=new Error('close failed');let owned=false;
 await expect(acquireReservation('unused','x',()=>{owned=true;},busy,async()=>({async writeFile(){},async close(){throw failure;}}))).rejects.toBe(failure);
 expect(owned).toBe(true);
});
test('an ownership callback failure still closes the handle',async()=>{
 const failure=new Error('ownership callback failed');let closed=false,wrote=false;
 await expect(acquireReservation('unused','x',()=>{throw failure;},busy,async()=>({async writeFile(){wrote=true;},async close(){closed=true;}}))).rejects.toBe(failure);
 expect(closed).toBe(true);expect(wrote).toBe(false);
});
test('write and close failures are both preserved',async()=>{
 const write=new Error('write failed'),close=new Error('close failed');let owned=false;
 try{
  await acquireReservation('unused','x',()=>{owned=true;},busy,async()=>({async writeFile(){throw write;},async close(){throw close;}}));
  throw Error('expected failure');
 }catch(error){expect(error).toBeInstanceOf(AggregateError);expect((error as AggregateError).errors).toEqual([write,close]);}
 expect(owned).toBe(true);
});
