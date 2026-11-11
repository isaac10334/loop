/** GitHub REST adapter for immutable Loop review requests. Credentials and HTTP
 * are injected by the trusted caller. Only new namespaced refs and draft PRs are
 * created; no branch updates, default-branch writes, merging or token persistence.
 * Protocol: https://docs.github.com/en/rest/git/trees and /rest/pulls/pulls.
 */
import { changeRequestDigest, contentDigest, validateSourcePath, type ChangeRequest, type Digest, type GitHubChangePort } from '@loop-kit/workspace';

export interface GitHubChangePortOptions {
  readonly repositories: readonly string[];
  readonly baseBranch: string;
  readonly fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readonly token: () => Promise<string>;
  readonly signal?: AbortSignal;
}
type Json = Record<string, any>;
type Entry = { path: string; mode: string; type: string; sha: string };
const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const maxSourceBytes = 1024 * 1024;
const encoder = new TextEncoder();
const branchFor = (id: Digest) => `codex/loop-${id.slice(7, 31)}`;
const marker = (request: ChangeRequest) => `<!-- loop-change-v1:${request.id} -->`;
const title = (request: ChangeRequest) => `Loop change ${request.id.slice(7, 19)}`;
const message = (request: ChangeRequest) => `${title(request)}\n\nLoop-Request: ${request.id}\nLoop-Base: ${request.projection.baseCommit}\nLoop-Source: ${request.proposed}`;
const body = (request: ChangeRequest) => `${marker(request)}\n\nSource: \`${request.base}\` → \`${request.proposed}\`\n\nGit base: \`${request.projection.baseCommit}\`. This request changes only explicitly projected source files. Review and merge remain repository-owner actions.`;
function sha(value: unknown): string { if (typeof value !== 'string' || !shaPattern.test(value)) throw new Error('Invalid GitHub object identity'); return value; }
function repositoryName(value: string): string {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) || value.split('/').some(part => part === '.' || part === '..')) throw new Error('Invalid GitHub repository');
  return value;
}
function refName(value: string): string {
  if (!value || value.length > 200 || /[\x00-\x20~^:?*\[\\]/.test(value) || value.includes('..') || value.includes('@{') || value.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.') || part.endsWith('.lock'))) throw new Error('Invalid GitHub base branch');
  return value;
}
async function gitBlob(content: string): Promise<string> {
  const bytes = encoder.encode(content), prefix = encoder.encode(`blob ${bytes.length}\0`), value = new Uint8Array(prefix.length + bytes.length);
  value.set(prefix); value.set(bytes, prefix.length);
  const hash = await crypto.subtle.digest('SHA-1', value);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function validateRequest(value: ChangeRequest): Promise<ChangeRequest> {
  const request: ChangeRequest = structuredClone(value), { id, ...payload } = request;
  if (!digestPattern.test(id) || request.format !== 'loop-change-v1' || !digestPattern.test(request.base) || !digestPattern.test(request.proposed) || await changeRequestDigest(payload) !== id) throw new Error('Change request digest mismatch');
  repositoryName(request.projection.repository); sha(request.projection.baseCommit);
  if (encoder.encode(JSON.stringify(request)).length > 2 * maxSourceBytes || !Array.isArray(request.changes) || !request.changes.length || request.changes.length > 512) throw new Error('Change request exceeds adapter limits');
  const destinations = new Set(Object.values(request.projection.files));
  const seen = new Set<string>();
  for (const change of request.changes) {
    validateSourcePath(change.path);
    if (!destinations.has(change.path) || change.path.split('/').some(part => /^\.env(?:\.|$)/i.test(part) || part.toLowerCase() === '.github') || seen.has(change.path.toLowerCase()) || (change.content !== null && typeof change.content !== 'string') || (change.expected !== null && !digestPattern.test(change.expected))) throw new Error('Invalid projected Git change');
    if (change.content !== null && encoder.encode(change.content).length > maxSourceBytes) throw new Error('Source file exceeds adapter limit');
    seen.add(change.path.toLowerCase());
  }
  const paths = [...seen].sort();
  if (paths.some((path, index) => index > 0 && path.startsWith(`${paths[index - 1]}/`))) throw new Error('Overlapping projected Git paths');
  return request;
}

/** Creates a repository-scoped adapter. Existing branches are accepted only after
 * parent, exact commit metadata, complete leaf-tree and byte verification. The
 * complete request is required for retry lookup; a body marker alone is insufficient.
 * Trees truncated by GitHub are rejected. Callers retain all merge authority.
 */
export function createGitHubChangePort(options: GitHubChangePortOptions): GitHubChangePort {
  const repositories = new Set(options.repositories.map(name => repositoryName(name).toLowerCase()));
  if (!repositories.size) throw new Error('GitHub repository allowlist is empty');
  const baseBranch = refName(options.baseBranch);
  const repoPath = (repository: string) => {
    repositoryName(repository);
    if (!repositories.has(repository.toLowerCase())) throw new Error('GitHub repository is not allowed');
    return `/repos/${repository.split('/').map(encodeURIComponent).join('/')}`;
  };
  const cancellation = (signal?: AbortSignal) => AbortSignal.any([options.signal, signal, AbortSignal.timeout(30_000)].filter((value): value is AbortSignal => !!value));
  async function api(path: string, method = 'GET', input?: unknown, signal?: AbortSignal, missing = false): Promise<any> {
    const active = cancellation(signal); active.throwIfAborted();
    let token: string;
    try { token = await options.token(); } catch { active.throwIfAborted(); throw new Error('GitHub token supplier failed'); }
    active.throwIfAborted();
    if (!token || /\s/.test(token) || token.length > 4096) throw new Error('GitHub token supplier returned no usable credential');
    let response: Response;
    try {
      response = await options.fetch(`https://api.github.com${path}`, { method, redirect: 'error', signal: active,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
    } catch { active.throwIfAborted(); throw new Error(`GitHub request failed (${method})`); }
    active.throwIfAborted();
    if (missing && response.status === 404) { await response.body?.cancel(); return undefined; }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`GitHub request rejected (${response.status}, ${method})`); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('GitHub response has no body');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) { active.throwIfAborted(); const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 8 * maxSourceBytes) { await reader.cancel(); throw new Error('GitHub response exceeds adapter limit'); } chunks.push(next.value); }
    } finally { reader.releaseLock(); }
    active.throwIfAborted();
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new Error('Invalid GitHub JSON response'); }
  }
  async function readFile(repository: string, commit: string, path: string, signal?: AbortSignal): Promise<string | null> {
    const root = repoPath(repository); sha(commit); validateSourcePath(path);
    const result = await api(`${root}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commit}`, 'GET', undefined, signal, true);
    if (result === undefined) return null;
    if (result.type !== 'file' || result.encoding !== 'base64' || typeof result.content !== 'string' || !Number.isSafeInteger(result.size) || result.size < 0 || result.size > maxSourceBytes) throw new Error('Expected bounded GitHub text file');
    const encoded = result.content.replace(/[\r\n]/g, '');
    if (encoded.length > 1_400_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Invalid GitHub base64 file');
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length !== result.size || bytes.toString('base64') !== encoded) throw new Error('GitHub file byte-size mismatch');
    let content: string;
    try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new Error('GitHub source is not UTF-8 text'); }
    if (await gitBlob(content) !== sha(result.sha)) throw new Error('GitHub file blob identity mismatch');
    return content;
  }
  async function tree(repository: string, treeSha: string, signal?: AbortSignal): Promise<Map<string, Entry>> {
    const result = await api(`${repoPath(repository)}/git/trees/${sha(treeSha)}?recursive=1`, 'GET', undefined, signal);
    if (result.sha !== treeSha || result.truncated !== false || !Array.isArray(result.tree) || result.tree.length > 100_000) throw new Error('GitHub tree is truncated or invalid');
    const entries = new Map<string, Entry>(), directories: string[] = [];
    for (const entry of result.tree) {
      if (typeof entry.path !== 'string' || entry.path.length > 4096 || typeof entry.mode !== 'string' || !['tree', 'blob', 'commit'].includes(entry.type)) throw new Error('Invalid GitHub tree entry');
      sha(entry.sha);
      if (entry.type === 'tree') {
        if (entry.mode !== '040000') throw new Error('Invalid GitHub directory mode');
        directories.push(entry.path); continue;
      }
      if (entries.has(entry.path)) throw new Error('Duplicate GitHub tree entry');
      entries.set(entry.path, { path: entry.path, mode: entry.mode, type: entry.type, sha: entry.sha });
    }
    // Ordinary Git checkouts cannot track empty directories. Reject API-crafted
    // empty trees so leaf equality cannot conceal an unrelated empty-tree edit.
    const parents = new Set<string>();
    for (const path of entries.keys()) { const parts = path.split('/'); for (let i = 1; i < parts.length; i++) parents.add(parts.slice(0, i).join('/')); }
    if (directories.some(path => !parents.has(path))) throw new Error('GitHub empty directory trees are unsupported');
    return entries;
  }
  async function commit(repository: string, commitSha: string, signal?: AbortSignal): Promise<Json> {
    const result = await api(`${repoPath(repository)}/git/commits/${sha(commitSha)}`, 'GET', undefined, signal);
    if (result.sha !== commitSha || !Array.isArray(result.parents)) throw new Error('Invalid GitHub commit');
    sha(result.tree?.sha); return result;
  }
  async function branch(repository: string, name: string, signal?: AbortSignal): Promise<string | undefined> {
    const result = await api(`${repoPath(repository)}/git/ref/heads/${name.split('/').map(encodeURIComponent).join('/')}`, 'GET', undefined, signal, true);
    if (result === undefined) return undefined;
    if (result.ref !== `refs/heads/${name}` || result.object?.type !== 'commit') throw new Error('Unexpected GitHub ref');
    return sha(result.object.sha);
  }
  async function desiredTree(request: ChangeRequest, baseTree: Map<string, Entry>, signal?: AbortSignal): Promise<Map<string, Entry>> {
    const desired = new Map(baseTree), lowercase = new Map([...baseTree.keys()].map(path => [path.toLowerCase(), path]));
    for (const change of request.changes) {
      signal?.throwIfAborted(); options.signal?.throwIfAborted();
      const before = baseTree.get(change.path);
      if (before && (before.type !== 'blob' || !['100644', '100755'].includes(before.mode))) throw new Error('Projected Git destination is not a regular file');
      if (lowercase.has(change.path.toLowerCase()) && lowercase.get(change.path.toLowerCase()) !== change.path) throw new Error('Case-colliding Git destination');
      const parts = change.path.split('/');
      if (parts.slice(0, -1).some((_, index) => baseTree.has(parts.slice(0, index + 1).join('/')))) throw new Error('Git destination traverses a non-directory');
      const current = await readFile(request.projection.repository, request.projection.baseCommit, change.path, signal);
      if ((current === null ? null : await contentDigest(current)) !== change.expected || (before === undefined) !== (current === null)) throw new Error(`Git base conflict: ${change.path}`);
      if (change.content === null) desired.delete(change.path);
      else desired.set(change.path, { path: change.path, type: 'blob', mode: before?.mode ?? '100644', sha: await gitBlob(change.content) });
    }
    return desired;
  }
  async function verifyHead(request: ChangeRequest, head: string, signal?: AbortSignal): Promise<void> {
    const repository = request.projection.repository, base = await commit(repository, request.projection.baseCommit, signal), actual = await commit(repository, head, signal);
    if (actual.parents.length !== 1 || actual.parents[0]?.sha !== request.projection.baseCommit || actual.message !== message(request)) throw new Error('GitHub branch is not owned by this immutable Loop request');
    const desired = await desiredTree(request, await tree(repository, base.tree.sha, signal), signal), actualTree = await tree(repository, actual.tree.sha, signal);
    if (desired.size !== actualTree.size || [...desired].some(([path, expected]) => { const found = actualTree.get(path); return !found || found.mode !== expected.mode || found.type !== expected.type || found.sha !== expected.sha; })) throw new Error('GitHub branch tree differs from the requested changes');
  }
  async function pulls(repository: string, name: string, signal?: AbortSignal): Promise<Json[]> {
    const query = new URLSearchParams({ state: 'all', head: `${repository.split('/')[0]}:${name}`, base: baseBranch, per_page: '100' });
    const result = await api(`${repoPath(repository)}/pulls?${query}`, 'GET', undefined, signal);
    if (!Array.isArray(result) || result.length >= 100) throw new Error('GitHub request lookup exceeds adapter limit');
    return result;
  }
  function validatePull(result: Json, request: ChangeRequest, head: string): { url: string } {
    const repository = request.projection.repository, name = branchFor(request.id);
    if (result.body !== body(request) || result.head?.ref !== name || result.head?.sha !== head || result.head?.repo?.full_name?.toLowerCase() !== repository.toLowerCase() || result.base?.ref !== baseBranch || result.base?.repo?.full_name?.toLowerCase() !== repository.toLowerCase()) throw new Error('GitHub pull request does not match the immutable Loop request');
    const url = typeof result.html_url === 'string' ? new URL(result.html_url) : undefined;
    if (!url || url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash || !new RegExp(`^/${repository.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/pull/[1-9][0-9]*$`, 'i').test(url.pathname)) throw new Error('Invalid GitHub pull request URL');
    return { url: url.href };
  }
  async function findRequest(repository: string, id: Digest, supplied?: ChangeRequest, signal?: AbortSignal): Promise<{ url: string } | undefined> {
    repoPath(repository); if (!digestPattern.test(id)) throw new Error('Invalid Loop request identity');
    const name = branchFor(id), head = await branch(repository, name, signal), found = await pulls(repository, name, signal);
    if (!head && !found.length) return undefined;
    if (!supplied) throw new Error('Complete Loop request required to verify an existing GitHub branch');
    const request = await validateRequest(supplied);
    if (request.id !== id || request.projection.repository !== repository || found.length > 1) throw new Error('Ambiguous GitHub Loop request');
    const commitSha = head ?? sha(found[0]?.head?.sha);
    await verifyHead(request, commitSha, signal);
    return found.length ? validatePull(found[0]!, request, commitSha) : undefined;
  }
  async function createRequest(value: ChangeRequest, name: string, signal?: AbortSignal): Promise<{ url: string }> {
    const request = await validateRequest(value), repository = request.projection.repository, root = repoPath(repository);
    if (name !== branchFor(request.id) || name === baseBranch) throw new Error('Only the deterministic Loop review branch may be created');
    const existing = await findRequest(repository, request.id, request, signal);
    if (existing) return existing;
    let head = await branch(repository, name, signal);
    if (!head) {
      if (await branch(repository, baseBranch, signal) !== request.projection.baseCommit) throw new Error('Git base branch advanced; prepare a new checked request');
      const base = await commit(repository, request.projection.baseCommit, signal), initial = await tree(repository, base.tree.sha, signal), desired = await desiredTree(request, initial, signal);
      const entries: { path: string; mode: string; type: string; sha: string | null }[] = [];
      for (const change of request.changes) {
        let blobSha: string | null = null;
        if (change.content !== null) {
          const created = await api(`${root}/git/blobs`, 'POST', { content: change.content, encoding: 'utf-8' }, signal);
          blobSha = sha(created.sha); if (blobSha !== desired.get(change.path)!.sha) throw new Error('Created GitHub blob identity mismatch');
        }
        entries.push({ path: change.path, mode: initial.get(change.path)?.mode ?? '100644', type: 'blob', sha: blobSha });
      }
      const createdTree = await api(`${root}/git/trees`, 'POST', { base_tree: base.tree.sha, tree: entries }, signal);
      const createdCommit = await api(`${root}/git/commits`, 'POST', { message: message(request), tree: sha(createdTree.sha), parents: [request.projection.baseCommit] }, signal);
      const proposedHead = sha(createdCommit.sha);
      await verifyHead(request, proposedHead, signal);
      try { await api(`${root}/git/refs`, 'POST', { ref: `refs/heads/${name}`, sha: proposedHead }, signal); }
      catch (error) { signal?.throwIfAborted(); options.signal?.throwIfAborted(); if (!await branch(repository, name, signal)) throw error; }
      head = await branch(repository, name, signal);
      if (!head) throw new Error('GitHub review branch was not created');
    }
    await verifyHead(request, head, signal);
    const concurrent = await findRequest(repository, request.id, request, signal);
    if (concurrent) return concurrent;
    if (await branch(repository, baseBranch, signal) !== request.projection.baseCommit) throw new Error('Git base branch advanced; review branch retained without opening a PR');
    try {
      const result = await api(`${root}/pulls`, 'POST', { title: title(request), head: name, base: baseBranch, body: body(request), draft: true, maintainer_can_modify: false }, signal);
      return validatePull(result, request, head);
    } catch (error) {
      signal?.throwIfAborted(); options.signal?.throwIfAborted();
      const recovered = await findRequest(repository, request.id, request, signal);
      if (recovered) return recovered;
      throw error;
    }
  }
  return { readFile, findRequest, createRequest };
}
