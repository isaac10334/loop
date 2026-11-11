import {expect,test} from 'bun:test';
import {join} from 'node:path';
test('worker bounds decoded revision and error detail before additional copies',async()=>{
 const child=Bun.spawn([process.execPath,'test',join(import.meta.dir,'fixtures/worker-budget-isolated.test.ts')],{env:{...process.env,LOOP_ISOLATED_COMPONENT_BUDGET:'1'},stdout:'pipe',stderr:'pipe'});
 const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
 expect(code,stdout+'\n'+stderr).toBe(0);expect(stderr).toContain('4 pass');
},10000);
