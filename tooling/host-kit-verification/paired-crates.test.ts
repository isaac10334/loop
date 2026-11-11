import {expect,test} from 'bun:test';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const script=join(import.meta.dir,'paired-crates.ts');
async function run(...args:string[]){const child=Bun.spawn([process.execPath,script,...args],{stdout:'pipe',stderr:'pipe'});const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);return {code,stderr,receipt:JSON.parse(stdout)};}
test('paired gate rejects missing arguments with structured evidence',async()=>{const result=await run();expect(result.code).not.toBe(0);expect(result.receipt).toMatchObject({passed:false,phase:'arguments',stage:null});});
test('paired gate rejects a missing CLI archive before extraction',async()=>{const missing=join(tmpdir(),`missing-cli-${randomUUID()}.crate`),result=await run(missing,'host.crate');expect(result.code).not.toBe(0);expect(result.receipt).toMatchObject({passed:false,phase:'read-loop-cli'});});
test('paired gate rejects an invalid archive with a decode phase',async()=>{const result=await run(import.meta.path,'host.crate');expect(result.code).not.toBe(0);expect(result.receipt).toMatchObject({passed:false,phase:'decode-loop-cli'});});
