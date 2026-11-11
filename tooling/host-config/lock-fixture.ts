/** Synthetic resolver-unit fixture only; not an installation or release receipt. */
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
export async function lockFixture(root:string,names:string[]){const project=await Bun.file(resolve(root,'package.json')).json();const packages:Record<string,unknown>={};for(const name of names){const pkg=await Bun.file(resolve(root,'node_modules',name,'package.json')).json();packages[name]=[`${name}@${pkg.version}`,'',{...(pkg.dependencies?{dependencies:pkg.dependencies}:{})},'sha512-unit-fixture-not-installation'];}await writeFile(resolve(root,'bun.lock'),JSON.stringify({lockfileVersion:1,workspaces:{'':project},...(project.overrides?{overrides:project.overrides}:{}),packages}));}
