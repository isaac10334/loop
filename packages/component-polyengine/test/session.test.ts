import { test, expect } from "bun:test";
import { createDocumentOwner, createPolyengineSession, ComponentOutcomeUncertainError } from "../src/index.js";
const artifact = { sha256: "a".repeat(64), worldDigest: `sha256:${"b".repeat(64)}`, profile: "document" as const, translationSha256: "c".repeat(64) };
class FakeWorker {
  static created: FakeWorker[] = [];
  static failSend = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  terminated = 0;
  sent: unknown[] = [];
  constructor() { FakeWorker.created.push(this); }
  postMessage(value: { type: string }) {
    if (FakeWorker.failSend) throw new Error("clone failure");
    this.sent.push(value);
    if (value.type === "init") queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } }));
  }
  terminate() { this.terminated++; }
}
async function fixture(surface?: { render(): void; nextEvent(): Promise<undefined>; dispose(): void }) {
  const owner = createDocumentOwner({ source: "text", authorize: () => true }), grant = owner.issue({ principal: "test", read: true, write: true });
  return createPolyengineSession({ workerUrl: "worker.js", componentBytes: new Uint8Array([0]), translation: { plan: {} as never, adapters: new Map() }, artifact, document: { owner, grant }, surface });
}
test("disposal completion is cached including surface cleanup failure", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    const session = await fixture({ render() {}, nextEvent: async () => undefined, dispose() { throw new Error("surface cleanup"); } });
    const first = session.dispose(); const second = session.dispose(); expect(first).toBe(second);
    await expect(first).rejects.toThrow("Component cleanup failed"); await expect(second).rejects.toThrow("Component cleanup failed");
    expect(session.inspect()).toEqual({ closed: true, workers: 0, pendingGuestCalls: 0, pendingHostCalls: 0 });
    expect(FakeWorker.created.at(-1)!.terminated).toBe(1);
  } finally { globalThis.Worker = original; }
});
test("structured-clone init failure still terminates acquired worker", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never; FakeWorker.failSend = true;
  try { await expect(fixture()).rejects.toThrow("clone failure"); expect(FakeWorker.created.at(-1)!.terminated).toBe(1); }
  finally { FakeWorker.failSend = false; globalThis.Worker = original; }
});
test("cancel after commit before guest result reports reconciliation instead of rollback", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    const session = await fixture(), worker = FakeWorker.created.at(-1)!;
    const result = session.replaceText("a", "b").catch(error => error);
    worker.onmessage!({ data: { type: "host", id: 1, operation: "write", expectedRevision: "0", source: "committed" } });
    await new Promise(resolve => setTimeout(resolve, 0));
    await session.dispose(new Error("transport gone"));
    const failure = await result;
    expect(failure).toBeInstanceOf(ComponentOutcomeUncertainError); expect(failure.revision).toBe("1"); expect(failure.outcome).toBe("committed-host-write");
  } finally { globalThis.Worker = original; }
});
test("worker result accepts the native decoded output boundary", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    const session = await fixture(), worker = FakeWorker.created.at(-1)!, result = session.replaceText("a", "b");
    worker.onmessage!({ data: { type: "result", id: 1, value: "é".repeat(524416) } }); expect((await result).length).toBe(524416); expect(session.inspect().closed).toBe(false); await session.dispose();
  } finally { globalThis.Worker = original; }
});
test("oversized worker result fails before a second encoding", async () => {
  const originalWorker = globalThis.Worker, originalEncode = TextEncoder.prototype.encode; globalThis.Worker = FakeWorker as never; let largeEncodes = 0;
  try {
    const session = await fixture(), worker = FakeWorker.created.at(-1)!;
    TextEncoder.prototype.encode = function(input?: string) { if (typeof input === "string" && input.length > 1048832) largeEncodes++; return originalEncode.call(this, input); };
    const result = session.replaceText("a", "b"); worker.onmessage!({ data: { type: "result", id: 1, value: "x".repeat(1048833) } });
    await expect(result).rejects.toThrow("budget/type"); expect(largeEncodes).toBe(0); expect(session.inspect().closed).toBe(true); await session.dispose();
  } finally { TextEncoder.prototype.encode = originalEncode; globalThis.Worker = originalWorker; }
});
test("malformed worker result after commit reports uncertain outcome", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    const session = await fixture(), worker = FakeWorker.created.at(-1)!;
    const result = session.replaceText("a", "b").catch(error => error);
    worker.onmessage!({ data: { type: "host", id: 1, operation: "write", expectedRevision: "0", source: "committed" } }); await new Promise(resolve => setTimeout(resolve, 0));
    worker.onmessage!({ data: { type: "result", id: 1, value: "x".repeat(1048833) } });
    const failure = await result; expect(failure).toBeInstanceOf(ComponentOutcomeUncertainError); expect(failure.revision).toBe("1"); expect(session.inspect().closed).toBe(true); await session.dispose();
  } finally { globalThis.Worker = original; }
});
test("malformed worker failures fail closed instead of reaching callers", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    let touched = false; const accessor = Object.defineProperty({}, "kind", { enumerable: true, get() { touched = true; throw new Error("getter executed"); } });
    const errors = [{ kind: "forged" }, { kind: "invalid-source", value: "x".repeat(65537) }, { kind: "conflict", value: { revision: "é".repeat(65), source: "ok" } }, { kind: "denied", value: "unexpected" }, accessor];
    for (const error of errors) {
      const session = await fixture(), worker = FakeWorker.created.at(-1)!, result = session.replaceText("a", "b").catch(failure => failure);
      worker.onmessage!({ data: { type: "result", id: 1, error } }); const failure = await result;
      expect(String(failure)).toContain("Invalid Component failure payload"); expect(session.inspect().closed).toBe(true); await session.dispose();
    }
    expect(touched).toBe(false);
    const session = await fixture(), worker = FakeWorker.created.at(-1)!, result = session.replaceText("a", "b").catch(failure => failure);
    worker.onmessage!({ data: { type: "result", id: 1, error: { kind: "denied" }, value: "also-success" } }); expect(String(await result)).toContain("Invalid Component failure payload"); expect(session.inspect().closed).toBe(true); await session.dispose();
  } finally { globalThis.Worker = original; }
});
test("valid bounded worker failures retain their typed payload", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    for (const error of [{ kind: "denied" }, { kind: "invalid-source", value: "x".repeat(65536) }, { kind: "conflict", value: { revision: "é".repeat(64), source: "ok" } }]) {
      const session = await fixture(), worker = FakeWorker.created.at(-1)!, result = session.replaceText("a", "b").catch(failure => failure);
      worker.onmessage!({ data: { type: "result", id: 1, error } }); const failure = await result;
      expect(failure.failure).toEqual(error); expect(session.inspect().closed).toBe(false); await session.dispose();
    }
  } finally { globalThis.Worker = original; }
});
test("malformed worker failure after a commit remains uncertain", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    const session = await fixture(), worker = FakeWorker.created.at(-1)!, result = session.replaceText("a", "b").catch(error => error);
    worker.onmessage!({ data: { type: "host", id: 1, operation: "write", expectedRevision: "0", source: "committed" } }); await new Promise(resolve => setTimeout(resolve, 0));
    worker.onmessage!({ data: { type: "result", id: 1, error: { kind: "forged" } } }); const failure = await result;
    expect(failure).toBeInstanceOf(ComponentOutcomeUncertainError); expect(failure.revision).toBe("1"); expect(session.inspect().closed).toBe(true); await session.dispose();
  } finally { globalThis.Worker = original; }
});
test("invalid worker revision is rejected before invoking an owner", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never; let writes = 0;
  try {
    const owner = createDocumentOwner({ source: "text", authorize: () => true }), grant = owner.issue({ principal: "test", read: true, write: true });
    const tracked = { ...owner, write: async (...args: Parameters<typeof owner.write>) => { writes++; return owner.write(...args); } };
    const session = await createPolyengineSession({ workerUrl: "worker.js", componentBytes: new Uint8Array([0]), translation: { plan: {} as never, adapters: new Map() }, artifact, document: { owner: tracked, grant } });
    const worker = FakeWorker.created.at(-1)!, result = session.replaceText("a", "b").catch(error => error);
    worker.onmessage!({ data: { type: "host", id: 1, operation: "write", expectedRevision: "x".repeat(129), source: "ok" } }); await new Promise(resolve => setTimeout(resolve, 0));
    expect(writes).toBe(0); expect(worker.sent).toContainEqual({ type: "hostResult", id: 1, error: { kind: "invalid-source", value: "Invalid expected revision" } });
    await session.dispose(); await result;
  } finally { globalThis.Worker = original; }
});
test("serialized entry and unsolicited result fail closed", async () => {
  const original = globalThis.Worker; globalThis.Worker = FakeWorker as never;
  try {
    const session = await fixture(), worker = FakeWorker.created.at(-1)!;
    const first = session.replaceText("a", "b");
    await expect(session.replaceText("a", "c")).rejects.toThrow("serialized");
    worker.onmessage!({ data: { type: "result", id: 99, value: "late" } });
    await expect(first).rejects.toThrow("Unsolicited"); await session.dispose(); expect(worker.terminated).toBe(1);
  } finally { globalThis.Worker = original; }
});
