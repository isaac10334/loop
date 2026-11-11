import { expect, test } from 'bun:test';
import { createChangeRequest, createSourceSnapshot, submitChangeRequest, type ChangeRequest } from '@loop-kit/workspace';
import { createGitHubChangePort } from './github-change-port';

const repository = 'example/product', baseCommit = 'a'.repeat(40), baseTree = 'b'.repeat(40);
const sha = (value: string) => new Bun.CryptoHasher('sha1').update(value).digest('hex');
const blobSha = (content: string) => sha(`blob ${Buffer.byteLength(content)}\0${content}`);
const branch = (request: ChangeRequest) => `codex/loop-${request.id.slice(7, 31)}`;
type Entry = { path: string; mode: string; type: string; sha: string };

async function requestFixture() {
  const before = await createSourceSnapshot({ 'editor.ts': 'export const version = 1;', 'old.ts': 'remove me' });
  const after = await createSourceSnapshot({ 'editor.ts': 'export const version = 2;', 'added.ts': 'hello λ' });
  return createChangeRequest(before, after, { repository, baseCommit, files: { 'editor.ts': 'packages/editor.ts', 'old.ts': 'packages/old.ts', 'added.ts': 'packages/added.ts' } });
}

/** In-memory implementation of the GitHub REST protocol, not a live GitHub test. */
function githubFixture() {
  const blobs = new Map<string, string>();
  const leaf = (path: string, content: string, mode = '100644'): Entry => { const hash = blobSha(content); blobs.set(hash, content); return { path, sha: hash, mode, type: 'blob' }; };
  const trees = new Map<string, Entry[]>([[baseTree, [leaf('README.md', 'unrelated'), leaf('packages/editor.ts', 'export const version = 1;', '100755'), leaf('packages/old.ts', 'remove me')]]]);
  const commits = new Map<string, any>([[baseCommit, { sha: baseCommit, tree: { sha: baseTree }, parents: [], message: 'base' }]]);
  const refs = new Map<string, string>([['main', baseCommit]]);
  const pulls: any[] = [], history: { method: string; path: string; body: any }[] = [];
  let next = 100, loseRefResponse = false, losePullResponse = false, truncated = false;
  let intercept: ((method: string, path: string, body: any) => Response | undefined) | undefined;
  const identity = () => (++next).toString(16).padStart(40, '0');
  const json = (value: unknown, status = 200) => Response.json(value, { status });
  const fetch = (async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = new URL(String(input)), method = options?.method ?? 'GET', prefix = `/repos/${repository}`, path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (url.origin !== 'https://api.github.com' || !url.pathname.startsWith(prefix)) throw new Error('unexpected host or repository');
    if (new Headers(options?.headers).get('Authorization') !== 'Bearer fixture-secret' || options?.redirect !== 'error') throw new Error('missing authentication/redirect constraint');
    const body = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
    history.push({ method, path, body });
    const intercepted = intercept?.(method, path, body); if (intercepted) return intercepted;
    if (method === 'GET' && path.startsWith('/git/ref/heads/')) {
      const name = path.slice('/git/ref/heads/'.length), hash = refs.get(name);
      return hash ? json({ ref: `refs/heads/${name}`, object: { type: 'commit', sha: hash } }) : json({}, 404);
    }
    if (method === 'GET' && path.startsWith('/git/commits/')) return commits.has(path.slice(13)) ? json(commits.get(path.slice(13))) : json({}, 404);
    if (method === 'GET' && path.startsWith('/git/trees/')) { const hash = path.slice(11); return trees.has(hash) ? json({ sha: hash, truncated, tree: trees.get(hash) }) : json({}, 404); }
    if (method === 'GET' && path.startsWith('/contents/')) {
      const hash = url.searchParams.get('ref')!, contentPath = path.slice(10), commit = commits.get(hash), entry = trees.get(commit?.tree.sha)?.find(item => item.path === contentPath);
      if (!entry) return json({}, 404);
      const content = blobs.get(entry.sha)!;
      return json({ type: 'file', encoding: 'base64', sha: entry.sha, size: Buffer.byteLength(content), content: Buffer.from(content).toString('base64') });
    }
    if (method === 'GET' && path === '/pulls') return json(pulls.filter(pull => `${repository.split('/')[0]}:${pull.head.ref}` === url.searchParams.get('head') && pull.base.ref === url.searchParams.get('base')));
    if (method === 'POST' && path === '/git/blobs') { const hash = blobSha(body.content); blobs.set(hash, body.content); return json({ sha: hash }, 201); }
    if (method === 'POST' && path === '/git/trees') {
      const tree = new Map(trees.get(body.base_tree)!.map(entry => [entry.path, { ...entry }]));
      for (const entry of body.tree) { if (entry.sha === null) tree.delete(entry.path); else tree.set(entry.path, entry); }
      const hash = identity(); trees.set(hash, [...tree.values()]); return json({ sha: hash }, 201);
    }
    if (method === 'POST' && path === '/git/commits') { const hash = identity(); commits.set(hash, { sha: hash, tree: { sha: body.tree }, parents: body.parents.map((sha: string) => ({ sha })), message: body.message }); return json({ sha: hash }, 201); }
    if (method === 'POST' && path === '/git/refs') {
      const name = body.ref.slice('refs/heads/'.length); if (refs.has(name)) return json({}, 422);
      refs.set(name, body.sha); if (loseRefResponse) { loseRefResponse = false; throw new Error('lost response containing fixture-secret'); } return json({ ref: body.ref, object: { type: 'commit', sha: body.sha } }, 201);
    }
    if (method === 'POST' && path === '/pulls') {
      const pull = { number: pulls.length + 1, html_url: `https://github.com/${repository}/pull/${pulls.length + 1}`, body: body.body, draft: body.draft,
        head: { ref: body.head, sha: refs.get(body.head), repo: { full_name: repository } }, base: { ref: body.base, repo: { full_name: repository } } };
      pulls.push(pull); if (losePullResponse) { losePullResponse = false; throw new Error('lost pull response'); } return json(pull, 201);
    }
    throw new Error(`Unhandled protocol route: ${method} ${path}`);
  }) as typeof globalThis.fetch;
  return { fetch, history, trees, commits, refs, pulls, blobs,
    options: { repositories: [repository], baseBranch: 'main', fetch, token: async () => 'fixture-secret' },
    set loseRefResponse(value: boolean) { loseRefResponse = value; }, set losePullResponse(value: boolean) { losePullResponse = value; },
    set truncated(value: boolean) { truncated = value; }, set intercept(value: typeof intercept) { intercept = value; } };
}

test('creates exact projected draft review without changing base ref or unrelated file/mode', async () => {
  const fixture = githubFixture(), request = await requestFixture(), port = createGitHubChangePort(fixture.options);
  const result = await submitChangeRequest(request, port);
  expect(result.url).toBe(`https://github.com/${repository}/pull/1`);
  expect(fixture.refs.get('main')).toBe(baseCommit);
  expect(fixture.pulls[0].draft).toBe(true);
  const head = fixture.commits.get(fixture.refs.get(branch(request))!), tree = fixture.trees.get(head.tree.sha)!;
  expect(head.parents).toEqual([{ sha: baseCommit }]);
  expect(tree.find(entry => entry.path === 'README.md')?.sha).toBe(blobSha('unrelated'));
  expect(tree.find(entry => entry.path === 'packages/editor.ts')?.mode).toBe('100755');
  expect(tree.some(entry => entry.path === 'packages/old.ts')).toBe(false);
  expect(tree.find(entry => entry.path === 'packages/added.ts')?.sha).toBe(blobSha('hello λ'));
  expect(fixture.history.filter(item => item.path === '/git/refs' && item.method === 'POST')).toHaveLength(1);
  expect(fixture.history.some(item => ['PATCH', 'DELETE', 'PUT'].includes(item.method) || item.path.endsWith('/merge'))).toBe(false);
});

test('recovers lost ref and PR responses and retries without duplicate commits or pull requests', async () => {
  const fixture = githubFixture(), request = await requestFixture(), port = createGitHubChangePort(fixture.options);
  fixture.loseRefResponse = true; fixture.losePullResponse = true;
  expect((await submitChangeRequest(request, port)).url).toContain('/pull/1');
  const posts = fixture.history.filter(item => item.method === 'POST').length;
  expect((await submitChangeRequest(request, port)).url).toContain('/pull/1');
  expect(fixture.history.filter(item => item.method === 'POST')).toHaveLength(posts);
  expect(fixture.pulls).toHaveLength(1);
});

test('rejects unknown review branches, tampered trees and retained-marker PR edits', async () => {
  const request = await requestFixture();
  const unknown = githubFixture(); unknown.refs.set(branch(request), baseCommit);
  await expect(submitChangeRequest(request, createGitHubChangePort(unknown.options))).rejects.toThrow('not owned');
  expect(unknown.history.some(item => item.method === 'POST')).toBe(false);
  const fixture = githubFixture(), port = createGitHubChangePort(fixture.options);
  await submitChangeRequest(request, port);
  const head = fixture.commits.get(fixture.refs.get(branch(request))!), entries = fixture.trees.get(head.tree.sha)!;
  const unrelated = entries.find(entry => entry.path === 'README.md')!; unrelated.sha = 'd'.repeat(40);
  await expect(submitChangeRequest(request, port)).rejects.toThrow('tree differs');
  unrelated.sha = blobSha('unrelated');
  fixture.pulls[0].body += '\nUnreviewed change';
  await expect(submitChangeRequest(request, port)).rejects.toThrow('pull request does not match');
});

test('rejects stale base, truncated trees, symlink destinations, and unallowlisted repositories before writes', async () => {
  const request = await requestFixture();
  const stale = githubFixture(); stale.refs.set('main', 'c'.repeat(40));
  await expect(submitChangeRequest(request, createGitHubChangePort(stale.options))).rejects.toThrow('base branch advanced');
  expect(stale.history.some(item => item.method === 'POST')).toBe(false);
  const truncated = githubFixture(); truncated.truncated = true;
  await expect(submitChangeRequest(request, createGitHubChangePort(truncated.options))).rejects.toThrow('truncated');
  expect(truncated.history.some(item => item.method === 'POST')).toBe(false);
  const symlink = githubFixture(); symlink.trees.get(baseTree)!.find(entry => entry.path === 'packages/editor.ts')!.mode = '120000';
  await expect(submitChangeRequest(request, createGitHubChangePort(symlink.options))).rejects.toThrow('regular file');
  const denied = githubFixture();
  await expect(createGitHubChangePort(denied.options).readFile('other/repo', baseCommit, 'file')).rejects.toThrow('not allowed');
  expect(denied.history).toHaveLength(0);
});

test('reads only pinned bounded UTF-8 content; returns null for 404 and rejects binary or malformed base64', async () => {
  const fixture = githubFixture(), port = createGitHubChangePort(fixture.options);
  expect(await port.readFile(repository, baseCommit, 'README.md')).toBe('unrelated');
  expect(await port.readFile(repository, baseCommit, 'missing.ts')).toBeNull();
  await expect(port.readFile(repository, 'main', 'README.md')).rejects.toThrow('identity');
  fixture.intercept = (_, path) => path.startsWith('/contents/') ? Response.json({ type: 'file', encoding: 'base64', size: 1, content: '/w==', sha: 'd'.repeat(40) }) : undefined;
  await expect(port.readFile(repository, baseCommit, 'README.md')).rejects.toThrow('UTF-8');
  fixture.intercept = (_, path) => path.startsWith('/contents/') ? Response.json({ type: 'file', encoding: 'base64', size: 1, content: '*', sha: 'd'.repeat(40) }) : undefined;
  await expect(port.readFile(repository, baseCommit, 'README.md')).rejects.toThrow('base64');
});

test('cancellation suppresses late publication and transport errors never expose tokens', async () => {
  const fixture = githubFixture(), controller = new AbortController(), request = await requestFixture();
  fixture.intercept = (method, path) => { if (method === 'POST' && path === '/git/blobs') controller.abort(new Error('cancelled proof')); return undefined; };
  await expect(submitChangeRequest(request, createGitHubChangePort({ ...fixture.options, signal: controller.signal }), controller.signal)).rejects.toThrow('cancelled proof');
  expect(fixture.history.some(item => item.method === 'POST' && item.path === '/git/refs')).toBe(false);
  expect(fixture.pulls).toHaveLength(0);
  const broken = createGitHubChangePort({ ...fixture.options, fetch: async () => { throw new Error('fixture-secret'); } });
  try { await broken.readFile(repository, baseCommit, 'README.md'); throw new Error('expected rejection'); }
  catch (error) { expect((error as Error).message).toBe('GitHub request failed (GET)'); }
});

test('rejects mutated descriptors and arbitrary review branch names', async () => {
  const fixture = githubFixture(), request = await requestFixture(), port = createGitHubChangePort(fixture.options);
  await expect(port.createRequest({ ...request, proposed: `sha256:${'f'.repeat(64)}` }, branch(request))).rejects.toThrow('digest mismatch');
  await expect(port.createRequest(request, 'main')).rejects.toThrow('deterministic');
  expect(fixture.history).toHaveLength(0);
});

test('transported JSON key ordering does not change request identity or retry reconciliation', async () => {
  const fixture = githubFixture(), request = await requestFixture(), port = createGitHubChangePort(fixture.options);
  const reordered = Object.fromEntries(Object.entries(request).reverse()) as unknown as ChangeRequest;
  const transported = { ...reordered, projection: { files: Object.fromEntries(Object.entries(request.projection.files).reverse()), baseCommit, repository },
    changes: request.changes.map(change => ({ content: change.content, expected: change.expected, path: change.path })) };
  expect((await submitChangeRequest(transported, port)).url).toContain('/pull/1');
  expect((await submitChangeRequest(request, port)).url).toContain('/pull/1');
  expect(fixture.pulls).toHaveLength(1);
});
