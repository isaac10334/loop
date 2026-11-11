/** Local file/Git adapters for portable source snapshots. Never executes source.
 * Remote submission is an explicit command using a narrowly configured adapter. */
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createSourceSnapshot, createChangeRequest, submitChangeRequest, validateSourcePath, type PinnedAssetReference, type ChangeRequest } from '@loop-kit/workspace';
import { createGitHubChangePort } from './github-change-port';

interface SourceManifest { version: 1; id: string; sourcePaths: string[]; dependencies?: PinnedAssetReference[] }
function parseManifest(text: string): SourceManifest {
  const value = JSON.parse(text) as SourceManifest;
  if (value.version !== 1 || typeof value.id !== 'string' || !Array.isArray(value.sourcePaths)
    || value.sourcePaths.length > 512 || new Set(value.sourcePaths).size !== value.sourcePaths.length) throw new Error('Invalid loop.package.json');
  for (const path of value.sourcePaths) validateSourcePath(path);
  return value;
}
async function git(directory: string, args: string[]): Promise<string> {
  const child = Bun.spawn(['git', '-C', directory, ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(`Git source read failed: ${err.slice(0, 1000)}`);
  return out;
}
async function file(directory: string, path: string): Promise<string> {
  validateSourcePath(path);
  let current = directory;
  for (const part of path.split('/')) {
    current = join(current, part);
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) throw new Error('Source symlinks are not supported');
  }
  return readFile(current, 'utf8');
}
export async function snapshotDirectory(directory: string) {
  directory = resolve(directory);
  const manifest = parseManifest(await file(directory, 'loop.package.json'));
  const paths = [...new Set(['loop.package.json', ...manifest.sourcePaths])];
  const files = Object.fromEntries(await Promise.all(paths.map(async path => [path, await file(directory, path)] as const)));
  return createSourceSnapshot(files, manifest.dependencies);
}
export async function proposeDirectory(directory: string, baseCommit: string, repository: string) {
  directory = resolve(directory);
  if (!/^[a-f0-9]{40}$/.test(baseCommit)) throw new Error('A full base commit SHA is required');
  const manifest = parseManifest(await git(directory, ['show', `${baseCommit}:loop.package.json`]));
  const baseFiles: Record<string, string> = Object.create(null);
  for (const path of [...new Set(['loop.package.json', ...manifest.sourcePaths])]) {
    const mode = await git(directory, ['ls-tree', baseCommit, '--', path]);
    if (!mode.startsWith('100644 ') && !mode.startsWith('100755 ')) throw new Error('Base sources must be regular files');
    baseFiles[path] = await git(directory, ['show', `${baseCommit}:${path}`]);
  }
  const base = await createSourceSnapshot(baseFiles, manifest.dependencies);
  const next = await snapshotDirectory(directory);
  const paths = [...new Set([...Object.keys(base.files), ...Object.keys(next.files)])].sort();
  return { base, next, request: await createChangeRequest(base, next, { repository, baseCommit, files: Object.fromEntries(paths.map(path => [path, path])) }) };
}
if (import.meta.main) {
  const [command, directory, argument, repository, output] = process.argv.slice(2);
  if (command === 'snapshot' && directory && argument && !repository) {
    const snapshot = await snapshotDirectory(directory);
    await mkdir(dirname(resolve(argument)), { recursive: true });
    await writeFile(resolve(argument), JSON.stringify(snapshot, null, 2) + '\n');
    console.log(JSON.stringify({ source: snapshot.digest, fileCount: Object.keys(snapshot.files).length, output: resolve(argument) }));
  } else if (command === 'change' && directory && argument && repository && output) {
    const result = await proposeDirectory(directory, argument, repository);
    const destination = resolve(output); await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(result.request, null, 2) + '\n');
    await writeFile(`${destination}.base.json`, JSON.stringify(result.base, null, 2) + '\n');
    await writeFile(`${destination}.next.json`, JSON.stringify(result.next, null, 2) + '\n');
    console.log(JSON.stringify({ request: result.request.id, changedPaths: result.request.changes.map(change => change.path), output: destination, submitted: false }));
  } else if (command === 'submit' && directory && argument && repository && !output) {
    // Credentials remain process-only, never emitted in source or request JSON.
    const request = JSON.parse(await readFile(resolve(directory), 'utf8')) as ChangeRequest;
    if (request.projection.repository !== argument) throw new Error('Request repository differs from explicit allowlist');
    const port = createGitHubChangePort({ repositories: [argument], baseBranch: repository,
      fetch, token: async () => { const token = process.env.GH_TOKEN; if (!token) throw new Error('Set GH_TOKEN for explicit GitHub submission'); return token; } });
    console.log(JSON.stringify(await submitChangeRequest(request, port)));
  } else throw new Error('Usage: workspace snapshot <directory> <output.json> | workspace change <directory> <full-base-commit> <owner/repo> <output.json> | workspace submit <request.json> <owner/repo> <base-branch>');
}
