import { expect, test } from "bun:test";
import { defineCapability } from "@loop-kit/capabilities";
import { createHost, createResourceOwner, toLegacyHandle } from "../src/index.js";
const cap = defineCapability<{ next(): number }>({ id: "loop:test/resource", version: "1" });
function gate<T = void>() { let resolve!: (value: T | PromiseLike<T>) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }

test("retained ownership, borrow invalidation and atomic transfer between consumers", async () => {
  await using host = createHost();
  const a = host.scope(), b = host.scope(); let disposed = 0;
  const first = a.own({ n: 7 }, () => { disposed++; });
  const borrow = first.borrow(), retained = first.retain(b);
  await a.revoke();
  expect(first.signal.aborted).toBe(true); expect(() => borrow.value).toThrow("revoked");
  expect(retained.value.n).toBe(7); expect(disposed).toBe(0);
  const destination = host.scope(); const moved = retained.transferTo(destination);
  expect(() => retained.value).toThrow("released");
  await b.revoke(); expect(moved.value.n).toBe(7);
  await destination.revoke(); expect(disposed).toBe(1);
  await moved.release(); expect(disposed).toBe(1);
});

test("invalid transfer is atomic and foreign scopes cannot retain", async () => {
  await using host = createHost(); await using other = createHost();
  const a = host.scope(), revoked = host.scope(); await revoked.revoke();
  const lease = a.own(5);
  expect(() => lease.transferTo(revoked)).toThrow();
  expect(() => lease.retain(other.scope())).toThrow("belong");
  expect(lease.value).toBe(5);
});

test("concurrent shared acquisitions single-flight creation and final cleanup", async () => {
  await using host = createHost(); const a = host.scope(), b = host.scope();
  const ready = gate<{ next(): number }>(); let created = 0, disposed = 0; let signal!: AbortSignal;
  host.provide(cap, { create(ctx) { signal = ctx.signal; created++; return ready.promise; }, dispose() { disposed++; } }, { lifetime: "shared" });
  const first = a.acquire(cap), second = b.acquire(cap);
  expect(created).toBe(1);
  ready.resolve({ next: () => 7 }); const [one, two] = await Promise.all([first, second]);
  expect(one.value).toBe(two.value);
  const retained = one.retain(b);
  await one.release(); expect(one.signal.aborted).toBe(true); expect(signal.aborted).toBe(false);
  await two.release(); expect(disposed).toBe(0);
  await retained.release(); expect(signal.aborted).toBe(true); expect(disposed).toBe(1);
});

test("revoking one pending shared consumer does not cancel another or delay revoked consumer", async () => {
  await using host = createHost(); const a = host.scope(), b = host.scope(); const ready = gate<{ next(): number }>();
  let signal!: AbortSignal;
  host.provide(cap, { create(ctx) { signal = ctx.signal; return ready.promise; } }, { lifetime: "shared" });
  const first = a.acquire(cap).catch(error => error), second = b.acquire(cap);
  await a.revoke(); expect((await first).message).toContain("cancelled"); expect(signal.aborted).toBe(false);
  ready.resolve({ next: () => 3 }); expect((await second).value.next()).toBe(3);
});

test("last pending lease revocation aborts immediately and waits for late disposal", async () => {
  const host = createHost(), owner = host.scope(), ready = gate<{ next(): number }>(), cleanup = gate(); let disposed = 0; let signal!: AbortSignal;
  host.provide(cap, { create(ctx) { signal = ctx.signal; return ready.promise; }, async dispose() { disposed++; await cleanup.promise; } }, { lifetime: "shared" });
  const pending = owner.acquire(cap).catch(error => error);
  const close = owner.revoke(); expect(signal.aborted).toBe(true);
  ready.resolve({ next: () => 1 }); let closed = false; void close.then(() => { closed = true; });
  await Promise.resolve(); expect(closed).toBe(false);
  cleanup.resolve(); await close; expect(disposed).toBe(1); expect((await pending).message).toContain("cancelled"); await host.dispose();
});

test("children finish before parent resources; parent resources close sequentially in reverse order", async () => {
  await using host = createHost(); const log: string[] = [], parent = host.scope(), child = parent.scope(), gateChild = gate();
  parent.defer(() => { log.push("parent:first"); }); parent.defer(() => { log.push("parent:last"); });
  child.defer(async () => { log.push("child:start"); await gateChild.promise; log.push("child:end"); });
  const close = parent.revoke(); expect(parent.signal.aborted && child.signal.aborted).toBe(true);
  await Promise.resolve(); expect(log).not.toContain("parent:last"); gateChild.resolve(); await close;
  expect(log).toEqual(["child:start", "child:end", "parent:last", "parent:first"]);
});

test("symbol disposal and explicit cleanup precedence; await using works without global stacks", async () => {
  let sync = 0, async = 0, explicit = 0;
  { await using host = createHost(); await using scope = host.scope();
    scope.own({ [Symbol.dispose]() { sync++; } });
    scope.own({ async [Symbol.asyncDispose]() { async++; }, [Symbol.dispose]() { sync++; } });
    scope.own({ [Symbol.dispose]() { sync++; } }, () => { explicit++; });
  }
  expect([sync, async, explicit]).toEqual([1, 1, 1]);
});

test("partial initialization failures clean all registered resources once in reverse order", async () => {
  await using host = createHost(); const log: number[] = [];
  host.provide(cap, { create({ resources }) { resources.defer(() => { log.push(1); }); resources.defer(() => { log.push(2); }); throw new Error("create failed"); } });
  await expect(host.scope().acquire(cap)).rejects.toThrow("create failed"); expect(log).toEqual([2, 1]);
});

test("initialization stack is idempotent, reentrant and continues after errors", async () => {
  const stack = createResourceOwner(), order: number[] = []; let reentered: Promise<void> | undefined;
  stack.defer(() => { order.push(1); }); stack.defer(() => { order.push(2); throw new Error("bad"); });
  stack.defer(() => { reentered = stack[Symbol.asyncDispose](); order.push(3); });
  const close = stack[Symbol.asyncDispose](); expect(stack[Symbol.asyncDispose]()).toBe(close);
  await expect(close).rejects.toThrow("cleanup failed"); expect(reentered).toBe(close); expect(order).toEqual([3, 2, 1]);
  expect(() => stack.defer(() => {})).toThrow("disposed");
});

test("registration activation is single-flight with separate cleanup and sticky failure", async () => {
  await using host = createHost(); const gateActivation = gate(); let activated = 0, cleaned = 0, created = 0;
  const registration = host.provide(cap, {
    async activate({ resources }) { activated++; resources.defer(() => { cleaned++; }); await gateActivation.promise; },
    create() { created++; return { next: () => 1 }; },
  });
  const owner = host.scope(); const a = owner.acquire(cap), b = owner.acquire(cap);
  expect(activated).toBe(1); expect(created).toBe(0); gateActivation.resolve(); await Promise.all([a, b]);
  await owner.revoke(); expect(cleaned).toBe(0); await registration.unregister(); expect(cleaned).toBe(1);
  let attempts = 0;
  const bad = host.provide(cap, { activate({ resources }) { attempts++; resources.defer(() => { cleaned++; }); throw new Error("offline"); }, create() { throw new Error("unreachable"); } });
  await expect(bad.activate()).rejects.toThrow("activation failed"); await expect(host.scope().acquire(cap)).rejects.toThrow();
  expect(attempts).toBe(1); expect(cleaned).toBe(2); await bad.unregister();
});

test("unregister during activation waits for late initialization cleanup without creating values", async () => {
  await using host = createHost(); const ready = gate(); let cleaned = 0, created = 0;
  const reg = host.provide(cap, { async activate({ resources }) { await ready.promise; resources.defer(() => { cleaned++; }); }, create() { created++; return { next: () => 0 }; } });
  const acquire = host.scope().acquire(cap).catch(error => error); const close = reg.unregister(); ready.resolve();
  await close; await acquire; expect(cleaned).toBe(1); expect(created).toBe(0);
});

test("abort and cleanup can reenter lifecycle methods without duplicate disposal", async () => {
  const host = createHost(), scope = host.scope(); let calls = 0; let reentrant: Promise<void> | undefined;
  const handle = scope.own(1, () => { calls++; reentrant = scope.revoke(); });
  handle.signal.addEventListener("abort", () => { reentrant = scope.revoke(); });
  const close = scope.revoke(); await close; expect(reentrant).toBe(close); expect(calls).toBe(1); await host.dispose();
});

test("cleanup errors propagate while other resources still close", async () => {
  const host = createHost(), scope = host.scope(); const order: number[] = [];
  scope.defer(() => { order.push(1); throw new Error("one"); }); scope.defer(() => { order.push(2); throw new Error("two"); });
  const close = scope.revoke(); await expect(close).rejects.toThrow("Scope revocation failed"); expect(order).toEqual([2, 1]);
  expect(scope.revoke()).toBe(close); expect(host.inspect().scopes).toEqual([]); await host.dispose();
});

test("scope revocation cancels tasks and joins body before disposing its resources", async () => {
  await using host = createHost(); const owner = host.scope(), entered = gate(), finish = gate(); const log: string[] = [];
  const task = owner.task(async ({ signal, scope }) => {
    scope.defer(() => { log.push("dispose"); }); signal.addEventListener("abort", () => { log.push("abort"); entered.resolve(); }, { once: true });
    await finish.promise; log.push("body"); return 42;
  });
  const close = owner.revoke(); await entered.promise; expect(task.signal.aborted).toBe(true); expect(log).toEqual(["abort"]);
  finish.resolve(); await close; await expect(task.result).rejects.toThrow("cancelled"); expect(log).toEqual(["abort", "body", "dispose"]);
});

test("task completion joins nested tasks and cancellation cleanup failures are observable", async () => {
  await using host = createHost(); const owner = host.scope(), finished = gate(); let childAborted = false;
  const task = owner.task(({ scope }) => {
    scope.task(async ({ signal }) => { signal.addEventListener("abort", () => { childAborted = true; finished.resolve(); }, { once: true }); await finished.promise; });
    return 17;
  });
  expect(await task.result).toBe(17); expect(childAborted).toBe(true);
  const broken = owner.task(async ({ scope, signal }) => {
    scope.defer(() => { throw new Error("cleanup"); }); await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  });
  await expect(broken.cancel()).rejects.toThrow("Scope revocation failed"); await expect(broken.result).rejects.toThrow();
});

test("task exceptions, external cancellation, expired and relative deadlines", async () => {
  await using host = createHost(); const owner = host.scope();
  const error = owner.task(() => { throw new Error("body failed"); }); await expect(error.result).rejects.toThrow("Task failed");
  let invoked = false; const expired = owner.task(() => { invoked = true; }, { deadline: Date.now() - 1 });
  await expect(expired.result).rejects.toThrow(); expect(invoked).toBe(false);
  const controller = new AbortController();
  const external = owner.task(async ({ signal }) => { await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true })); }, { signal: controller.signal });
  controller.abort(); expect(external.signal.aborted).toBe(true); await expect(external.result).rejects.toThrow();
  const deadline = owner.task(async ({ signal }) => { await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true })); }, { timeout: 2 });
  await expect(deadline.result).rejects.toThrow(); expect(deadline.signal.aborted).toBe(true);
});

test("eager service pins shared state, exact bindings see replacement and old handles invalidate", async () => {
  await using host = createHost(); const consumer = host.scope(); let cleaned = 0;
  const service = await host.start(cap, { create: () => ({ next: () => 1 }), dispose() { cleaned++; } }, { serviceId: "worker" });
  const binding = consumer.bind(cap, "worker"), old = await binding.acquire();
  await old.release(); expect(cleaned).toBe(0);
  const retained = await binding.acquire(); await service.stop(); expect(() => retained.value).toThrow(); expect(cleaned).toBe(1);
  await expect(binding.acquire()).rejects.toThrow("No provider");
  await host.start(cap, { create: () => ({ next: () => 2 }) }, { serviceId: "worker" });
  expect((await binding.acquire()).value.next()).toBe(2);
  host.provide(cap, { create: () => ({ next: () => 9 }) });
  await expect(consumer.bind(cap, "missing").acquire()).rejects.toThrow("No provider");
});

test("service owner revocation closes all consumers, failure and duplicates do not leak scopes", async () => {
  await using host = createHost(); const owner = host.scope(), consumer = host.scope();
  await host.start(cap, { create: () => ({ next: () => 1 }) }, { serviceId: "worker", owner });
  const handle = await consumer.acquire(cap, { serviceId: "worker" });
  const before = host.inspect().scopes.length;
  await expect(host.start(cap, { create: () => ({ next: () => 2 }) }, { serviceId: "worker" })).rejects.toThrow("startup failed");
  expect(host.inspect().scopes.length).toBe(before);
  await owner.revoke(); expect(handle.signal.aborted).toBe(true); expect(() => handle.value).toThrow();
  await expect(host.start(cap, { create() { throw new Error("broken"); } }, { serviceId: "bad" })).rejects.toThrow();
  expect(host.inspect().providers).toEqual([]);
});

test("snapshots remain cached, deeply immutable and source-free across task/resource changes", async () => {
  await using host = createHost(); const owner = host.scope(); const before = host.inspect(); let calls = 0;
  host.subscribe(() => { calls++; }); const lease = owner.own({ secret: "never reflect" }); const hold = gate();
  const task = owner.task(() => hold.promise, { name: "job" }); const during = host.inspect();
  expect(host.inspect()).toBe(during); expect(before.scopes[0].resources).toEqual([]);
  expect(Object.isFrozen(during.scopes[0].resources[0])).toBe(true); expect(Object.isFrozen(during.scopes[0].tasks[0])).toBe(true);
  expect(JSON.stringify(during)).not.toContain("secret"); await Promise.resolve(); expect(calls).toBe(1);
  hold.resolve(); await task.result; await lease.release(); expect(host.inspect().scopes[0].tasks).toEqual([]);
});

test("host disposal aborts registration activation before joining waiting consumers", async () => {
  const host = createHost(); let aborted = false;
  host.provide(cap, { activate({ signal }) { return new Promise<void>((_, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled startup")); }, { once: true })); }, create: () => ({ next: () => 1 }) });
  const acquisition = host.scope().acquire(cap).catch(error => error);
  const disposal = host.dispose(); expect(aborted).toBe(true); await disposal; await acquisition;
});

test("late pending parent acquisitions cannot dispose before child scope completion", async () => {
  const host = createHost(), parent = host.scope(), child = parent.scope(), ready = gate<{ next(): number }>(), finishChild = gate();
  const order: string[] = [];
  host.provide(cap, { create: () => ready.promise, dispose() { order.push("parent-resource"); } });
  child.defer(async () => { await finishChild.promise; order.push("child-resource"); });
  const acquiring = parent.acquire(cap).catch(error => error);
  const closing = parent.revoke(); ready.resolve({ next: () => 1 });
  await Promise.resolve(); await Promise.resolve(); expect(order).toEqual([]);
  finishChild.resolve(); await closing; await acquiring; expect(order).toEqual(["child-resource", "parent-resource"]); await host.dispose();
});

test("shared replacement can begin while the previous generation is still disposing", async () => {
  await using host = createHost(); const scope = host.scope(), finish = gate(); let created = 0;
  const old = host.provide(cap, { create: () => ({ next: () => ++created }), dispose: () => finish.promise }, { serviceId: "named", lifetime: "shared" });
  const handle = await scope.acquire(cap, { serviceId: "named" }); expect(handle.value.next()).toBe(1);
  const removal = old.unregister(); expect(() => handle.value).toThrow();
  host.provide(cap, { create: () => ({ next: () => 99 }) }, { serviceId: "named", lifetime: "shared" });
  const replacement = await scope.acquire(cap, { serviceId: "named" }); expect(replacement.value.next()).toBe(99);
  expect(host.inspect().providers).toHaveLength(2); finish.resolve(); await removal;
  expect(replacement.signal.aborted).toBe(false); expect(host.inspect().providers).toHaveLength(1);
});


test("native disposable stacks consume host ownership protocols and the legacy adapter is explicit", async () => {
  let syncClosed = 0, resourceClosed = 0; let providerSignal!: AbortSignal;
  { using stack = new DisposableStack(); stack.use({ [Symbol.dispose]() { syncClosed++; } }); }
  expect(syncClosed).toBe(1);
  { await using stack = new AsyncDisposableStack();
    const host = stack.use(createHost()), owner = host.scope();
    host.provide(cap, { create({ signal }) { providerSignal = signal; return { next: () => 8 }; }, dispose() { resourceClosed++; } });
    const ticket = stack.use(await owner.acquire(cap)), legacy = toLegacyHandle(ticket);
    expect(legacy.signal).toBe(providerSignal); expect(ticket.resourceSignal).toBe(providerSignal);
    await legacy.release(); expect(() => ticket.value).toThrow(); expect(legacy.value.next()).toBe(8);
  }
  expect(resourceClosed).toBe(1);
});

test("task cancellation caches completion before reentrant abort callbacks", async () => {
  await using host = createHost(); let reentered: Promise<void> | undefined;
  const task = host.scope().task(async ({ signal }) => { await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true })); });
  task.signal.addEventListener("abort", () => { reentered = task.cancel(); });
  const close = task.cancel(); expect(reentered).toBe(close); await close;
});

test("many simultaneous consumers and disposal races preserve exactly-once ownership", async () => {
  const host = createHost(); let created = 0, disposed = 0;
  const reg = host.provide(cap, { create() { created++; return { next: () => 1 }; }, async dispose() { await Promise.resolve(); disposed++; } }, { lifetime: "shared" });
  const owners = Array.from({ length: 32 }, () => host.scope());
  const leases = await Promise.all(owners.map(owner => owner.acquire(cap)));
  const retained = leases.map((lease, index) => lease.retain(owners[(index + 1) % owners.length]!));
  await Promise.all([...leases.map(lease => lease.release()), ...retained.map(lease => lease.release()), ...owners.map(owner => owner.revoke()), reg.unregister(), host.dispose()]);
  expect(created).toBe(1); expect(disposed).toBe(1); expect(host.inspect().scopes).toEqual([]); expect(host.inspect().providers).toEqual([]);
});

test("a failed shared generation unwinds partial initialization and a later acquisition can retry", async () => {
  await using host = createHost(); let attempts = 0, cleaned = 0;
  host.provide(cap, { async create({ resources }) { const attempt = ++attempts; resources.defer(() => { cleaned++; }); await Promise.resolve(); if (attempt === 1) throw new Error("first generation failed"); return { next: () => 7 }; } }, { lifetime: "shared" });
  const owner = host.scope(); const results = await Promise.allSettled([owner.acquire(cap), owner.acquire(cap)]);
  expect(results.map(result => result.status)).toEqual(["rejected", "rejected"]); expect(attempts).toBe(1); expect(cleaned).toBe(1);
  const success = await owner.acquire(cap); expect(success.value.next()).toBe(7); await owner.revoke(); expect(cleaned).toBe(2);
});

test("reflection copies and deeply freezes metadata even for structurally constructed capabilities", async () => {
  await using host = createHost();
  const methods = [{ name: "next", input: { type: "number" as const }, output: { type: "number" as const }, effects: [{ operation: "read", resource: "original" }] }];
  host.define({ ...cap, methods }); const snapshot = host.inspect(); methods[0]!.effects[0]!.resource = "changed";
  expect(snapshot.definitions[0]!.methods![0]!.effects[0]!.resource).toBe("original");
  expect(Object.isFrozen(snapshot.definitions[0]!.methods![0]!.effects[0])).toBe(true);
});

test("failed initialization cleanup is attempted once and reported once by direct release", async () => {
  const host = createHost(); let disposed = 0;
  host.provide(cap, { create({ resources }) { resources.defer(() => { disposed++; throw new Error("partial cleanup failed"); }); throw new Error("start failed"); } });
  const failed = await host.scope().acquire(cap).catch(error => error);
  expect(disposed).toBe(1); expect(failed).toBeInstanceOf(AggregateError);
  expect(failed.errors).toHaveLength(2);
  expect(failed.errors[0].message).toBe("start failed");
  expect(failed.errors[1].errors).toHaveLength(1);
  await host.dispose();
});

test("invalid explicitly named JS requests never fall back to the default provider", async () => {
  await using host = createHost(); const owner = host.scope(); const provider = { create: () => ({ next: () => 1 }) };
  host.provide(cap, provider);
  for (const name of [null, "", 1, {}]) {
    await expect(owner.acquire(cap, { serviceId: name as string })).rejects.toThrow("Invalid service identity");
    expect(() => owner.bind(cap, name as string)).toThrow("Invalid service identity");
    expect(() => host.provide(cap, provider, { serviceId: name as string })).toThrow("Invalid service identity");
  }
  const scopesBefore = host.inspect().scopes.length;
  await expect(host.start(cap, provider, { serviceId: undefined as unknown as string })).rejects.toThrow("Invalid service identity");
  expect(host.inspect().scopes.length).toBe(scopesBefore);
});
