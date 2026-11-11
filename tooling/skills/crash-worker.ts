import {manage} from '../../crates/loop-cli/host-tools/skills/manager';
import {bundle} from '../../crates/loop-cli/host-tools/skills/bundle';
const result=manage(bundle,{operation:'install',id:'loop-host-kits',root:Bun.argv[2],scope:'project',adapter:'codex-v1',write:true},{fault:phase=>{if(phase==='after-promote')process.exit(73);}});
console.log(JSON.stringify(result));process.exit(1);
