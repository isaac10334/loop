/** WIT-authoritative development contracts. jco's Rust parser validates source;
 * generated JSON is an inspection receipt, never a replacement ABI or a grant.
 */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export interface WitContractReceipt {
  readonly formatVersion: 1;
  readonly language: 'wit';
  readonly world: string;
  readonly sourceSha256: string;
  readonly generator: '@bytecodealliance/jco@1.15.2';
  readonly bindingDialect: 'jco-types';
  readonly sources: Readonly<Record<string, string>>;
  readonly bindings: Readonly<Record<string, { sha256: string; declarations: readonly string[] }>>;
}
export interface GeneratedWitContract {
  readonly receipt: WitContractReceipt;
  readonly files: Readonly<Record<string, Uint8Array>>;
}
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

async function witSources(directory: string, prefix = ''): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`WIT inputs cannot contain symlinks: ${name}`);
    if (entry.isDirectory()) Object.assign(output, await witSources(join(directory, entry.name), `${name}/`));
    else if (entry.name.endsWith('.wit')) output[name] = await readFile(join(directory, entry.name), 'utf8');
  }
  return output;
}

/** Parse one complete WIT package closure and emit official jco TypeScript types.
 * The digest covers relative names and exact source bytes, including WIT deps.
 * jco result/error/resource conventions must not be treated as Polyengine facades.
 */
export async function generateWitContract(witPath: string, world = 'svg-editor'): Promise<GeneratedWitContract> {
  if (!/^[a-z][a-z0-9-]*$/.test(world)) throw new Error('Expected an unqualified WIT world name');
  const absolute = resolve(witPath);
  const sourceFiles = await witSources(dirname(absolute));
  if (!Object.keys(sourceFiles).length) throw new Error('No WIT sources');
  const sourceSha256 = hash(JSON.stringify(Object.entries(sourceFiles).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
  const jcoDirectory = dirname(fileURLToPath(import.meta.resolve('@bytecodealliance/jco')));
  const manifest = JSON.parse(await readFile(join(jcoDirectory, '../package.json'), 'utf8'));
  if (manifest.version !== '1.15.2') throw new Error('Expected pinned jco 1.15.2');
  // Run the official CLI on Node/V8: Bun/JSC cannot execute this parser's Wasm.
  const output = await mkdtemp(join(tmpdir(), 'loop-wit-types-'));
  const files: Record<string, Uint8Array> = {};
  try {
    const child = Bun.spawn(['node', join(jcoDirectory, 'jco.js'), 'types', absolute, '--name', world, '--world-name', world, '-o', output], { stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => child.kill(), 30000);
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      if (code !== 0) throw new Error(`WIT generation failed: ${stderr || stdout}`);
    } finally { clearTimeout(timer); }
    const collect = async (directory: string, prefix = '') => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) await collect(join(directory, entry.name), `${prefix}${entry.name}/`);
        else files[prefix + entry.name] = new Uint8Array(await readFile(join(directory, entry.name)));
      }
    };
    await collect(output);
  } finally { await rm(output, { recursive: true, force: true }); }
  const currentSources = await witSources(dirname(absolute));
  if (JSON.stringify(currentSources) !== JSON.stringify(sourceFiles)) throw new Error('WIT source changed during generation');
  const main = new TextDecoder().decode(files[`${world}.d.ts`]);
  // This line is metadata emitted by the official parser/code generator, not a WIT parser.
  const worldId = main.split('\n').find(line => line.startsWith('// world '))?.slice('// world '.length).trim();
  if (!worldId) throw new Error('jco did not report the selected WIT world');
  const bindings: Record<string, { sha256: string; declarations: string[] }> = {};
  for (const [name, bytes] of Object.entries(files).sort(([a], [b]) => a < b ? -1 : 1)) {
    const source = ts.createSourceFile(name, new TextDecoder().decode(bytes), ts.ScriptTarget.Latest, true);
    bindings[name] = { sha256: hash(bytes), declarations: source.statements.map(node => node.getText(source)) };
  }
  return { files, receipt: { formatVersion: 1, language: 'wit', world: worldId, sourceSha256,
    generator: '@bytecodealliance/jco@1.15.2', bindingDialect: 'jco-types', sources: sourceFiles, bindings } };
}

/** Flatten official declaration files into one ambient module for a TypeScript
 * content mapper. Import-type paths are resolved from the generated graph.
 * Runtime loading and resource adaptation are deliberately outside this function.
 */
export function virtualWitModule(contract: GeneratedWitContract, world = 'svg-editor'): string {
  const printer = ts.createPrinter();
  const mainName = `${world}.d.ts`;
  const interfaceNames = Object.keys(contract.files).filter(name => name !== mainName).sort();
  const namespaces = new Map(interfaceNames.map((name, index) => [name.replace(/\.d\.ts$/, '.js'), `WitInterface${index}`]));
  const main = ts.createSourceFile(mainName, new TextDecoder().decode(contract.files[mainName]), ts.ScriptTarget.Latest, true);
  const transform: ts.TransformerFactory<ts.SourceFile> = context => source => {
    const visit: ts.Visitor = node => {
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
        const namespace = namespaces.get(node.argument.literal.text.replace(/^\.\//, ''));
        if (!namespace || !node.qualifier || !ts.isIdentifier(node.qualifier)) throw new Error('Unsupported generated WIT import type');
        return ts.factory.createTypeReferenceNode(ts.factory.createQualifiedName(ts.factory.createIdentifier(namespace), node.qualifier), node.typeArguments);
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) return undefined;
      if (ts.isFunctionDeclaration(node)) return ts.factory.updateFunctionDeclaration(node,
        [...(node.modifiers ?? []), ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword)], node.asteriskToken,
        node.name, node.typeParameters, node.parameters, node.type, node.body);
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(source, visit) as ts.SourceFile;
  };
  const result = ts.transform(main, [transform]);
  try {
    const namespacesText = interfaceNames.map(name => `declare namespace ${namespaces.get(name.replace(/\.d\.ts$/, '.js'))} {\n${new TextDecoder().decode(contract.files[name])}\n}`).join('\n');
    return `${namespacesText}\n${printer.printFile(result.transformed[0]!)}\n`;
  } finally { result.dispose(); }
}

if (import.meta.main) {
  const [witPath, output, world = 'svg-editor'] = process.argv.slice(2);
  if (!witPath || !output) throw new Error('Usage: bun tooling/wit-contracts.ts <world.wit> <output-directory> [world]');
  const generated = await generateWitContract(witPath, world);
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of Object.entries(generated.files)) {
    await mkdir(dirname(join(output, name)), { recursive: true });
    await writeFile(join(output, name), bytes);
  }
  await writeFile(join(output, 'contract.json'), `${JSON.stringify(generated.receipt, null, 2)}\n`);
  await writeFile(join(output, 'virtual.ts'), virtualWitModule(generated, world));
  console.log(JSON.stringify({ world: generated.receipt.world, sourceSha256: generated.receipt.sourceSha256, output: resolve(output) }));
}
