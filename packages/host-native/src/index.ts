/** Official Rust-native kit composition and injected checked surface bridge.
 * No Bun, process, WebView or Wasmtime dependency enters ordinary TS consumers.
 */
import type { HostKit, Json } from "@loop-kit/host";
import { RecordingSurface, validateFrame, type Surface, type UiFrame, type UiEvent, type UiNode } from "@loop-kit/ui";

/** Trusted native kit options. Component selection never follows a file extension. */
export interface NativeKitOptions { readonly profile?: "ts" | "components"; readonly options?: Json }
/** Return a trusted kit use; this factory starts no process and issues no grants. */
export function native(options: NativeKitOptions = {}): HostKit<"desktop"> {
  plain(options);
  if (!options || Array.isArray(options) || typeof options !== "object" || Object.keys(options).some(key => !["profile", "options"].includes(key))) throw new TypeError("Unknown native kit options");
  if (options.profile !== undefined && options.profile !== "ts" && options.profile !== "components") throw new TypeError("Unsupported native profile");
  const profile = { id: options.profile === "components" ? "loop:profile/native-components" : "loop:profile/native-ts", version: "0.1.0" };
  return { apiVersion: 1, identity: { id: "loop:kit/native", version: "0.1.0" }, kind: "desktop", profile, options: options.options ?? {}, hosts: [{ key: "application", realm: "application", profile }], coordinator: { specifier: "@loop-kit/host-native", export: "connectNativeSurface" }, plugins: [] };
}
/** Process adapter supplied by the trusted coordinator, not a guest RPC surface.
 * subscribe supplies raw stdout chunks; send writes one ordered chunk to stdin.
 * close must await owned process termination and report forced/incomplete shutdown.
 */
export interface NativeTransport {
  send(bytes: Uint8Array): void | Promise<void>;
  subscribe(receive: (bytes: Uint8Array) => void): () => void;
  close(): void | Promise<void>;
}
export interface NativeConnection {
  readonly surface: Surface;
  readonly ready: Promise<void>;
  readonly closed: Promise<void>;
  /** Closes pending event reads immediately, then joins the owned backend. Idempotent. */
  dispose(): Promise<void>;
}
function plain(value: unknown, seen = new Set<object>(), depth = 0): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!value || typeof value !== "object" || depth > 64 || seen.has(value)) throw new TypeError("Expected bounded plain JSON");
  const proto = Object.getPrototypeOf(value);
  for (let inherited = proto; inherited !== null; inherited = Object.getPrototypeOf(inherited)) {
    if (Object.getOwnPropertyDescriptor(inherited, "toJSON")) throw new TypeError("Inherited JSON callback");
  }
  if (Array.isArray(value)) {
    if (proto !== Array.prototype || Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index))) throw new TypeError("JSON array prototype/holes/properties");
  } else if (proto !== Object.prototype && proto !== null) throw new TypeError("JSON prototype");
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") continue;
    if (typeof key !== "string") throw new TypeError("JSON symbol");
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !descriptor.enumerable) throw new TypeError("JSON accessor");
    plain(descriptor.value, seen, depth + 1);
  }
  seen.delete(value);
}
// JSON.parse alone silently accepts duplicate wire keys. Validate the grammar
// and decoded key uniqueness first; escaped aliases count as the same key.
function strictParse(text: string): unknown {
  let index = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(text[index] ?? "!") && index < text.length) index++; };
  function string(): string {
    const start = index++;
    while (index < text.length) {
      const character = text[index++];
      if (character === "\\") { index++; continue; }
      if (character === '"') return JSON.parse(text.slice(start, index)) as string;
    }
    throw new SyntaxError("Unterminated JSON string");
  }
  function value(depth: number): void {
    if (depth > 64) throw new RangeError("Native JSON depth");
    whitespace(); const character = text[index];
    if (character === '"') { string(); return; }
    if (character === "{") {
      index++; whitespace(); const keys = new Set<string>();
      if (text[index] === "}") { index++; return; }
      for (;;) {
        whitespace(); if (text[index] !== '"') throw new SyntaxError("JSON object key");
        const key = string(); if (keys.has(key)) throw new SyntaxError("Duplicate native JSON key"); keys.add(key);
        whitespace(); if (text[index++] !== ":") throw new SyntaxError("JSON colon"); value(depth + 1); whitespace();
        const separator = text[index++]; if (separator === "}") return; if (separator !== ",") throw new SyntaxError("JSON object separator");
      }
    }
    if (character === "[") {
      index++; whitespace(); if (text[index] === "]") { index++; return; }
      for (;;) { value(depth + 1); whitespace(); const separator = text[index++]; if (separator === "]") return; if (separator !== ",") throw new SyntaxError("JSON array separator"); }
    }
    const token = /^(?:null|true|false|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/.exec(text.slice(index));
    if (!token) throw new SyntaxError("JSON value"); index += token[0].length;
  }
  value(0); whitespace(); if (index !== text.length) throw new SyntaxError("Trailing native JSON");
  const parsed: unknown = JSON.parse(text); plain(parsed); return parsed;
}
const encoder = new TextEncoder();
/** Encode the frozen u32-LE JSON framing. Checks plain data before serialization. */
export function encodeNativeFrame(value: unknown): Uint8Array {
  plain(value); const payload = encoder.encode(JSON.stringify(value));
  if (!payload.length || payload.length > 1_048_576) throw new RangeError("Native frame budget");
  const bytes = new Uint8Array(payload.length + 4);
  new DataView(bytes.buffer).setUint32(0, payload.length, true); bytes.set(payload, 4); return bytes;
}
function supported(node: UiNode): void {
  if (!["column", "row", "text", "button", "input", "toggle", "select"].includes(node.type)) throw new TypeError(`Unsupported native semantic element: ${node.type}`);
  if (Object.keys(node).some(key => !["key", "type", "label", "text", "value", "disabled", "loading", "tone", "children", "options"].includes(key))) throw new TypeError("Unsupported native semantic field");
  node.children?.forEach(supported);
}
/** Attach one instance/epoch to the native process. Readiness is bounded to 5s;
 * corrupt/stale/oversized output fails closed. Abort cancels event reads before
 * any coordinator task join. Trusted TS providers are not sandboxed by this bridge.
 */
export function connectNativeSurface(options: { readonly transport: NativeTransport; readonly epoch: string; readonly signal?: AbortSignal }): NativeConnection {
  if (!options.epoch || options.epoch.length > 256) throw new TypeError("Native epoch required");
  const { transport, epoch, signal } = options;
  const recording = new RecordingSurface();
  let resolveReady!: () => void, rejectReady!: (error: Error) => void;
  let resolveClosed!: () => void, rejectClosed!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const closed = new Promise<void>((resolve, reject) => { resolveClosed = resolve; rejectClosed = reject; });
  void ready.catch(() => {}); void closed.catch(() => {});
  let admitted = true, receivedReady = false, terminal = false, stopping = false;
  let pending = new Uint8Array(0), queued = 0, count = 0, sending = Promise.resolve();
  let disposal: Promise<void> | undefined;
  let transportClosing: Promise<void> | undefined;
  const closeTransport = () => transportClosing ??= Promise.resolve().then(() => transport.close());
  let unsubscribe = () => {};
  const handshake = setTimeout(() => fail(new Error("Native handshake deadline")), 5000);
  function fail(error: Error) {
    if (terminal) return;
    terminal = true; admitted = false; recording.dispose(); clearTimeout(handshake);
    rejectReady(error); rejectClosed(error); unsubscribe(); signal?.removeEventListener("abort", abort);
    void closeTransport().catch(() => {});
  }
  function send(value: unknown) {
    const bytes = encodeNativeFrame(value);
    if (count >= 16 || queued + bytes.length > 8_388_608) throw new RangeError("Native queue budget");
    queued += bytes.length; count++;
    const isClose = (value as { type?: string }).type === "close";
    sending = sending.then(() => { if (!terminal && (isClose || !stopping)) return transport.send(bytes); }).then(() => { queued -= bytes.length; count--; }).catch(error => { fail(error instanceof Error ? error : new Error(String(error))); });
  }
  function receive(bytes: Uint8Array) {
    if (terminal) return;
    try {
      if (bytes.length + pending.length > 8_388_608) throw new RangeError("Native receive queue budget");
      const next = new Uint8Array(pending.length + bytes.length); next.set(pending); next.set(bytes, pending.length); pending = next;
      while (pending.length >= 4) {
        const length = new DataView(pending.buffer, pending.byteOffset, 4).getUint32(0, true);
        if (!length || length > 1_048_576) throw new RangeError("Native frame length");
        if (pending.length < length + 4) break;
        const value = strictParse(new TextDecoder("utf-8", { fatal: true }).decode(pending.subarray(4, length + 4))) as Record<string, unknown>;
        pending = pending.slice(length + 4);
        if (!value || Array.isArray(value) || typeof value !== "object" || value.epoch !== epoch) throw new Error("Stale/invalid native envelope");
        if (value.type === "ready") {
          if (receivedReady || stopping || Object.keys(value).some(k => !["type", "epoch", "instanceId"].includes(k)) || typeof value.instanceId !== "string") throw new Error("Invalid native ready");
          receivedReady = true; clearTimeout(handshake); resolveReady();
        } else if (value.type === "event") {
          if (!receivedReady || Object.keys(value).some(k => !["type", "epoch", "event"].includes(k))) throw new Error("Invalid native event");
          if (admitted) recording.event(value.event as UiEvent);
        } else if (value.type === "closed") {
          if (Object.keys(value).some(k => !["type", "epoch", "pendingEventReads"].includes(k)) || value.pendingEventReads !== 0) throw new Error("Incomplete native cleanup");
          terminal = true; admitted = false; recording.dispose(); clearTimeout(handshake); unsubscribe(); signal?.removeEventListener("abort", abort);
          if (!receivedReady) rejectReady(new Error("Native closed before ready"));
          resolveClosed();
        } else throw new Error("Unknown native operation");
      }
    } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  }
  const surface: Surface = {
    render(frame: UiFrame) {
      if (!admitted || !receivedReady) throw new Error("Native surface not ready or stopped");
      plain(frame); validateFrame(frame); supported(frame.root);
      if (encoder.encode(JSON.stringify(frame)).length > 65536) throw new RangeError("Native UI frame byte budget");
      recording.render(frame);
      try { send({ type: "render", epoch, frame }); }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))); throw error; }
    },
    nextEvent: () => recording.nextEvent(),
    dispose: () => { void dispose().catch(() => {}); },
  };
  function dispose(): Promise<void> {
    if (disposal) return disposal;
    admitted = false; stopping = true; recording.dispose(); clearTimeout(handshake);
    if (!receivedReady) rejectReady(Object.assign(new Error("Native cancelled before ready"), { code: "E_CANCELLED" }));
    disposal = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const failures: unknown[] = [];
      try {
        if (!terminal) {
          await Promise.race([(async () => { send({ type: "close", epoch }); await sending; await closed; })(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Native shutdown deadline")), 5000); })]);
        } else await closed;
      } catch (error) { failures.push(error); fail(error instanceof Error ? error : new Error(String(error))); }
      finally { if (timer) clearTimeout(timer); unsubscribe(); signal?.removeEventListener("abort", abort); }
      try { await closeTransport(); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, "Native shutdown failed");
    })();
    return disposal;
  }
  function abort() { void dispose().catch(() => {}); }
  try { unsubscribe = transport.subscribe(receive); if (terminal) unsubscribe(); }
  catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  return { surface, ready, closed, dispose };
}
