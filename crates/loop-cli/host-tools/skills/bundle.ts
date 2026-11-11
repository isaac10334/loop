import catalog from '../../../../skills/catalog.json';
import skill from '../../../../skills/loop-host-kits/SKILL.md' with {type:'text'};
import renderers from '../../../../skills/loop-host-kits/references/renderers.md' with {type:'text'};
import type {Bundle} from './manager';
// Bundler asset inventory only; management dispatch never branches on a skill ID.
export const bundle:Bundle={...catalog,files:{'loop-host-kits/SKILL.md':new TextEncoder().encode(skill),'loop-host-kits/references/renderers.md':new TextEncoder().encode(renderers)}};
