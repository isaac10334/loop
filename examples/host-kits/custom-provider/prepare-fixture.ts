/** Explicit offline installation of reviewed public tarballs; never links SDK source. */
import { mkdir, copyFile, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = import.meta.dir;
const packs = resolve(process.argv[2] ?? join(source, '../../../target/npm-pack'));
const artifacts = resolve(process.argv[3] ?? join(source, '.artifacts'));
const fixture = join(artifacts, 'consumer');
const manifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
const inventory = JSON.parse(await readFile(join(source, 'loop.package.json'), 'utf8'));
// Existing generated fixtures are never silently overwritten, merged or deleted.
try { await lstat(artifacts); throw new Error(`${artifacts} already exists; review/archive it explicitly before preparing again`); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const reviewed: { name: string; filename: string; bytes: Uint8Array; sha256: string }[] = [];
for (const [name, version] of Object.entries(manifest.dependencies)) {
  if (version !== '0.1.0' || !name.startsWith('@loop-kit/')) throw new Error(`Unexpected SDK pin ${name}`);
  const filename = `loop-kit-${name.slice('@loop-kit/'.length)}-${version}.tgz`;
  const path = join(packs, filename);
  if (!(await lstat(path)).isFile()) throw new Error(`Expected regular reviewed tarball ${path}`);
  const result = spawnSync('tar', ['-xOf', path, 'package/package.json'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot inspect ${path}: ${result.stderr}`);
  const pkg = JSON.parse(result.stdout);
  if (pkg.name !== name || pkg.version !== version || Object.values(pkg.dependencies ?? {}).some(v => String(v).startsWith('workspace:'))) {
    throw new Error(`Not a public packed ${name}@${version}`);
  }
  const bytes = await readFile(path);
  reviewed.push({ name, filename, bytes, sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex') });
}
await mkdir(join(fixture, 'tarballs'), { recursive: true });
for (const entry of reviewed) {
  await writeFile(join(fixture, 'tarballs', entry.filename), entry.bytes);
  manifest.dependencies[entry.name] = `file:./tarballs/${entry.filename}`;
}
// npm's $ reference follows the generated direct dependency, including its relative file pin.
manifest.overrides = Object.fromEntries(reviewed.map(entry => [entry.name, `$${entry.name}`]));
await writeFile(join(fixture, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const path of [...inventory.sourcePaths.filter((p: string) => !['package.json', 'package-lock.json', 'bun.lock'].includes(p)), 'loop.package.json']) {
  await copyFile(join(source, path), join(fixture, path));
}
await writeFile(join(artifacts, 'tarballs.json'), JSON.stringify(reviewed.map(({ name, filename, bytes, sha256 }) => ({ name, version: '0.1.0', filename, bytes: bytes.byteLength, sha256 })), null, 2) + '\n');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const installed = spawnSync(npm, ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: fixture, stdio: 'inherit', shell: process.platform === 'win32' });
if (installed.status !== 0) throw new Error(`Explicit fixture install failed (${installed.status}); source manifest is unchanged`);
const locked = spawnSync(process.platform === 'win32' ? 'bun.exe' : 'bun', ['install', '--offline', '--ignore-scripts'], { cwd: fixture, stdio: 'inherit', shell: process.platform === 'win32' });
if (locked.status !== 0) throw new Error(`Bun frozen-lock preparation failed (${locked.status}); source manifest is unchanged`);
console.log(`Prepared installed consumer: ${fixture}`);
console.log('Its package-lock.json, bun.lock and local tarballs are build inputs; source package.json retains exact registry pins.');
