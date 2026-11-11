/** Test-only actual-engine worlds. Never imported by a production worker/profile. */
import { instantiate, requiredImports } from "@polyengine/runtime/embedder";
import { ComponentException } from "@polyengine/protocol";
import { createDocumentOwner, DocumentOperationError } from "@loop-kit/component-polyengine";
const DOC = "loop:document-tool/documents@0.1.0";
const wasi = new Set(["wasi:io/poll@0.2.9", "wasi:io/error@0.2.9", "wasi:io/streams@0.2.9", "wasi:clocks/monotonic-clock@0.2.9", ...["exit", "environment", "stdin", "stdout", "stderr", "terminal-input", "terminal-output", "terminal-stdin", "terminal-stdout", "terminal-stderr"].map(x => `wasi:cli/${x}@0.2.9`)]);
const channel = globalThis as unknown as { onmessage: (e: MessageEvent) => void; postMessage(value: unknown): void };
const outcome = async (f: () => unknown) => { try { return { value: await f() }; } catch (e) { return { error: String(e), payload: (e as { payload?: unknown }).payload }; } };
channel.onmessage = event => { void (async () => {
  const inputs = event.data;
  const decodes: number[] = [];
  const originalDecode = TextDecoder.prototype.decode;
  TextDecoder.prototype.decode = function(input, options) { const count = input && "byteLength" in input ? input.byteLength : 0; if (count > 1048576) decodes.push(count); return originalDecode.call(this, input, options); };
  const owner = createDocumentOwner({ source: "lifecycle source", authorize: p => p === "host" });
  let reads = 0, writes = 0, drops = 0, live = 0;
  class Document {
    #grant = owner.issue({ principal: "host", read: true, write: true });
    #closed = false;
    constructor() { live++; }
    async read() { reads++; try { return await owner.read(this.#grant, new AbortController().signal); } catch (e) { if (e instanceof DocumentOperationError) throw new ComponentException(e.failure); throw e; } }
    async write(revision: string, source: string) { writes++; try { return await owner.write(this.#grant, revision, source, new AbortController().signal); } catch (e) { if (e instanceof DocumentOperationError) throw new ComponentException(e.failure); throw e; } }
    get closed() { return this.#closed; }
    [Symbol.dispose]() { if (this.#closed) return; this.#closed = true; owner.revoke(this.#grant); drops++; live--; }
  }
  async function make(name: string) {
    const input = inputs[name], bytes = Uint8Array.from(atob(input.bytes), c => c.charCodeAt(0));
    const imports: Record<string, Record<string, any>> = { [DOC]: { Document } };
    const leaves = requiredImports(input.translation.plan);
    for (const leaf of leaves) {
      if (leaf.interfaceId === DOC) continue;
      if (!wasi.has(leaf.interfaceId)) throw new Error(`Unexpected test-only import ${leaf.interfaceId}`);
      const iface = imports[leaf.interfaceId] ??= {};
      if (leaf.kind === "resource") iface[leaf.jsName] = class {};
    }
    for (const leaf of leaves) {
      if (leaf.interfaceId === DOC || leaf.kind === "resource") continue;
      const iface = imports[leaf.interfaceId]!;
      const deny = () => { throw new Error(`Unused runtime import denied ${leaf.interfaceId}/${leaf.leaf}`); };
      if (leaf.jsClass) { const cls = iface[leaf.jsClass] ??= class {}; cls.prototype[leaf.jsName] = deny; } else iface[leaf.jsName] = deny;
    }
    return instantiate({ plan: input.translation.plan, adapters: new Map(input.translation.adapters.map(([k,v]: [string, number[]]) => [k, new Uint8Array(v)])), componentBytes: bytes }, imports);
  }
  const results: Record<string, unknown> = {};
  try {
    const borrowed = await make("lifecycle"), d = new Document();
    await borrowed.exports.saveBorrow(d); const before = reads;
    const retained = await outcome(() => borrowed.exports.readSaved());
    results.retainedBorrow = { ...retained, hostReadCalls: reads - before, rejectedBeforeHostRead: "error" in retained && reads === before };
    d[Symbol.dispose]();
    const owned = await make("lifecycle"), a = new Document(), sibling = new Document(), beforeDrop = drops;
    await owned.exports.acceptOwn(a); const read = await owned.exports.readOwned(); await owned.exports.dropOwned();
    const siblingRead = await sibling.read(); const afterDrop = drops;
    results.ownedDrop = { read, guestDropInvocations: afterDrop - beforeDrop, ownedClosed: a.closed, siblingClosed: sibling.closed, siblingRead, passed: a.closed && !sibling.closed && afterDrop - beforeDrop === 1 };
    a[Symbol.dispose](); sibling[Symbol.dispose]();
    const budget: unknown[] = [];
    for (const mode of ["oversize-default", "invalid-at-budget", "oversized-result", "valid"]) {
      const instance = await make("budget"), document = new Document(), beforeDecode = decodes.length, beforeWrites = writes;
      const result = await outcome(() => instance.exports.replaceText(document, mode, "ignored"));
      budget.push({ mode, ...("value" in result && typeof result.value === "string" ? { outputBytes: new TextEncoder().encode(result.value).byteLength, outputPrefix: result.value.slice(0, 80) } : result), hostWriteCalls: writes - beforeWrites, decodedByteLengths: decodes.slice(beforeDecode) });
      document[Symbol.dispose]();
    }
    results.canonicalBudget = { encodedCap: 2097664, cases: budget, predecodeEnforced: false, publicApiGap: "Polyengine 0.6.7 EmbedderOptions exposes only jspi/verifyHash; no public pre-lift string/encoded-byte budget port. Host facade and session output checks run after canonical decoding." };
    owner.dispose(); results.cleanup = { liveDocuments: live, ...owner.inspect() };
    channel.postMessage({ results });
  } finally { TextDecoder.prototype.decode = originalDecode; owner.dispose(); }
})().catch(error => channel.postMessage({ fatal: String(error), stack: error.stack })); };
