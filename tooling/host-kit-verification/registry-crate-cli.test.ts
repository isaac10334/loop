import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const script=join(import.meta.dir,'registry-crate.ts');
async function run(...args:string[]) {
  const child=Bun.spawn([process.execPath,script,...args],{stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  return {code,stderr,receipt:JSON.parse(stdout)};
}
test('missing arguments report a structured failure',async()=>{
  const result=await run();
  expect(result.code).not.toBe(0); expect(result.receipt).toMatchObject({passed:false,phase:'arguments',stage:null});
});
test('missing archive reports the read phase',async()=>{
  const missing=join(tmpdir(),`loop-missing-archive-${randomUUID()}.crate`);
  const result=await run(missing);
  expect(result.code).not.toBe(0); expect(result.receipt).toMatchObject({passed:false,phase:'read-archive',archive:missing});
});
test('invalid archive reports the decode phase',async()=>{
  const result=await run(import.meta.path);
  expect(result.code).not.toBe(0); expect(result.receipt).toMatchObject({passed:false,phase:'decode-archive'});
});
