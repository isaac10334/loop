/** Dedicated worker supervisor. One authority/failure lifetime per worker, one serialized guest entry. */
import type { Surface } from "@loop-kit/ui";
import type { TranslationResult } from "@polyengine/runtime/shim";
import { DocumentOperationError, checkSource, checkExpectedRevision, checkDocumentFailure, checkDocumentResult, type DocumentOwner, type DocumentGrant } from "./documents.js";
/** Host mutation committed, but cancellation/transport failure prevented a guest result.
 * Reconcile with the document owner; never automatically retry the entry.
 */
export class ComponentOutcomeUncertainError extends Error {
  readonly outcome = "committed-host-write" as const;
  constructor(readonly revision: string, options?: ErrorOptions) { super("Host write committed; guest result unavailable, reconciliation required", options); }
}
export interface ComponentArtifact { readonly sha256: string; readonly worldDigest: string; readonly profile: "document" | "semantic"; /** Required for prepared translations; binds plan and every adapter's bytes to the reviewed build receipt. */ readonly translationSha256?: string }
export interface PolyengineSession {
  /** Diagnostic counts only, never grants, document identities or callable resources. */
  inspect(): { readonly closed: boolean; readonly workers: number; readonly pendingGuestCalls: number; readonly pendingHostCalls: number };
  replaceText(from: string, to: string): Promise<string>;
  run(): Promise<string>;
  /** Synchronously cancels host work, closes transferred surface reads and terminates non-yielding Wasm. */
  dispose(reason?: unknown): Promise<void>;
}
export interface PolyengineSessionOptions {
  /** Bundled worker entry calls installPolyengineWorker through this package's public root. */
  readonly workerUrl: string | URL;
  readonly componentBytes: Uint8Array;
  /** Use reviewed build-time public Translator output to avoid shipping the translator in static output. */
  readonly translation?: Pick<TranslationResult, "plan" | "adapters">;
  /** Alternatively supply an explicitly prepared translator asset (no implicit private package reads). */
  readonly translatorBytes?: Uint8Array;
  readonly artifact: ComponentArtifact;
  readonly document: { readonly owner: DocumentOwner; readonly grant: DocumentGrant };
  /** Transfers the dedicated surface's lifetime to this session. Never pass a shared surface. */
  readonly surface?: Surface;
  readonly signal?: AbortSignal;
  /** Hard entry bound, including event waits. Default 5 seconds; max 30 seconds. */
  readonly callTimeoutMs?: number;
}
/** Validates bytes/profile in the worker before exposing callable nominal resources.
 * No host lookup, paths, ambient WASI or arbitrary function dispatch is offered.
 */
export async function createPolyengineSession(options: PolyengineSessionOptions): Promise<PolyengineSession> {
  const timeout = options.callTimeoutMs ?? 5000;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30000) throw new TypeError("Invalid worker call budget");
  if (!/^[a-f0-9]{64}$/.test(options.artifact.sha256) || !/^sha256:[a-f0-9]{64}$/.test(options.artifact.worldDigest) || !["document", "semantic"].includes(options.artifact.profile)) throw new TypeError("Invalid verified artifact identity");
  if (!options.componentBytes.byteLength || options.componentBytes.byteLength > 16 * 1048576 || options.translatorBytes && options.translatorBytes.byteLength > 32 * 1048576) throw new TypeError("Artifact byte budget exceeded");
  if (!!options.translation === !!options.translatorBytes) throw new TypeError("Supply exactly one reviewed translation or translator asset");
  if (options.translation && !/^[a-f0-9]{64}$/.test(options.artifact.translationSha256 ?? "")) throw new TypeError("Prepared translation requires reviewed translationSha256");
  if (options.artifact.profile === "semantic" && !options.surface) throw new TypeError("Semantic profile requires a dedicated surface");
  const worker = new Worker(options.workerUrl, { type: "module", name: "loop-component" });
  const controller = new AbortController();
  let closed = false, active = false, id = 0, hostCalls = 0;
  let committedRevision: string | undefined;
  let disposal: Promise<void> | undefined;
  let pending: { id: number; resolve: (value: string) => void; reject: (error: unknown) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  let readyResolve!: () => void, readyReject!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  // A structured-clone failure can occur before initialization reaches await ready.
  void ready.catch(() => {});
  const bootTimer = setTimeout(() => { void dispose(new Error("Component initialization timed out")); }, timeout);
  let renderCompletion = Promise.resolve();
  const hostWork = new Set<Promise<void>>();
  function dispose(reason: unknown = new Error("Component session disposed")): Promise<void> {
    if (disposal) return disposal;
    let resolve!: () => void, reject!: (error: unknown) => void;
    disposal = new Promise<void>((a, b) => { resolve = a; reject = b; });
    // Fatal/timeout paths initiate disposal without an external await; callers still
    // receive this same rejected completion on dispose rather than an unhandled event.
    void disposal.catch(() => {});
    closed = true;
    controller.abort(reason); clearTimeout(bootTimer); options.signal?.removeEventListener("abort", abort);
    // Close reads before any task joins. Termination is the isolation boundary, not guest cooperation.
    let cleanup: unknown;
    try { options.surface?.dispose(); } catch (e) { cleanup = e; }
    worker.terminate();
    if (pending) { clearTimeout(pending.timer); pending.reject(committedRevision === undefined ? reason : new ComponentOutcomeUncertainError(committedRevision, { cause: reason })); pending = undefined; }
    readyReject(reason);
    // Worker termination cannot cancel trusted storage callbacks. Join actual host work;
    // noncooperative trusted ports can delay this completion and must not be reported cleaned.
    void Promise.allSettled([...hostWork, renderCompletion]).then(results => {
      const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map(r => r.reason);
      if (cleanup) errors.unshift(cleanup);
      if (errors.length) reject(new AggregateError(errors, "Component cleanup failed")); else resolve();
    });
    return disposal;
  }
  const abort = () => { void dispose(options.signal?.reason ?? new Error("Component cancelled")).catch(() => {}); };
  options.signal?.addEventListener("abort", abort, { once: true });
  const send = (message: unknown) => { if (!closed) worker.postMessage(message); };
  worker.onerror = event => { event.preventDefault(); void dispose(new Error(event.message)).catch(() => {}); };
  worker.onmessage = event => {
    const message = event.data;
    if (closed) return;
    if (!message || typeof message !== "object") { void dispose(new Error("Invalid worker frame")); return; }
    if (message.type === "ready") { clearTimeout(bootTimer); readyResolve(); return; }
    if (message.type === "fatal") { void dispose(new Error(String(message.message).slice(0, 4096))); return; }
    if (message.type === "result") {
      if (!pending || pending.id !== message.id) { void dispose(new Error("Unsolicited or stale Component result")); return; }
      const p = pending; pending = undefined; active = false; clearTimeout(p.timer);
      if (Object.hasOwn(message, "error")) {
        try { if (Object.hasOwn(message, "value")) throw new Error("Invalid Component failure payload"); checkDocumentFailure(message.error); p.reject(new DocumentOperationError(message.error)); }
        catch { const failure = new Error("Invalid Component failure payload"); p.reject(committedRevision === undefined ? failure : new ComponentOutcomeUncertainError(committedRevision, { cause: failure })); void dispose(failure); }
      } else {
        try { checkDocumentResult(message.value); p.resolve(message.value); }
        catch { const failure = new Error("Component result budget/type violation"); p.reject(committedRevision === undefined ? failure : new ComponentOutcomeUncertainError(committedRevision, { cause: failure })); void dispose(failure); }
      }
      return;
    }
    if (message.type === "render") {
      if (!active || !options.surface || options.artifact.profile !== "semantic") { void dispose(new Error("Unbound surface render")); return; }
      // Message order + serialized promise makes nextEvent wait until frame presentation.
      renderCompletion = renderCompletion.then(() => options.surface!.render(message.frame));
      void renderCompletion.catch(error => { void dispose(error).catch(() => {}); }); return;
    }
    if (message.type !== "host" || !active || !Number.isSafeInteger(message.id) || ++hostCalls > 16) { void dispose(new Error("Invalid or excessive host request")); return; }
    const request = message;
    const work = (async () => {
      try {
        let value: unknown;
        if (request.operation === "read") value = await options.document.owner.read(options.document.grant, controller.signal);
        else if (request.operation === "write") { checkSource(request.source); checkExpectedRevision(request.expectedRevision); const committed = await options.document.owner.write(options.document.grant, request.expectedRevision, request.source, controller.signal); committedRevision = committed.revision; value = committed; }
        else if (request.operation === "nextEvent" && options.surface && options.artifact.profile === "semantic") { await renderCompletion; value = await options.surface.nextEvent(); }
        else throw new DocumentOperationError({ kind: "denied" });
        send({ type: "hostResult", id: request.id, value });
      } catch (e) { send({ type: "hostResult", id: request.id, error: e instanceof DocumentOperationError ? e.failure : { kind: controller.signal.aborted ? "cancelled" : "unavailable" } }); }
      finally { hostCalls--; }
    })();
    hostWork.add(work); void work.finally(() => { hostWork.delete(work); });
  };
  function call(operation: "replaceText" | "run", from?: string, to?: string): Promise<string> {
    if (closed) return Promise.reject(new Error("Component session disposed"));
    if (active) return Promise.reject(new Error("Component entry is serialized; an entry is already active"));
    if (operation === "run" && options.artifact.profile !== "semantic" || operation === "replaceText" && options.artifact.profile !== "document") return Promise.reject(new Error("Entry incompatible with artifact profile"));
    if (operation === "replaceText") { checkSource(from); checkSource(to); }
    active = true; committedRevision = undefined;
    return new Promise((resolve, reject) => {
      const current = ++id;
      pending = { id: current, resolve, reject, timer: setTimeout(() => { void dispose(new Error("Component hard call deadline exceeded")); }, timeout) };
      send({ type: "call", id: current, operation, from, to });
    });
  }
  try {
    if (options.signal?.aborted) abort();
    else send({ type: "init", component: new Uint8Array(options.componentBytes), translator: options.translatorBytes && new Uint8Array(options.translatorBytes), translation: options.translation && { plan: options.translation.plan, adapters: new Map([...options.translation.adapters].map(([path, bytes]) => [path, new Uint8Array(bytes)])) }, artifact: { ...options.artifact } });
    await ready;
  } catch (e) { await dispose(e); throw e; }
  return { inspect: () => ({ closed, workers: closed ? 0 : 1, pendingGuestCalls: pending ? 1 : 0, pendingHostCalls: hostCalls }), replaceText: (from, to) => call("replaceText", from, to), run: () => call("run"), dispose };
}
