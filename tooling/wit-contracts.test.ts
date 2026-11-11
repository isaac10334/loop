import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateWitContract, virtualWitModule } from './wit-contracts';
import { mapWitContent } from './wit-content-mapper';

const root = resolve(import.meta.dir, '..');
const wit = join(root, 'tooling/fixtures/wit/editor.wit');
const source = await readFile(wit, 'utf8');

test('official WIT parser generates resource bindings and a deterministic source receipt', async () => {
  const first = await generateWitContract(wit);
  const second = await generateWitContract(wit);
  expect(second.receipt).toEqual(first.receipt);
  expect(first.receipt.world).toBe('loop:svg-editor/svg-editor@0.1.0');
  expect(first.receipt.bindingDialect).toBe('jco-types');
  const declaration = new TextDecoder().decode(first.files['interfaces/loop-svg-editor-documents.d.ts']);
  expect(declaration).toContain('private constructor()');
  expect(declaration).toContain('write(expectedRevision: string, source: string): Snapshot');
  expect(virtualWitModule(first)).toContain('export declare function setFill(document: Document, color: string): string;');
}, 30000);

test('invalid WIT fails generation; source changes invalidate the receipt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-wit-test-'));
  const file = join(directory, 'editor.wit');
  try {
    await writeFile(file, source);
    const first = await generateWitContract(file);
    await writeFile(file, source + '\n// changed source\n');
    expect((await generateWitContract(file)).receipt.sourceSha256).not.toBe(first.receipt.sourceSha256);
    await writeFile(file, source.replace('revision: string', 'revision: absent-type'));
    await expect(generateWitContract(file)).rejects.toThrow('WIT generation failed');
    await expect(mapWitContent('package invalid')).rejects.toThrow('WIT generation failed');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);

test('TypeScript 7.1 imports real WIT through its content mapper and checks resource method arguments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-wit-native-'));
  const mapperPackage = join(directory, 'node_modules/@loop-kit/wit-content-mapper');
  await mkdir(mapperPackage, { recursive: true });
  await writeFile(join(mapperPackage, 'package.json'), JSON.stringify({ name: '@loop-kit/wit-content-mapper', version: '0.1.0',
    typescript: { contentMapper: { exec: [process.execPath, join(root, 'tooling/wit-content-mapper.ts')], compilerOptions: [] } } }));
  await writeFile(join(directory, 'editor.wit'), source);
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'preserve', moduleResolution: 'bundler',
    strict: true, noEmit: true, types: [] }, include: ['consumer.ts', 'editor.wit'],
    contentMappers: [{ package: '@loop-kit/wit-content-mapper', extensions: ['.wit'], options: { world: 'svg-editor' } }] }));
  const compiler = join(dirname(fileURLToPath(import.meta.resolve('typescript-native/package.json'))), 'bin/tsc');
  const check = async () => {
    const child = Bun.spawn(['node', compiler, '-p', directory, '--runExternalCode', '--pretty', 'false'], { cwd: directory, stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => child.kill(), 30000);
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      return { code, output: stdout + stderr };
    } finally { clearTimeout(timer); }
  };
  try {
    await writeFile(join(directory, 'consumer.ts'), `import type { Document } from './editor.wit';\nexport function edit(document: Document) { const value: string = document.read().source; return document.write('revision-1', value); }\n`);
    const valid = await check();
    expect(valid.output).toBe('');
    expect(valid.code).toBe(0);
    await writeFile(join(directory, 'consumer.ts'), `import type { Document } from './editor.wit';\nexport function edit(document: Document) { return document.write(42, '<svg/>'); }\n`);
    const invalid = await check();
    expect(invalid.code).not.toBe(0);
    expect(invalid.output).toContain('TS2345');
    expect(invalid.output).toContain("Argument of type 'number' is not assignable to parameter of type 'string'");
    await writeFile(join(directory, 'editor.wit'), 'package broken');
    const broken = await check();
    expect(broken.code).not.toBe(0);
    expect(broken.output).toContain('WIT generation failed');
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 60000);
