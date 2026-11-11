/** Integration-owned package metadata; adapters own executable implementation. */
import { mkdir, copyFile } from 'node:fs/promises';
const deps: Record<string, Record<string,string>> = {
 'host-browser': {'@loop-kit/host':'workspace:^','@loop-kit/ui':'workspace:^'},
 'renderer-dom': {'@loop-kit/host':'workspace:^','@loop-kit/ui':'workspace:^'},
 'host-native': {'@loop-kit/host':'workspace:^','@loop-kit/ui':'workspace:^','@loop-kit/renderer-dom':'workspace:^'},
 'component-polyengine': {'@loop-kit/host':'workspace:^','@loop-kit/scripting':'workspace:^','@loop-kit/ui':'workspace:^','@polyengine/runtime':'0.6.7','@polyengine/protocol':'0.3.1'},
};
for (const [name, dependencies] of Object.entries(deps)) {
 const path=`packages/${name}`;
 await mkdir(path,{recursive:true});
 for (const file of ['package.json','tsconfig.json','tsconfig.build.json']) if (await Bun.file(`${path}/${file}`).exists()) throw new Error(`Refusing to overwrite ${path}/${file}`);
 await Bun.write(`${path}/package.json`,JSON.stringify({name:`@loop-kit/${name}`,version:'0.1.0',type:'module',description:`Loop ${name} adapter`,license:'MIT OR Apache-2.0',files:['dist','src','README.md','LICENSE-MIT','LICENSE-APACHE'],main:'./dist/index.js',types:'./dist/index.d.ts',exports:{'.':{types:'./dist/index.d.ts',import:'./dist/index.js'}},dependencies,scripts:{build:'tsc -p tsconfig.build.json',prepack:'bun run build',typecheck:'tsc --noEmit -p tsconfig.json',test:'bun test ./test',clean:'bun ../../tooling/clean.ts'},repository:{type:'git',url:'git+https://github.com/isaac10334/loop.git',directory:path},engines:{node:'>=22'},publishConfig:{access:'public'}},null,2)+'\n');
 await Bun.write(`${path}/tsconfig.json`,JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{noEmit:true,allowImportingTsExtensions:true},include:['src/**/*.ts','test/**/*.ts']},null,2)+'\n');
 await Bun.write(`${path}/tsconfig.build.json`,JSON.stringify({extends:'../../tsconfig.json',compilerOptions:{declaration:true,declarationMap:true,sourceMap:true,rootDir:'src',outDir:'dist'},include:['src/**/*.ts']},null,2)+'\n');
 for(const license of ['LICENSE-MIT','LICENSE-APACHE']) await copyFile(license,`${path}/${license}`);
}
