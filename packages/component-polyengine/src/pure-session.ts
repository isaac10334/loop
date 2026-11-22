/** Bounded, import-free PURE Component execution in a dedicated worker. */
import type { PreparedTranslation } from "./translation.js";

export interface PureComponentArtifact { readonly sha256: string; readonly translationSha256: string; readonly worldDigest: string }
export interface PureComponentSession {
  /** Diagnostic counts only. */
  inspect(): { readonly closed: boolean; readonly workers: number; readonly pendingGuestCalls: number };
  /** Invokes one explicitly allowed async guest export. Calls never queue or retry. */
  call(name: string, args: readonly (string | number | boolean)[]): Promise<string>;
  /** Synchronously aborts pending work and terminates this session's worker. */
  dispose(reason?: unknown): Promise<void>;
}
export interface PureComponentSessionOptions {
  readonly workerUrl: string | URL;
  readonly componentBytes: Uint8Array;
  readonly translation: PreparedTranslation;
  readonly artifact: PureComponentArtifact;
  readonly exports: readonly string[];
  readonly signal?: AbortSignal;
  readonly callTimeoutMs?: number;
  readonly maxPayloadBytes?: number;
}
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const utf8 = new TextEncoder();

/** Creates a single-use worker session; guest imports are required to be empty before instantiate. */
export async function createPureComponentSession(options: PureComponentSessionOptions): Promise<PureComponentSession> {
  const timeout = options.callTimeoutMs ?? 15000, maxPayload = options.maxPayloadBytes ?? 2 * 1048576;
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 30000) throw new TypeError("Invalid call timeout");
  if (!Number.isSafeInteger(maxPayload) || maxPayload < 1 || maxPayload > 4 * 1048576) throw new TypeError("Invalid payload budget");
  if (!(options.componentBytes instanceof Uint8Array) || !options.componentBytes.byteLength || options.componentBytes.byteLength > 32 * 1048576) throw new TypeError("Component byte budget exceeded");
  if (!/^[a-f0-9]{64}$/.test(options.artifact.sha256) || !/^[a-f0-9]{64}$/.test(options.artifact.translationSha256) || !/^sha256:[a-f0-9]{64}$/.test(options.artifact.worldDigest)) throw new TypeError("Invalid artifact identity");
  if (!Array.isArray(options.exports) || !options.exports.length || options.exports.length > 32 || new Set(options.exports).size !== options.exports.length || options.exports.some(name => !NAME.test(name))) throw new TypeError("Invalid guest export allowlist");
  const allowedExports=Object.freeze([...options.exports]);
  const worker = new Worker(options.workerUrl, { type: "module", name: "loop-pure-component" });
  let initialized=false;
  let closed = false, pending: { id: number; resolve(value: string): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> } | undefined;
  let id = 0, disposal: Promise<void> | undefined;
  let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  void ready.catch(() => {});
  const terminate = (reason: unknown = new Error("PURE Component session disposed")) => {
    if (disposal) return disposal;
    closed = true; clearTimeout(bootTimer); options.signal?.removeEventListener("abort", abort);
    worker.terminate(); rejectReady(reason);
    if (pending) { clearTimeout(pending.timer); pending.reject(reason); pending = undefined; }
    return disposal = Promise.resolve();
  };
  const abort = () => { void terminate(options.signal?.reason ?? new Error("PURE Component session aborted")); };
  const bootTimer = setTimeout(() => { void terminate(new Error("PURE initialization timed out")); }, timeout);
  worker.onerror = event => { event.preventDefault(); void terminate(new Error(event.message || "PURE worker failed")); };
  worker.onmessage = event => {
    const m = event.data;
    if (closed) return;
    if (!m || typeof m !== "object" || Array.isArray(m)) { void terminate(new Error("Malformed PURE worker message")); return; }
    if (m.type === "ready") { if (initialized || m.ok !== true || Object.keys(m).some(k=>!['type','ok'].includes(k))) { void terminate(new Error("Invalid PURE ready message")); return; } initialized=true; clearTimeout(bootTimer); resolveReady(); return; }
    if (m.type === "fatal") { void terminate(new Error(typeof m.message === "string" ? m.message.slice(0, 1024) : "PURE worker fatal error")); return; }
    if (!initialized || m.type !== "result" || !pending || m.id !== pending.id || !Object.hasOwn(m, "value") || typeof m.value !== "string" || Object.keys(m).some(k=>!['type','id','value'].includes(k))) { void terminate(new Error("Unsolicited or malformed PURE result")); return; }
    const current = pending; pending = undefined; clearTimeout(current.timer);
    try { const size = utf8.encode(m.value).byteLength; if (size > maxPayload) throw new Error("PURE result payload budget exceeded"); current.resolve(m.value); }
    catch (error) { current.reject(error); void terminate(error); }
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  else {
    try { worker.postMessage({ type: "init", component: new Uint8Array(options.componentBytes), translation: options.translation, artifact: options.artifact, exports: allowedExports, maxPayloadBytes: maxPayload }); }
    catch (error) { void terminate(error); }
  }
  try { await ready; }
  catch (error) { await terminate(error); throw error; }
  return {
    inspect: () => ({ closed, workers: closed ? 0 : 1, pendingGuestCalls: pending ? 1 : 0 }),
    call(name, args) {
      if (closed) return Promise.reject(new Error("PURE Component session is closed"));
      if (!allowedExports.includes(name)) return Promise.reject(new Error("Guest export is not allowed"));
      if (pending) return Promise.reject(new Error("PURE Component entry is serialized"));
      if (!Array.isArray(args) || args.length > 16) return Promise.reject(new TypeError("Invalid guest arguments"));
      let total = 0;
      try { for (const arg of args) { if (typeof arg === "string") total += utf8.encode(arg).byteLength; else if (typeof arg === "number" && Number.isFinite(arg)) total += 8; else if (typeof arg === "boolean") total += 1; else throw new TypeError("Invalid guest argument"); } if (total > maxPayload) throw new TypeError("Guest argument payload budget exceeded"); }
      catch (error) { return Promise.reject(error); }
      return new Promise<string>((resolve, reject) => {
        const current = ++id;
        pending = { id: current, resolve, reject, timer: setTimeout(() => { void terminate(new Error("PURE call deadline exceeded")); }, timeout) };
        try { worker.postMessage({ type: "call", id: current, name, args: [...args] }); } catch (error) { void terminate(error); }
      });
    },
    dispose: terminate,
  };
}
