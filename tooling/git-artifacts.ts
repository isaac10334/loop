/** Build immutable package artifacts from a remotely available revision, never a dirty checkout.
 * @example bun tooling/git-artifacts.ts https://github.com/isaac10334/loop.git FULL_SHA OUTPUT
 */
import { mkdtemp, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from './packages';
const [remote,revision,destination]=process.argv.slice(2);
if(!remote||!/^https:\/\/github.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(remote)||!revision?.match(/^[a-f0-9]{40}$/)||!destination)throw new Error('Pass public HTTPS repository, full remote SHA, and output directory');
const scratch=await mkdtemp(join(tmpdir(),'loop-remote-'));
await run(['git','init',scratch]);
await run(['git','remote','add','origin',remote],scratch);
await run(['git','fetch','--depth=1','origin',revision],scratch);
await run(['git','checkout','--detach','FETCH_HEAD'],scratch);
// A remote checkout must contain the packaging workflow. No local source fallback.
if(!await Bun.file(join(scratch,'tooling/release.ts')).exists())throw new Error('Remote revision has no TypeScript release workflow. Commit and push Loop Kit first.');
await run(['bun','install','--frozen-lockfile'],scratch);
await run(['bun','run','release:prepare'],scratch);
await mkdir(resolve(destination),{recursive:true});
await cp(join(scratch,'target/npm-pack'),resolve(destination),{recursive:true});
await Bun.write(join(resolve(destination),'source-revision.json'),JSON.stringify({remote,revision},null,2)+'\n');
