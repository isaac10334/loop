import * as fs from 'node:fs';
import {manage} from '../../crates/loop-cli/host-tools/skills/manager';
import {bundle} from '../../crates/loop-cli/host-tools/skills/bundle';
const result=manage(bundle,{operation:'install',id:'loop-host-kits',root:Bun.argv[2],scope:'project',adapter:'codex-v1',write:true},{fault:phase=>{if(phase==='journal'){fs.writeSync(1,'LOCKED\n');fs.readSync(0,Buffer.alloc(1),0,1,null);}}});
console.log(JSON.stringify(result));process.exit(result.applied?0:1);
