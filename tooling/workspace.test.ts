import { expect, test } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { proposeDirectory, snapshotDirectory } from './workspace';

test('file workspace reads a pinned Git base and produces only the actual source change', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'loop-workspace-git-'));
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(['git', '-C', directory, ...args], { stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode) throw new Error(new TextDecoder().decode(result.stderr));
    return new TextDecoder().decode(result.stdout).trim();
  };
  try {
    await writeFile(join(directory, 'loop.package.json'), JSON.stringify({ version: 1, id: 'example:source', sourcePaths: ['toString'], dependencies: [] }));
    await writeFile(join(directory, 'toString'), 'before\n');
    git('init', '--initial-branch=main');
    git('-c', 'core.autocrlf=false', 'add', '.');
    git('-c', 'user.name=Loop fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Fixture baseline');
    const base = git('rev-parse', 'HEAD');
    await writeFile(join(directory, 'toString'), 'after\n');
    const result = await proposeDirectory(directory, base, 'example/source');
    expect(Object.entries(result.base.files).find(([name]) => name === 'toString')?.[1]).toBe('before\n');
    expect(result.request.changes).toHaveLength(1);
    expect(result.request.changes[0]!.content).toBe('after\n');
    expect((await snapshotDirectory(directory)).digest).toBe(result.next.digest);
    expect(result.base.files['loop.package.json']).toBeDefined();
    await expect(proposeDirectory(directory, 'main', 'example/source')).rejects.toThrow('full base commit');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
