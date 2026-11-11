/** Polyengine 0.6.7 nominal facade, installed only in a dedicated module worker. */
import { Translator } from "@polyengine/runtime/shim";
import { instantiate, requiredImports } from "@polyengine/runtime/embedder";
import { ComponentException } from "@polyengine/protocol";
import { validateFrame } from "@loop-kit/ui";
import { checkSource, checkExpectedRevision, checkDocumentFailure, checkDocumentResult, DocumentOperationError } from "./documents.js";
import { translationSha256 } from "./translation.js";
const DOC = "loop:document-tool/documents@0.1.0", UI = "loopkit:ui/surfaces@0.1.0";
const wasi: Record<string, readonly string[]> = {
  "wasi:io/poll@0.2.9": ["pollable", "[method]pollable.block", "poll"],
  "wasi:io/error@0.2.9": ["error"],
  "wasi:io/streams@0.2.9": ["input-stream", "output-stream", "[method]output-stream.subscribe", "[method]output-stream.check-write", "[method]output-stream.write", "[method]output-stream.blocking-flush"],
  "wasi:clocks/monotonic-clock@0.2.9": ["subscribe-duration"],
  "wasi:cli/exit@0.2.9": ["exit"], "wasi:cli/environment@0.2.9": ["get-environment"],
  "wasi:cli/stdin@0.2.9": ["get-stdin"], "wasi:cli/stdout@0.2.9": ["get-stdout"], "wasi:cli/stderr@0.2.9": ["get-stderr"],
  "wasi:cli/terminal-input@0.2.9": ["terminal-input"], "wasi:cli/terminal-output@0.2.9": ["terminal-output"],
  "wasi:cli/terminal-stdin@0.2.9": ["get-terminal-stdin"], "wasi:cli/terminal-stdout@0.2.9": ["get-terminal-stdout"], "wasi:cli/terminal-stderr@0.2.9": ["get-terminal-stderr"],
};
/** The worker bootstrap must call this once. No function source, grants or owners cross its channel. */
export function installPolyengineWorker(): void {
  if (typeof document !== "undefined" || typeof globalThis.postMessage !== "function") throw new Error("Polyengine requires a dedicated worker realm");
  const channel = globalThis as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(message: unknown): void };
  if (channel.onmessage) throw new Error("Worker bootstrap already installed");
  let initialized = false, entering = false, activeBorrow = false, next = 0;
  const requests = new Map<number, { resolve: (value: unknown) => void; reject: (e: unknown) => void }>();
  let exports: Record<string, (...args: unknown[]) => Promise<unknown>>;
  const send = (message: unknown) => channel.postMessage(message);
  function request(operation: string, extra: object = {}): Promise<unknown> {
    if (!activeBorrow) return Promise.reject(new ComponentException({ kind: "revoked" }));
    if (requests.size >= 16) return Promise.reject(new ComponentException({ kind: "unavailable" }));
    const id = ++next;
    return new Promise((resolve, reject) => { requests.set(id, { resolve, reject }); send({ type: "host", id, operation, ...extra }); });
  }
  const nominal = new WeakSet<object>();
  class Document {
    constructor() { nominal.add(this); }
    check() { if (!nominal.has(this) || !activeBorrow) throw new ComponentException({ kind: "revoked" }); }
    async read() { this.check(); return request("read"); }
    async write(expectedRevision: string, source: string) { this.check(); try { checkSource(source); checkExpectedRevision(expectedRevision); } catch (e) { if (e instanceof DocumentOperationError) throw new ComponentException(e.failure); throw e; } return request("write", { expectedRevision, source }); }
    [Symbol.dispose]() { nominal.delete(this); }
  }
  class Surface {
    constructor() { nominal.add(this); }
    render(text: string) {
      if (!nominal.has(this) || !activeBorrow) throw new Error("Surface borrow expired");
      if (typeof text !== "string" || text.length > 65536 || new TextEncoder().encode(text).byteLength > 65536) throw new Error("Frame budget exceeded");
      send({ type: "render", frame: validateFrame(JSON.parse(text)) });
    }
    async nextEvent() { if (!nominal.has(this)) throw new Error("Invalid surface"); const event = await request("nextEvent"); return event === undefined ? undefined : JSON.stringify(event); }
    [Symbol.dispose]() { nominal.delete(this); }
  }
  const doc = new Document(), surface = new Surface();
  channel.onmessage = event => {
    const message = event.data;
    void (async () => {
      if (!message || typeof message !== "object") throw new Error("Invalid supervisor message");
      if (message.type === "init") {
        if (initialized) throw new Error("Duplicate initialization"); initialized = true;
        const { artifact } = message;
        const bytes = message.component as Uint8Array;
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer)), n => n.toString(16).padStart(2, "0")).join("");
        if (digest !== artifact.sha256) throw new Error("Component artifact hash mismatch");
        if (message.translation && await translationSha256(message.translation) !== artifact.translationSha256) throw new Error("Prepared translation/adapters content mismatch");
        const translated = message.translation ?? (await Translator.create(message.translator)).translate(bytes);
        if (translated.plan.component.sha256 !== digest || translated.plan.worldDigest !== artifact.worldDigest) throw new Error("Component world/artifact profile mismatch");
        const imports: Record<string, Record<string, unknown>> = { [DOC]: { Document } };
        if (artifact.profile === "semantic") imports[UI] = { Surface };
        let hasDocument = false, hasSurface = false;
        for (const leaf of requiredImports(translated.plan)) {
          if (leaf.interfaceId === DOC) { if (leaf.leaf !== "document" && !["[method]document.read", "[method]document.write"].includes(leaf.leaf)) throw new Error("Unexpected document import"); hasDocument = true; continue; }
          if (leaf.interfaceId === UI && artifact.profile === "semantic") { if (!["surface", "[method]surface.render", "[method]surface.next-event"].includes(leaf.leaf)) throw new Error("Unexpected surface import"); hasSurface = true; continue; }
          if (!wasi[leaf.interfaceId]?.includes(leaf.leaf)) throw new Error(`Import profile denied: ${leaf.interfaceId}/${leaf.leaf}`);
          const iface = imports[leaf.interfaceId] ??= {};
          const deny = () => { throw new Error(`Runtime import denied: ${leaf.interfaceId}/${leaf.leaf}`); };
          if (leaf.kind === "resource") iface[leaf.jsName] = class {};
          else if (leaf.jsClass) { const cls = (iface[leaf.jsClass] ??= class {}) as { prototype: Record<string, unknown> }; cls.prototype[leaf.jsName] = deny; }
          else iface[leaf.jsName] = deny;
        }
        if (!hasDocument || artifact.profile === "semantic" && !hasSurface) throw new Error("Missing nominal profile imports");
        const instance = await instantiate({ plan: translated.plan, adapters: translated.adapters, componentBytes: bytes }, imports);
        exports = instance.exports as typeof exports;
        const operation = artifact.profile === "semantic" ? "run" : "replaceText";
        if (typeof exports[operation] !== "function") throw new Error("Missing profile export");
        send({ type: "ready" }); return;
      }
      if (message.type === "hostResult") {
        const pending = requests.get(message.id); if (!pending) throw new Error("Late or forged host reply"); requests.delete(message.id);
        if (message.error) pending.reject(new ComponentException(message.error)); else pending.resolve(message.value); return;
      }
      if (message.type !== "call" || !exports || entering) throw new Error("Component entry is serialized");
      entering = true; activeBorrow = true;
      try {
        let value: unknown;
        if (message.operation === "replaceText") { checkSource(message.from); checkSource(message.to); value = await exports.replaceText!(doc, message.from, message.to); }
        else if (message.operation === "run") value = await exports.run!(doc, surface);
        else throw new Error("Unknown Component export");
        // Canonical lift already occurred inside the engine. Bound decoded output
        // here before cloning it into the application realm (not a pre-lift claim).
        checkDocumentResult(value);
        send({ type: "result", id: message.id, value });
      } catch (e) {
        if (e instanceof ComponentException) {
          // Exact data-only variants and field budgets bound the structured clone;
          // JSON escaping is not part of this transport and rejects valid snapshots.
          const payload: unknown = e.payload; checkDocumentFailure(payload);
          send({ type: "result", id: message.id, error: payload });
        }
        else throw e; // Trap fails this isolated instance, never silently reuse poisoned state.
      } finally { activeBorrow = false; entering = false; }
    })().catch(error => send({ type: "fatal", message: String(error).slice(0, 4096) }));
  };
}
