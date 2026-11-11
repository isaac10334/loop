/** Build a real official-kit demo from the canonical example, without requiring a Rust CLI in Pages CI. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { extractHostConfig, resolveHostPlan } from '@loop-kit/host';
import config from '../examples/host-kits/custom-provider/official.config';
export async function buildDemo(output: string): Promise<void> {
  const example = resolve(import.meta.dir, '../examples/host-kits/custom-provider');
  const inert = extractHostConfig(config), target = inert.targets[0]!;
  const refs = [target.kit.coordinator, target.application, ...[...target.kit.plugins, ...(target.plugins ?? [])].flatMap(p => p.runtime.map(r => r.entry))];
  const digest = (value: string | Uint8Array) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
  const paths = refs.map(ref => ref.specifier.startsWith('./') ? resolve(example, ref.specifier) : Bun.resolveSync(ref.specifier, example));
  const modules = await Promise.all(refs.map(async (ref, index) => ({ ...ref, sha256: digest(new Uint8Array(await Bun.file(paths[index]!).arrayBuffer())) })));
  const plan = resolveHostPlan(inert, {
    target: 'counter', modules, configDigest: digest(await Bun.file(join(example, 'official.config.ts')).text()),
    sourceSnapshotDigest: digest((await Promise.all(['app.ts', 'counter.ts', 'counter-provider.ts'].map(file => Bun.file(join(example, file)).text()))).join('\0')),
    lockDigests: [{ path: 'bun.lock', sha256: digest(await Bun.file(resolve(import.meta.dir, '../bun.lock')).text()) }],
    toolchain: [{ id: 'bun', version: Bun.version, sha256: digest(Bun.version) }],
    provenance: { route: 'site-build', note: 'Trusted repository example; not a CLI plan or installed-distribution receipt.' },
  }, digest);
  const runtimeRefs = refs.filter(ref => ref !== target.kit.coordinator);
  const imports = runtimeRefs.map((ref, i) => `import * as m${i} from ${JSON.stringify(paths[refs.indexOf(ref)])};`).join('\n');
  const source = `import { bootstrapBrowser } from '@loop-kit/host-browser';\n${imports}\nconst modules={${runtimeRefs.map((ref, i) => `${JSON.stringify(ref.specifier)}:m${i}`).join(',')}};\nconst plan=${JSON.stringify(plan)};\nlet runtime;const button=document.querySelector('#lifecycle'),status=document.querySelector('#status');\nasync function launch(){runtime=await bootstrapBrowser({plan,modules,root:document.querySelector('#app')});button.textContent='Stop application';status.textContent='Running · independent provider state';}\nbutton.addEventListener('click',async()=>{button.disabled=true;try{if(runtime){await runtime.dispose();runtime=undefined;button.textContent='Start a fresh application';status.textContent='Disposed · surface and owned service released';}else await launch();}catch(error){status.textContent=String(error);throw error;}finally{button.disabled=false;}});\nawait launch();button.disabled=false;\n`;
  const built = await Bun.build({ entrypoints: ['loop-site-demo'], target: 'browser', minify: true, plugins: [{ name: 'canonical-demo', setup(build) { build.onResolve({ filter: /^loop-site-demo$/ }, () => ({ path: 'loop-site-demo', namespace: 'demo' })); build.onLoad({ filter: /.*/, namespace: 'demo' }, () => ({ contents: source, loader: 'ts', resolveDir: resolve(import.meta.dir, '..') })); } }] });
  if (!built.success) throw new AggregateError(built.logs, 'Demo bundle failed');
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'app.js'), await built.outputs[0]!.text());
  await writeFile(join(output, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loop Kit counter demo</title><link rel="icon" href="../../favicon.svg"><style>:root{color-scheme:light dark;font:15px system-ui}body{margin:0;padding:22px;background:light-dark(#f5f8f3,#1c241e);color:light-dark(#202b25,#e4ece3)}[data-layout=column]{display:flex;flex-direction:column;gap:12px}input,button{font:inherit;padding:9px 12px;border:1px solid #71819a;border-radius:7px}button{cursor:pointer}button:disabled{cursor:default;opacity:.55}#lifecycle{margin-top:20px}#status{font-size:13px;opacity:.8}*:focus-visible{outline:3px solid #6f90ed;outline-offset:3px}</style></head><body><main id="app" aria-label="Counter application"></main><button id="lifecycle" type="button" disabled>Starting…</button><p id="status" role="status"></p><script type="module" src="./app.js"></script></body></html>`);
  await writeFile(join(output, 'build-receipt.json'), JSON.stringify({ format: 'loop-site-demo-v1', planId: plan.planId, provenance: plan.provenance, modules }, null, 2) + '\n');
}
