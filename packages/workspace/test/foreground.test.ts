import { expect, test } from "bun:test";
import { createSourceSnapshot, type BuildReceipt, type BuildRequest, type Digest } from "../src/index.js";
import { createForegroundDevelopment, type ForegroundPorts } from "../src/foreground.js";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const recipe = `sha256:${"a".repeat(64)}` as Digest;
type Candidate = { id: number; writable: boolean };
async function fixture() {
  const source = await createSourceSnapshot({ "main.ts": "first" });
  const editor = { selection: 7, unsaved: "keep me" };
  const events: string[] = [], candidates: Candidate[] = [];
  const builds: Array<{ request: BuildRequest; result: ReturnType<typeof deferred<BuildReceipt>>; signal?: AbortSignal }> = [];
  const started: Array<ReturnType<typeof deferred<void>>> = [];
  const ports: ForegroundPorts<Candidate> = {
    async prepare(context, resources) {
      events.push(`prepare:${context.generation}`);
      expect(context.effects).toBe("read-only");
      resources.defer(() => { events.push(`resource:${context.generation}:first`); });
      resources.defer(() => { events.push(`resource:${context.generation}:second`); });
      const candidate = { id: context.generation, writable: false };
      candidates.push(candidate);
      return candidate;
    },
    async health(candidate) { expect(candidate.writable).toBe(false); events.push(`health:${candidate.id}`); },
    async quiesce(candidate) { events.push(`quiesce:${candidate.id}`); candidate.writable = false; },
    async resume(candidate) { events.push(`resume:${candidate.id}`); candidate.writable = true; },
    promote(candidate) {
      expect(candidates.filter(item => item.writable)).toHaveLength(0);
      candidate.writable = true; events.push(`promote:${candidate.id}`);
    },
    async dispose(candidate) { candidate.writable = false; events.push(`dispose:${candidate.id}`); },
  };
  const owner = createForegroundDevelopment({ editor, source, ports, buildProvider: {
    build(request, _source, signal) {
      const result = deferred<BuildReceipt>();
      const index = builds.length;
      builds.push({ request, result, signal });
      started[index]?.resolve();
      return result.promise;
    },
  } });
  const request = (): BuildRequest => ({ source: owner.inspect().draft.digest, recipe, targetProfile: "test", idempotencyKey: String(builds.length) });
  const begin = async (signal?: AbortSignal) => {
    const index = builds.length;
    const ready = deferred<void>(); started[index] = ready;
    const result = owner.build(request(), { signal });
    await ready.promise;
    return { result, index };
  };
  const complete = (index: number) => {
    const build = builds[index]!;
    build.result.resolve({ source: build.request.source, recipe, targetProfile: "test", toolchain: "controlled-compiler", outputs: { "main.js": recipe } });
  };
  const activate = async () => { const build = await begin(); complete(build.index); expect((await build.result).status).toBe("activated"); return owner.inspect().active!; };
  return { source, editor, events, candidates, builds, ports, owner, request, begin, complete, activate };
}

test("compilation keeps previous writer; successful selection quiesces before grant and retains sibling editor", async () => {
  const f = await fixture();
  const first = await f.activate();
  const next = await createSourceSnapshot({ "main.ts": "second" });
  f.owner.edit(next);
  const build = await f.begin();
  expect(f.candidates[0]!.writable).toBe(true);
  expect(f.owner.inspect().active).toBe(first);
  f.complete(build.index);
  expect((await build.result).status).toBe("activated");
  expect(f.owner.inspect().active?.source.digest).toBe(next.digest);
  expect(f.owner.inspect().editor).toBe(f.editor);
  expect(f.editor).toEqual({ selection: 7, unsaved: "keep me" });
  expect(f.events.slice(-5)).toEqual([`quiesce:${first.generation}`, "promote:3", `dispose:${first.generation}`, `resource:${first.generation}:second`, `resource:${first.generation}:first`]);
  await f.owner.dispose();
});

test("failed build, failed partial initialization and failed health preserve working generation and draft", async () => {
  const f = await fixture(); const first = await f.activate();
  const next = await createSourceSnapshot({ "main.ts": "unsaved revision" }); f.owner.edit(next);
  let build = await f.begin(); f.builds[build.index]!.result.reject(new Error("compiler failed"));
  expect((await build.result).status).toBe("failed");
  f.ports.prepare = async (_context, resources) => {
    resources.defer(() => { f.events.push("partial:first"); });
    resources.defer(() => { f.events.push("partial:second"); throw new Error("cleanup fault"); });
    throw new Error("init failed");
  };
  build = await f.begin(); f.complete(build.index);
  const failed = await build.result;
  expect(failed.status).toBe("failed"); expect(failed.cleanupErrors).toHaveLength(1);
  expect(f.events.slice(-2)).toEqual(["partial:second", "partial:first"]);
  f.ports.prepare = async context => { const candidate = { id: context.generation, writable: false }; f.candidates.push(candidate); return candidate; };
  f.ports.health = async () => { throw new Error("unhealthy"); };
  build = await f.begin(); f.complete(build.index);
  expect((await build.result).status).toBe("failed");
  expect(f.owner.inspect().active).toBe(first); expect(f.candidates[0]!.writable).toBe(true);
  expect(f.owner.inspect().draft).toBe(next); expect(f.owner.inspect().editor).toBe(f.editor);
  await f.owner.dispose();
});

test("reversed build completions cannot supersede a newer selection", async () => {
  const f = await fixture(); await f.activate();
  const old = await f.begin();
  f.owner.edit(await createSourceSnapshot({ "main.ts": "newer" }));
  const next = await f.begin(); f.complete(next.index);
  expect((await next.result).status).toBe("activated");
  const active = f.owner.inspect().active;
  f.complete(old.index); expect((await old.result).status).toBe("superseded");
  expect(f.owner.inspect().active).toBe(active);
  expect(f.events.filter(event => event.startsWith("promote:"))).toHaveLength(2);
  await f.owner.dispose();
});

test("cancelled compiler suppresses late preparation, late candidates are disposed", async () => {
  const f = await fixture(); const first = await f.activate();
  const controller = new AbortController(); const build = await f.begin(controller.signal);
  controller.abort(); expect(f.builds[build.index]!.signal?.aborted).toBe(true);
  f.complete(build.index); expect((await build.result).status).toBe("cancelled");
  expect(f.candidates).toHaveLength(1);
  const prepared = deferred<void>(), late = deferred<Candidate>();
  f.ports.prepare = async () => { prepared.resolve(); return late.promise; };
  const cancel = new AbortController(); const next = await f.begin(cancel.signal); f.complete(next.index);
  await prepared.promise; cancel.abort(); late.resolve({ id: 99, writable: false });
  expect((await next.result).status).toBe("cancelled");
  expect(f.events).toContain("dispose:99"); expect(f.owner.inspect().active).toBe(first);
  await f.owner.dispose();
});

test("cancellation during quiesce resumes old; cancellation at committed grant reports activation", async () => {
  const f = await fixture(); const first = await f.activate();
  const entered = deferred<void>(), release = deferred<void>();
  f.ports.quiesce = async candidate => { candidate.writable = false; entered.resolve(); await release.promise; };
  const cancel = new AbortController(); const build = await f.begin(cancel.signal); f.complete(build.index);
  await entered.promise; cancel.abort(); release.resolve();
  expect((await build.result).status).toBe("cancelled");
  expect(f.owner.inspect().active).toBe(first); expect(f.candidates[0]!.writable).toBe(true);
  const committed = new AbortController();
  f.ports.promote = candidate => { expect(f.candidates.some(item => item.writable)).toBe(false); candidate.writable = true; committed.abort(); };
  const next = await f.begin(committed.signal); f.complete(next.index);
  expect((await next.result).status).toBe("activated");
  expect(f.owner.inspect().active?.generation).not.toBe(first.generation);
  await f.owner.dispose();
});

test("promotion failure resumes old; cleanup fault after commit never claims rollback", async () => {
  const f = await fixture(); const first = await f.activate();
  const promote = f.ports.promote;
  f.ports.promote = () => { throw new Error("grant failed"); };
  const build = await f.begin(); f.complete(build.index);
  expect((await build.result).status).toBe("failed");
  expect(f.owner.inspect().active).toBe(first); expect(f.candidates[0]!.writable).toBe(true);
  f.ports.promote = promote;
  f.ports.dispose = async candidate => { candidate.writable = false; throw new Error(`dispose:${candidate.id}`); };
  const next = await f.begin(); f.complete(next.index);
  const result = await next.result; expect(result.status).toBe("activated"); expect(result.cleanupErrors).toHaveLength(1);
  const disposal = f.owner.dispose(); expect(f.owner.dispose()).toBe(disposal);
  await expect(disposal).rejects.toThrow(AggregateError);
  expect(f.events.slice(-2)).toEqual([`resource:${result.generation}:second`, `resource:${result.generation}:first`]);
  expect(f.candidates.every(candidate => !candidate.writable)).toBe(true);
});

test("dispose aborts and joins late build without closing sibling editor", async () => {
  const f = await fixture(); await f.activate(); const build = await f.begin();
  const disposal = f.owner.dispose();
  expect(f.builds[build.index]!.signal?.aborted).toBe(true);
  f.complete(build.index); expect((await build.result).status).toBe("cancelled");
  await disposal;
  expect(f.owner.inspect().active).toBeUndefined(); expect(f.owner.inspect().editor).toBe(f.editor);
  expect(() => f.owner.edit(f.source)).toThrow("disposed");
  await expect(f.owner.build(f.request())).rejects.toThrow("disposed");
});

test("active lifetime survives later builds and is aborted synchronously on owner disposal", async () => {
  const f = await fixture();
  let activeSignal: AbortSignal | undefined;
  const prepare = f.ports.prepare;
  f.ports.prepare = async (context, resources) => { activeSignal ??= context.signal; return prepare(context, resources); };
  const caller = new AbortController(); const first = await f.begin(caller.signal); f.complete(first.index);
  expect((await first.result).status).toBe("activated");
  caller.abort(); expect(activeSignal?.aborted).toBe(false);
  const pending = await f.begin(); expect(activeSignal?.aborted).toBe(false);
  const disposal = f.owner.dispose(); expect(activeSignal?.aborted).toBe(true);
  f.complete(pending.index); expect((await pending.result).status).toBe("cancelled");
  await disposal;
});

test("edit during health invalidates candidate but preserves old writer and exact draft", async () => {
  const f = await fixture(); const first = await f.activate();
  const entered = deferred<void>(), release = deferred<void>();
  f.ports.health = async () => { entered.resolve(); await release.promise; };
  const build = await f.begin(); f.complete(build.index); await entered.promise;
  const draft = await createSourceSnapshot({ "main.ts": "edit while health runs" });
  f.owner.edit(draft); expect(f.candidates[0]!.writable).toBe(true);
  release.resolve(); expect((await build.result).status).toBe("superseded");
  expect(f.owner.inspect().active).toBe(first); expect(f.owner.inspect().draft).toBe(draft);
  expect(f.events).toContain("dispose:2"); expect(f.events).not.toContain("promote:2");
  await f.owner.dispose();
});

test("mismatched receipt and source cannot reach candidate preparation", async () => {
  const f = await fixture();
  expect((await f.owner.build({ ...f.request(), source: recipe })).status).toBe("failed");
  const build = await f.begin();
  f.builds[build.index]!.result.resolve({ source: recipe, recipe, targetProfile: "test", toolchain: "fake", outputs: { "out": recipe } });
  expect((await build.result).status).toBe("failed"); expect(f.candidates).toHaveLength(0);
  await f.owner.dispose();
});

test("a newer candidate queued during quiesce wins without overlapping writes", async () => {
  const f = await fixture(); const first = await f.activate();
  const entered = deferred<void>(), release = deferred<void>(), healthy = deferred<void>();
  let quiesces = 0;
  f.ports.quiesce = async candidate => {
    candidate.writable = false;
    if (++quiesces === 1) { entered.resolve(); await release.promise; }
  };
  const health = f.ports.health;
  f.ports.health = async (candidate, signal) => { await health(candidate, signal); if (candidate.id === 3) healthy.resolve(); };
  const old = await f.begin(); f.complete(old.index); await entered.promise;
  const next = await f.begin(); f.complete(next.index); await healthy.promise;
  release.resolve();
  expect((await old.result).status).toBe("superseded");
  expect((await next.result).status).toBe("activated");
  expect(f.owner.inspect().active?.generation).toBe(3);
  expect(f.events).toContain(`resume:${first.generation}`);
  expect(f.events).not.toContain("promote:2"); expect(f.events).toContain("dispose:2");
  expect(f.candidates.filter(candidate => candidate.writable)).toHaveLength(1);
  await f.owner.dispose();
});

test("quiesce failure leaves old selected, restore failure is visible rather than rollback success", async () => {
  const f = await fixture(); const first = await f.activate();
  f.ports.quiesce = async () => { throw new Error("cannot drain"); };
  let build = await f.begin(); f.complete(build.index);
  expect((await build.result).status).toBe("failed"); expect(f.owner.inspect().active).toBe(first);
  expect(f.candidates[0]!.writable).toBe(true);
  f.ports.quiesce = async candidate => { candidate.writable = false; };
  f.ports.promote = () => { throw new Error("no grant"); };
  f.ports.resume = () => { throw new Error("cannot restore"); };
  build = await f.begin(); f.complete(build.index);
  const failed = await build.result; expect(failed.status).toBe("failed");
  expect(failed.error).toBeInstanceOf(AggregateError);
  expect((failed.error as AggregateError).errors).toHaveLength(2);
  expect(f.candidates.every(candidate => !candidate.writable)).toBe(true);
  await f.owner.dispose();
});
