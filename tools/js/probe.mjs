import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile } from 'node:fs/promises';
const { component } = await componentize(await readFile(new URL('./out/probe.js', import.meta.url), 'utf8'), {
  witPath: new URL('../../wit/probe', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
  worldName: 'probe',
});
await writeFile(new URL('./probe.wasm', import.meta.url), component);
