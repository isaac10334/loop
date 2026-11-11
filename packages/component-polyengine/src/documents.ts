/** Host-issued nominal document grants. Identity/diagnostics alone cannot mint a grant. */
export interface DocumentSnapshot { readonly revision: string; readonly source: string }
export type DocumentFailure = { readonly kind: "denied" | "revoked" | "cancelled" | "unavailable" } | { readonly kind: "invalid-source"; readonly value: string } | { readonly kind: "conflict"; readonly value: DocumentSnapshot };
export class DocumentOperationError extends Error {
  constructor(readonly failure: DocumentFailure) { super(failure.kind); }
}
function fail(kind: "denied" | "revoked" | "cancelled"): never { throw new DocumentOperationError({ kind }); }
const encoder = new TextEncoder(), SOURCE_BYTES = 1048576, RESULT_BYTES = SOURCE_BYTES + 256;
/** Bound UTF-8 bytes before sending to an engine or committing to storage. */
export function checkSource(source: unknown): asserts source is string {
  if (typeof source !== "string" || source.length > SOURCE_BYTES || encoder.encode(source).byteLength > SOURCE_BYTES) throw new DocumentOperationError({ kind: "invalid-source", value: "Source exceeds 1MiB UTF-8" });
}
/** Match native's source-plus-metadata output budget without allowing extra source bytes. */
export function checkDocumentResult(result: unknown): asserts result is string {
  if (typeof result !== "string" || result.length > RESULT_BYTES || encoder.encode(result).byteLength > RESULT_BYTES) throw new Error("Component result budget/type violation");
}
/** Keep invalid revision strings out of cross-worker messages as well as storage. */
export function checkExpectedRevision(revision: unknown): asserts revision is string {
  if (typeof revision !== "string" || revision.length > 128 || encoder.encode(revision).byteLength > 128) throw new DocumentOperationError({ kind: "invalid-source", value: "Invalid expected revision" });
}
/** Validate the bounded WIT failure variant before forwarding it across a trust boundary. */
export function checkDocumentFailure(failure: unknown): asserts failure is DocumentFailure {
  const invalid = (): never => { throw new Error("Invalid Component failure payload"); };
  const record = (value: unknown, allowed: readonly string[]): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== "string" || !allowed.includes(key) || !descriptors[key]!.enumerable || !("value" in descriptors[key]!))) return invalid();
    return Object.fromEntries(keys.map(key => [key, descriptors[key as string]!.value]));
  };
  try {
    const parsed = record(failure, ["kind", "value"]), kind = parsed.kind;
    if (kind === "denied" || kind === "revoked" || kind === "cancelled" || kind === "unavailable") { if (Object.hasOwn(parsed, "value")) invalid(); return; }
    if (kind === "invalid-source") { if (typeof parsed.value !== "string" || parsed.value.length > 65536 || encoder.encode(parsed.value).byteLength > 65536) invalid(); return; }
    if (kind === "conflict") { const snapshot = record(parsed.value, ["revision", "source"]); checkExpectedRevision(snapshot.revision); checkSource(snapshot.source); return; }
    invalid();
  } catch { invalid(); }
}
const grants = new WeakMap<object, { owner: DocumentOwner; principal: string; read: boolean; write: boolean; generation: number; revoked: boolean }>();
declare const nominal: unique symbol;
/** Opaque host ticket, never serialized to a guest or reconstructed from JSON. */
export interface DocumentGrant { readonly [nominal]: true }
export interface DocumentOwner {
  readonly snapshot: DocumentSnapshot;
  inspect(): { readonly closed: boolean; readonly generation: number; readonly liveGrants: number; readonly pendingOperations: number };
  /** New grant bound to current owner generation and named principal; policy rechecks every operation. */
  issue(rights: { readonly principal: string; readonly read: boolean; readonly write: boolean }): DocumentGrant;
  revoke(grant: DocumentGrant): void;
  /** Invalidates all issued tickets. Existing snapshots/drafts stay unchanged. */
  advanceGeneration(): void;
  read(grant: DocumentGrant, signal: AbortSignal): Promise<DocumentSnapshot>;
  write(grant: DocumentGrant, expectedRevision: string, source: string, signal: AbortSignal): Promise<DocumentSnapshot>;
  dispose(): void;
}
/** In-memory serialized CAS owner. Injected authorize is trusted policy, not guest metadata.
 * afterAwait permits genuinely asynchronous storage/latency; rights/generation/cancellation
 * are rechecked after it, immediately before the synchronous CAS linearization point.
 */
export function createDocumentOwner(options: { readonly source: string; readonly authorize: (principal: string, operation: "read" | "write") => boolean; readonly beforeOperation?: (operation: "read" | "write", signal: AbortSignal) => Promise<void> }): DocumentOwner {
  checkSource(options.source);
  let source = options.source, revision = 0, generation = 0, closed = false, pendingOperations = 0;
  const live = new Set<object>();
  const snapshot = () => Object.freeze({ revision: String(revision), source });
  function check(grant: DocumentGrant, operation: "read" | "write", signal: AbortSignal) {
    const ticket = grants.get(grant);
    if (!ticket || ticket.owner !== owner) fail("denied");
    if (closed || ticket.revoked || ticket.generation !== generation) fail("revoked");
    if (signal.aborted) fail("cancelled");
    if (!(operation === "read" ? ticket.read : ticket.write) || !options.authorize(ticket.principal, operation)) fail("denied");
  }
  const owner: DocumentOwner = {
    get snapshot() { return snapshot(); },
    inspect: () => ({ closed, generation, liveGrants: live.size, pendingOperations }),
    issue(rights) {
      if (!rights || typeof rights !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(rights)) || Object.getOwnPropertySymbols(rights).length || Object.keys(rights).some(k => !["principal", "read", "write"].includes(k)) || ["principal", "read", "write"].some(k => !Object.hasOwn(rights, k)) || Object.values(Object.getOwnPropertyDescriptors(rights)).some(d => !("value" in d))) throw new TypeError("Invalid document grant fields");
      const { principal, read, write } = rights;
      if (closed || typeof principal !== "string" || !principal || principal.length > 256 || typeof read !== "boolean" || typeof write !== "boolean") throw new TypeError("Invalid document grant");
      const grant = Object.freeze(Object.create(null)) as DocumentGrant;
      grants.set(grant, { owner, principal, read, write, generation, revoked: false }); live.add(grant); return grant;
    },
    revoke(grant) { const ticket = grants.get(grant); if (!ticket || ticket.owner !== owner) fail("denied"); ticket.revoked = true; live.delete(grant); },
    advanceGeneration() { generation++; live.clear(); },
    async read(grant, signal) { pendingOperations++; try { check(grant, "read", signal); await options.beforeOperation?.("read", signal); check(grant, "read", signal); return snapshot(); } finally { pendingOperations--; } },
    async write(grant, expectedRevision, next, signal) {
      pendingOperations++;
      try {
      checkSource(next);
      checkExpectedRevision(expectedRevision);
      check(grant, "write", signal); await options.beforeOperation?.("write", signal);
      // No await in the policy + expected-revision + commit transaction.
      check(grant, "write", signal);
      if (expectedRevision !== String(revision)) throw new DocumentOperationError({ kind: "conflict", value: snapshot() });
      source = next; revision++; return snapshot();
      } finally { pendingOperations--; }
    },
    dispose() { if (closed) return; closed = true; generation++; live.clear(); },
  };
  return owner;
}
