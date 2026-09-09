import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const { component } = await componentize(await readFile('out/app.js', 'utf8'), {
  witPath: 'wit', worldName: 'application-sync',
  disableFeatures: ['http', 'fetch-event'],
});
await mkdir('dist', { recursive: true });
await writeFile('dist/component.wasm', component);
