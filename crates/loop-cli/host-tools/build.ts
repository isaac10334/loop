/** Build CLI-owned embedded assets against the public SDK export artifacts. No runtime checkout reads. */
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dir,'../../..');
for(const [entry,name] of [['native.ts','native-runtime.js'],['worker.ts','worker.js']]){
 const built=await Bun.build({entrypoints:[resolve(import.meta.dir,entry!)],target:'bun',format:'esm',outdir:resolve(import.meta.dir,'dist'),naming:name,plugins:[{name:'workspace-public-roots',setup(build){build.onResolve({filter:/^@loop-kit\/[a-z-]+$/},async args=>{const path=resolve(root,'packages',args.path.slice('@loop-kit/'.length),'package.json');const pkg=await Bun.file(path).json();return {path:resolve(dirname(path),pkg.exports['.'].import)};});}}]});
 if(!built.success){for(const log of built.logs)console.error(log);process.exit(1);}
}
