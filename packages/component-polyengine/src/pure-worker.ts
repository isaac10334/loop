/** Dedicated worker installer for import-free PURE Component calls. */
import { instantiate, requiredImports } from "@polyengine/runtime/embedder";
import { translationSha256 } from "./translation.js";
import type { PreparedTranslation } from "./translation.js";
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, "0")).join("");
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const encoder = new TextEncoder();

/** Installs the message protocol once in a dedicated worker. No host callbacks are exposed. */
export function installPureComponentWorker(): void {
  if (typeof document !== "undefined" || typeof globalThis.postMessage !== "function") throw new Error("PURE Component requires a dedicated worker realm");
  const channel = globalThis as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(message: unknown): void };
  if (channel.onmessage) throw new Error("Worker bootstrap already installed");
  let failed=false;
  let initialized = false, entering = false, exports: Record<string, (...args: (string | number | boolean)[]) => unknown> = Object.create(null), allowed = new Set<string>(), maxPayload = 2 * 1048576;
  const send = (message: unknown) => channel.postMessage(message);
  const fatal = (error: unknown) => {if(failed)return;failed=true;send({ type: "fatal", message: String(error).slice(0, 1024) });};
  channel.onmessage = event => { void (async () => {
    if(failed)return;
    const m = event.data;
    if (!m || typeof m !== "object" || Array.isArray(m)) throw new Error("Malformed supervisor message");
    if (m.type === "init") {
      if (initialized) throw new Error("Duplicate initialization"); initialized = true;
      const component = m.component as Uint8Array, translation = m.translation as PreparedTranslation, artifact = m.artifact;
      if (!Number.isSafeInteger(m.maxPayloadBytes) || m.maxPayloadBytes < 1 || m.maxPayloadBytes > 4 * 1048576) throw new Error("Invalid PURE payload budget");
      maxPayload = m.maxPayloadBytes;
      if (!(component instanceof Uint8Array) || !component.byteLength || component.byteLength > 32 * 1048576) throw new Error("Component byte budget exceeded");
      const digest = hex(await crypto.subtle.digest("SHA-256", new Uint8Array(component).buffer));
      if (digest !== artifact.sha256 || await translationSha256(translation) !== artifact.translationSha256 || translation.plan.component.sha256 !== digest || translation.plan.worldDigest !== artifact.worldDigest) throw new Error("PURE artifact identity mismatch");
      if (!Array.isArray(m.exports) || !m.exports.length || m.exports.length > 32 || new Set(m.exports).size !== m.exports.length || m.exports.some((n: unknown) => typeof n !== "string" || !NAME.test(n))) throw new Error("Invalid PURE export allowlist");
      // Check before instantiate: this runtime never supplies WASI, host providers, or shims.
      if (requiredImports(translation.plan).length !== 0) throw new Error("PURE Components must not import host functions");
      const instance = await instantiate({ plan: translation.plan, adapters: translation.adapters, componentBytes: component }, {});
      const actual = instance.exports as Record<string, unknown>;
      for (const name of m.exports as string[]) if (!Object.hasOwn(actual,name) || typeof actual[name] !== "function") throw new Error(`Missing or non-function guest export: ${name}`);
      allowed = new Set(m.exports); exports = actual as typeof exports; send({ type: "ready", ok: true }); return;
    }
    if (!initialized || m.type !== "call" || entering || !Number.isSafeInteger(m.id) || !allowed.has(m.name) || !Array.isArray(m.args) || m.args.length > 16) throw new Error("Invalid or concurrent PURE call");
    let total = 0;
    for (const arg of m.args) { if (typeof arg === "string") total += encoder.encode(arg).byteLength; else if (typeof arg === "number" && Number.isFinite(arg)) total += 8; else if (typeof arg === "boolean") total += 1; else throw new Error("Invalid PURE argument"); }
    if (total > maxPayload) throw new Error("PURE argument payload budget exceeded");
    entering = true;
    try {
      const value = await exports[m.name](...m.args);
      if (typeof value !== "string") throw new Error("PURE export must return a string");
      if (encoder.encode(value).byteLength > maxPayload) throw new Error("PURE result payload budget exceeded");
      send({ type: "result", id: m.id, value });
    } finally { entering = false; }
  })().catch(fatal); };
}
