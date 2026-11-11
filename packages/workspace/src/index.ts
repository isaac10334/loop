/** Portable source/build and foreground APIs plus checked Git change requests. */
export * from "./source.js";
export * from "./foreground.js";
import { contentDigest, validateSourcePath, verifySourceSnapshot, type Digest, type SourceSnapshot } from "./source.js";

const encoder = new TextEncoder();
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const MAX_BYTES = 1024 * 1024;
function assertDigest(value: string): asserts value is Digest {
  if (!digestPattern.test(value)) throw new TypeError("Invalid SHA-256 digest");
}

/** Explicit mapping into a Git-owned codebase. Paths are files, never directory wildcards. */
export interface GitProjection {
  readonly repository: string;
  readonly baseCommit: string;
  readonly files: Readonly<Record<string, string>>;
}
export interface FileChange {
  readonly path: string;
  readonly expected: Digest | null;
  readonly content: string | null;
}
/** Immutable review request. It cannot merge, run a build or grant repository access. */
export interface ChangeRequest {
  readonly format: "loop-change-v1";
  readonly id: Digest;
  readonly base: Digest;
  readonly proposed: Digest;
  readonly projection: GitProjection;
  readonly changes: readonly FileChange[];
}

function changePayload(request: Omit<ChangeRequest, "id">): Omit<ChangeRequest, "id"> {
  assertDigest(request.base); assertDigest(request.proposed);
  return {
    format: request.format, base: request.base, proposed: request.proposed,
    projection: { repository: request.projection.repository, baseCommit: request.projection.baseCommit,
      files: Object.fromEntries(Object.entries(request.projection.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) },
    changes: request.changes.map(change => ({ path: change.path, expected: change.expected, content: change.content }))
      .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  };
}

/** Canonical request identity across JSON member ordering. Source/mapping paths
 * and change records are sorted; only declared wire fields participate. */
export function changeRequestDigest(request: Omit<ChangeRequest, "id">): Promise<Digest> {
  return contentDigest(JSON.stringify(changePayload(request)));
}

/** Compute additions/updates/deletions against a verified base. All changed paths
 * need explicit mappings. A Git adapter must also check the repository base SHA. */
export async function createChangeRequest(base: SourceSnapshot, next: SourceSnapshot, projection: GitProjection): Promise<ChangeRequest> {
  projection = structuredClone(projection);
  base = await verifySourceSnapshot(base); next = await verifySourceSnapshot(next);
  if (!/^[a-f0-9]{40}$/.test(projection.baseCommit) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(projection.repository)) throw new TypeError("Expected owner/repository and full Git commit SHA");
  const destinations = new Set<string>();
  const mappings = Object.fromEntries(Object.entries(projection.files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  for (const [source, destination] of Object.entries(mappings)) {
    validateSourcePath(source); validateSourcePath(destination);
    if (destination.split("/").some(part => /^\.env(?:\.|$)/i.test(part) || part.toLowerCase() === ".github")) throw new TypeError("Protected Git destination");
    if (destinations.has(destination.toLowerCase())) throw new TypeError("Duplicate Git destination");
    destinations.add(destination.toLowerCase());
  }
  const changes: FileChange[] = [];
  for (const source of [...new Set([...Object.keys(base.files), ...Object.keys(next.files)])].sort()) {
    const before = Object.hasOwn(base.files, source) ? base.files[source]! : null;
    const after = Object.hasOwn(next.files, source) ? next.files[source]! : null;
    if (before === after) continue;
    const destination = Object.hasOwn(mappings, source) ? mappings[source] : undefined;
    if (!destination) throw new Error(`Unmapped changed source: ${source}`);
    changes.push(Object.freeze({ path: destination, expected: before === null ? null : await contentDigest(before), content: after }));
  }
  if (!changes.length) throw new Error("No source changes");
  if (JSON.stringify(base.dependencies) !== JSON.stringify(next.dependencies)) throw new Error("Dependency pin changes are not supported in this profile");
  const pinnedProjection = Object.freeze({ repository: projection.repository, baseCommit: projection.baseCommit, files: Object.freeze(mappings) });
  const request = { format: "loop-change-v1" as const, base: base.digest, proposed: next.digest, projection: pinnedProjection, changes: Object.freeze(changes) };
  return Object.freeze({ ...request, id: await changeRequestDigest(request) });
}

/** Narrow authenticated GitHub adapter. Implementations must restrict repository,
 * branch namespace and permissions. find/create methods must reconcile retries. */
export interface GitHubChangePort {
  readFile(repository: string, commit: string, path: string): Promise<string | null>;
  findRequest(repository: string, id: Digest, request: ChangeRequest, signal?: AbortSignal): Promise<{ url: string } | undefined>;
  createRequest(request: ChangeRequest, branch: string, signal?: AbortSignal): Promise<{ url: string }>;
}

/** Revalidate request identity and base file bytes before invoking a privileged
 * adapter. Creates a review branch/PR only; never updates or merges the base. */
export async function submitChangeRequest(request: ChangeRequest, port: GitHubChangePort, signal?: AbortSignal): Promise<{ url: string }> {
  request = structuredClone(request);
  if (encoder.encode(JSON.stringify(request)).byteLength > MAX_BYTES * 2 || !Array.isArray(request.changes) || request.changes.length > 512) throw new TypeError("Change request exceeds limits");
  for (const change of request.changes) Object.freeze(change);
  Object.freeze(request.changes);
  Object.freeze(request.projection.files); Object.freeze(request.projection); Object.freeze(request);
  signal?.throwIfAborted();
  const { id, ...payload } = request;
  if (request.format !== "loop-change-v1" || await changeRequestDigest(payload) !== id) throw new Error("Change request digest mismatch");
  if (!/^[a-f0-9]{40}$/.test(request.projection.baseCommit) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(request.projection.repository)) throw new TypeError("Invalid Git projection");
  const existing = await port.findRequest(request.projection.repository, id, request, signal);
  signal?.throwIfAborted();
  if (existing) return existing;
  const destinations = new Set(Object.values(request.projection.files));
  const seen = new Set<string>();
  for (const change of request.changes) {
    validateSourcePath(change.path);
    if (!destinations.has(change.path) || seen.has(change.path.toLowerCase()) || change.path.split("/").some((part: string) => /^\.env(?:\.|$)/i.test(part) || part.toLowerCase() === ".github")) throw new TypeError("Invalid projected change");
    if (change.expected !== null) assertDigest(change.expected);
    if (change.content !== null && typeof change.content !== "string") throw new TypeError("Text change required");
    seen.add(change.path.toLowerCase());
    const current = await port.readFile(request.projection.repository, request.projection.baseCommit, change.path);
    signal?.throwIfAborted();
    if ((current === null ? null : await contentDigest(current)) !== change.expected) throw new Error(`Git base conflict: ${change.path}`);
  }
  if (!seen.size) throw new Error("No source changes");
  return port.createRequest(request, `codex/loop-${id.slice(7, 31)}`, signal);
}
