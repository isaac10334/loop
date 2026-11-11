import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createLaunchRecordPublisher } from '../../crates/loop-cli/host-tools/launch-record';

function deferred() { let resolve!:()=>void; const promise=new Promise<void>(r=>{resolve=r;}); return {promise,resolve}; }

describe('launch record publication',()=>{
  test('serializes snapshots at submission and fences late writes at finish',async()=>{
    const first=deferred(),started=deferred(),writes:string[]=[];
    const publisher=createLaunchRecordPublisher('unused',async(_path,snapshot)=>{writes.push(snapshot);if(writes.length===1){started.resolve();await first.promise;}});
    const mutable={state:'starting',plan:'old'};
    const a=publisher.publish(mutable);await started.promise;
    mutable.state='active';const b=publisher.publish(mutable);
    mutable.plan='new';const c=publisher.finish({state:'stopped',plan:'new'});
    await expect(publisher.publish({state:'active'})).rejects.toThrow('sealed');
    first.resolve();await Promise.all([a,b,c]);
    expect(writes.map(s=>JSON.parse(s))).toEqual([{state:'starting',plan:'old'},{state:'active',plan:'old'},{state:'stopped',plan:'new'}]);
  });
  test('a failed publication is reported but does not suppress final cleanup publication',async()=>{
    const writes:string[]=[];
    const publisher=createLaunchRecordPublisher('unused',async(_path,snapshot)=>{writes.push(snapshot);if(writes.length===1)throw new Error('write failed');});
    const first=publisher.publish({state:'active'});const last=publisher.finish({state:'failed'});
    await expect(first).rejects.toThrow('write failed');await expect(last).resolves.toBeUndefined();
    expect(writes.map(s=>JSON.parse(s))).toEqual([{state:'active'},{state:'failed'}]);
  });
  test('failed replacement preserves destination and cleans temporary file',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'loop-launch-record-test-'));
    const target=join(directory,'launch.json');
    try {
      await mkdir(target);
      const publisher=createLaunchRecordPublisher(target);
      await expect(publisher.publish({state:'active'})).rejects.toThrow();
      expect((await stat(target)).isDirectory()).toBe(true);
      expect(await readdir(directory)).toEqual(['launch.json']);
    } finally {
      if(!basename(directory).startsWith('loop-launch-record-test-')||!resolve(directory).startsWith(resolve(tmpdir())))throw new Error('Unexpected test cleanup target');
      await rm(directory,{recursive:true,force:true});
    }
  });
  test('repeated replacement exposes complete records to concurrent readers',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'loop-launch-record-test-'));
    const target=join(directory,'launch.json');
    try {
      const publisher=createLaunchRecordPublisher(target);
      await publisher.publish({state:'active',revision:0,payload:'x'.repeat(8192)});
      let reading=true,observations=0;const failures:string[]=[];
      const reader=(async()=>{while(reading){try{const value=JSON.parse(await readFile(target,'utf8'));if(value.state!=='active'||!Number.isInteger(value.revision)||value.payload!=='x'.repeat(8192))failures.push('invalid snapshot');observations++;}catch(error){failures.push(String(error));}}})();
      for(let revision=1;revision<=80;revision++)await publisher.publish({state:'active',revision,payload:'x'.repeat(8192)});
      reading=false;await reader;
      expect(observations).toBeGreaterThan(0);expect(failures).toEqual([]);
      expect(JSON.parse(await readFile(target,'utf8')).revision).toBe(80);
      expect((await readdir(directory)).sort()).toEqual(['launch.json']);
    } finally {
      if(!basename(directory).startsWith('loop-launch-record-test-')||!resolve(directory).startsWith(resolve(tmpdir())))throw new Error('Unexpected test cleanup target');
      await rm(directory,{recursive:true,force:true});
    }
  });
});
