import { test, expect } from "bun:test";
import { createPureComponentSession } from "../src/pure-session.js";
const opts = (extra: Record<string, unknown> = {}) => ({ workerUrl: "worker.js", componentBytes: new Uint8Array([1]), translation: { plan: {} as never, adapters: new Map() }, artifact: { sha256: "a".repeat(64), translationSha256: "b".repeat(64), worldDigest: `sha256:${"c".repeat(64)}` }, exports: ["run"], ...extra }) as never;
class MockWorker {
  static items: MockWorker[] = []; static autoReady = true;
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  sent: any[] = []; terminated = 0;
  constructor() { MockWorker.items.push(this); }
  postMessage(message: any) { this.sent.push(message); if (message.type === "init" && MockWorker.autoReady) queueMicrotask(() => this.onmessage?.({ data: { type: "ready", ok: true } })); }
  terminate() { this.terminated++; }
}
async function setup(extra: Record<string, unknown> = {}) { const session = await createPureComponentSession(opts(extra)); return { session, worker: MockWorker.items.at(-1)! }; }
function useMock() { const old = globalThis.Worker; globalThis.Worker = MockWorker as never; MockWorker.items = []; MockWorker.autoReady = true; return () => { globalThis.Worker = old; MockWorker.autoReady = true; }; }
test("ready then serialized call resolves bounded string", async () => {
  const restore = useMock(); try { const { session, worker } = await setup(); const result = session.call("run", ["x", 1, true]); expect(session.inspect().pendingGuestCalls).toBe(1); worker.onmessage!({ data: { type: "result", id: 1, value: "ok" } }); expect(await result).toBe("ok"); await session.dispose(); } finally { restore(); }
});
test("ready failure and pending-call abort dispose worker", async () => {
  const restore = useMock(); try {
    MockWorker.autoReady = false; const boot = createPureComponentSession(opts()); await Promise.resolve(); MockWorker.items[0]!.onmessage!({ data: { type: "fatal", message: "init rejected" } }); await expect(boot).rejects.toThrow("init rejected"); expect(MockWorker.items[0]!.terminated).toBe(1);
    MockWorker.autoReady = true; const c = new AbortController(); const { session, worker } = await setup({ signal: c.signal }); const call = session.call("run", []).catch(e => e); c.abort("stop"); expect(String(await call)).toContain("stop"); expect(session.inspect().closed).toBe(true); expect(worker.terminated).toBe(1);
  } finally { restore(); }
});
test("stale and malformed results poison session", async () => {
  const restore = useMock(); try { for (const message of [{ type: "result", id: 9, value: "x" }, { type: "result", id: 1, value: 3 }]) { const { session, worker } = await setup(); const call = session.call("run", []).catch(e => e); worker.onmessage!({ data: message }); await call; expect(session.inspect().closed).toBe(true); } } finally { restore(); }
});
test("concurrent and unknown calls reject; timeout terminates", async () => {
  const restore = useMock(); try { const { session, worker } = await setup({ callTimeoutMs: 15 }); const first = session.call("run", []); await expect(session.call("run", [])).rejects.toThrow("serialized"); await expect(session.call("missing", [])).rejects.toThrow("allowed"); await expect(first).rejects.toThrow("deadline"); expect(worker.terminated).toBe(1); } finally { restore(); }
});
test("duplicate ready and mixed success/failure messages poison the session",async()=>{
 const restore=useMock();try{
  const a=await setup();a.worker.onmessage!({data:{type:'ready',ok:true}});expect(a.session.inspect().closed).toBe(true);
  const b=await setup();const call=b.session.call('run',[]).catch(e=>e);b.worker.onmessage!({data:{type:'result',id:1,value:'ok',error:'bad'}});await call;expect(b.session.inspect().closed).toBe(true);
 }finally{restore();}
});
test("invalid hash shape and oversized arguments fail", async () => {
  const restore = useMock(); try { await expect(createPureComponentSession(opts({ artifact: { sha256: "bad", translationSha256: "b".repeat(64), worldDigest: `sha256:${"c".repeat(64)}` } }))).rejects.toThrow("identity"); const { session } = await setup({ maxPayloadBytes: 2 }); await expect(session.call("run", ["abc"])).rejects.toThrow("budget"); await session.dispose(); } finally { restore(); }
});
