/** Register this checkout's mapper locally and check editable WIT consumers.
 * Absolute executable paths are generated only in ignored node_modules. This
 * never edits a shared compiler setting or enables editor workspace trust.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = import.meta.dir;
const root = resolve(directory, '../..');
const flags = new Set(process.argv.slice(2));
for (const flag of flags) if (!['--setup', '--invalid'].includes(flag)) throw new Error(`Unknown argument ${flag}`);
const registration = join(directory, 'node_modules/@loop-kit/wit-content-mapper');
await mkdir(registration, { recursive: true });
await writeFile(join(registration, 'package.json'), JSON.stringify({
  name: '@loop-kit/wit-content-mapper', version: '0.1.0', private: true,
  typescript: { contentMapper: { exec: [process.execPath, join(root, 'tooling/wit-content-mapper.ts')], compilerOptions: [] } },
}, null, 2) + '\n');
console.log('Registered this checkout’s WIT mapper for examples/wit-editor.');

if (!flags.has('--setup')) {
  const compiler = join(dirname(fileURLToPath(import.meta.resolve('typescript-native/package.json'))), 'bin/tsc');
  const check = async (config: string) => {
    const child = Bun.spawn(['node', compiler, '-p', join(directory, config), '--runExternalCode', '--pretty', 'false'], {
      cwd: directory, stdout: 'pipe', stderr: 'pipe',
    });
    const timer = setTimeout(() => child.kill(), 30000);
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      return { output: stdout + stderr, code };
    } finally { clearTimeout(timer); }
  };
  if (flags.has('--invalid')) {
    const result = await check('tsconfig.invalid.json');
    process.stdout.write(result.output);
    process.exitCode = result.code;
  } else {
    const valid = await check('tsconfig.json');
    if (valid.code !== 0) throw new Error(`Valid WIT consumer failed:\n${valid.output}`);
    console.log('Valid direct-WIT consumer passed.');
    const invalid = await check('tsconfig.invalid.json');
    if (invalid.code === 0 || !invalid.output.includes('TS2345')) throw new Error(`Expected WIT argument rejection, got:\n${invalid.output}`);
    process.stdout.write(invalid.output);
    console.log('Deliberate invalid revision rejected. Both proof cases passed.');
  }
}
