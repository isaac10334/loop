/** Pack and consume public artifacts outside the monorepo; never publish them. */
import { mkdtemp,mkdir,writeFile,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve,posix,dirname } from 'node:path';
import { ordered } from '../tooling/packages';
const names=ordered().map(pkg=>pkg.directory);
const root=resolve(import.meta.dir,'..'),output=join(root,'target/npm-pack');await mkdir(output,{recursive:true});
for(const file of await readdir(output)) if(file.endsWith('.tgz')) {const target=resolve(output,file);if(dirname(target)!==output)throw new Error('Pack cleanup target escaped artifact directory');await rm(target);}
async function run(args:string[],cwd:string){const child=Bun.spawn(args,{cwd,stdout:'pipe',stderr:'pipe'});const [out,err,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);if(code)throw new Error(args.join(' ')+'\n'+out+'\n'+err);return out;}
for(const name of names)await run(['bun','pm','pack','--destination',output],join(root,'packages',name));
const files=await readdir(output),dependencies=Object.fromEntries(names.map(name=>['@loop-kit/'+name,'file:'+join(output,files.find(file=>file.startsWith('loop-kit-'+name+'-'))!).replaceAll('\\','/')]));
const consumer=await mkdtemp(join(tmpdir(),'loop-kit-consumer-'));
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies,overrides:dependencies}));
await writeFile(join(consumer,'consumer.ts'),`import {defineCapability} from '@loop-kit/capabilities';import {createHost} from '@loop-kit/host';import {RecordingSurface} from '@loop-kit/ui';import {createGuestSdk} from '@loop-kit/scripting';
const capability=defineCapability<{value():number}>({id:'loop:test/counter',version:'1.0.0',methods:[{name:'value',input:{type:'object'},output:{type:'number'},effects:[]}]});const host=createHost();const registration=host.provide(capability,{create:()=>({value:()=>42})},{serviceId:'selected'});const scope=host.scope();const handle=await scope.acquire(capability,{serviceId:'selected'});if(handle.value.value()!==42)throw new Error('Named service failed');
const surface=new RecordingSurface();const sdk=createGuestSdk({invoke:async()=>null,subscribe:async()=>({next:async()=>undefined,cancel(){}}),openSurface:async()=>({render:document=>surface.render(JSON.parse(document)),nextEvent:async()=>undefined,dispose:()=>surface.dispose()})});await sdk.ui.render(sdk.ui.h('text',{key:'answer'},42));if(surface.frame?.root.children?.[0]?.text!=='42')throw new Error('Portable SDK failed');sdk.ui.dispose();await scope.revoke();await registration.unregister();await host.dispose();for(const name of ${JSON.stringify(names)}){let rejected=false;try{await import('@loop-kit/'+name+'/src/index.ts')}catch{rejected=true}if(!rejected)throw new Error('Private source export is accessible: '+name)}console.log('External ESM consumer passed; private source entrypoints rejected');`);
await writeFile(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,skipLibCheck:false,types:[],lib:['ES2022','DOM']},files:['consumer.ts']}));
await run(['bun','install'],consumer);await run(['bun',join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],consumer);console.log((await run(['bun','consumer.ts'],consumer)).trim());console.log(JSON.stringify({consumer,packages:Object.keys(dependencies)}));
await run(['bun','build','consumer.ts','--target=node','--packages=external','--outfile=consumer.mjs'],consumer);
console.log((await run(['node','consumer.mjs'],consumer)).trim());
for(const name of names) {
 const path=Object.values(dependencies).find(value=>value.includes(`loop-kit-${name}-`))!.slice(5);
 const packed=await new Bun.Archive(await Bun.file(path).bytes()).files();
 for(const file of ['dist/index.js','dist/index.d.ts','dist/index.js.map','dist/index.d.ts.map','src/index.ts','README.md','LICENSE-MIT','LICENSE-APACHE']) if(!packed.has('package/'+file))throw new Error(`Missing ${name}/${file}`);
 const manifest=JSON.parse(await packed.get('package/package.json')!.text());
 for(const value of Object.values(manifest.dependencies??{}) as string[]) if(/^(workspace:|link:|file:)/.test(value))throw new Error('Nonpublishable dependency '+value);
 if(!manifest.repository?.directory||manifest.publishConfig?.access!=='public')throw new Error('Missing npm metadata');
 if(name==='scripting'&&!packed.has('package/build-engine.ps1'))throw new Error('Missing engine build resource');
 for(const [file,bytes] of packed) {
   if(file.includes('/target/')||file.includes('/node_modules/'))throw new Error('Build/cache leaked: '+file);
   if(/\.[jt]s$/.test(file)&&(await bytes.text()).includes('__stationLocalLinkProof'))throw new Error('Temporary integration proof leaked into release');
   if(file.endsWith('.map')) {const map=JSON.parse(await bytes.text());for(const source of map.sources??[]) {const target=posix.normalize(posix.join(posix.dirname(file),source));if(!packed.has(target))throw new Error('Broken map source '+target);}}
 }
 const single=await mkdtemp(join(tmpdir(),`loop-kit-${name}-`));
 await writeFile(join(single,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{['@loop-kit/'+name]:dependencies['@loop-kit/'+name]},overrides:dependencies}));
 await writeFile(join(single,'consumer.ts'),`import * as api from '@loop-kit/${name}';if(!Object.keys(api).length)throw new Error('Empty public API');console.log('Individual ${name} consumer passed');`);
 await writeFile(join(single,'tsconfig.json'),await Bun.file(join(consumer,'tsconfig.json')).text());
 await run(['bun','install'],single);await run(['bun',join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],single);
 console.log((await run(['bun','consumer.ts'],single)).trim());
 await run(['bun','build','consumer.ts','--target=node','--packages=external','--outfile=consumer.mjs'],single);console.log((await run(['node','consumer.mjs'],single)).trim());
 const readme=await Bun.file(join(root,'packages',name,'README.md')).text();
 const example=[...readme.matchAll(/```ts\r?\n([\s\S]*?)```/g)].map(match=>match[1]).join('\n');
 await writeFile(join(single,'example.ts'),example);
 await writeFile(join(single,'tsconfig.example.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noEmit:true,types:[],lib:['ES2022','DOM','ESNext.Disposable']},files:['example.ts']}));
 await run(['bun',join(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.example.json'],single);
 await run(['bun','example.ts'],single);
}
