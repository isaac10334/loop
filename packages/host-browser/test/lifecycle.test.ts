import { test, expect } from "bun:test";
import { browser, bootstrapBrowser } from "../src/index.js";
import { RecordingSurface } from "@loop-kit/ui";
import type { ResolvedHostPlan, Host } from "@loop-kit/host";
const renderer = { kind: "renderer", host: "application", id: "loop:renderer/dom", version: "0.1.0", surfaceProfile: { id: "loop:surface/semantic", version: "0.1.0" } } as const;
function fixture() {
  const kit = browser();
  return { schemaVersion: 1, protocolVersion: 1, planId: "test", features: [], targetId: "web", kind: "browser", kit: kit.identity, profile: kit.profile, coordinator: { ...kit.coordinator, sha256: "test" }, kitOptions: kit.options, hosts: kit.hosts, toolchain: [], inputs: { sourceSnapshotDigest: "test", configDigest: "test", lockDigests: [], modules: [] }, plugins: [{ key: "dom", identity: { id: "loop:renderer/dom", version: "0.1.0" }, hooks: [], contributions: [{ key: "dom/renderer", host: "application", requires: [], provides: [renderer], entry: { specifier: "renderer", export: "setup", sha256: "test" }, options: {} }] }], application: { specifier: "app", export: "start", sha256: "test" }, dependencyEdges: [], buildRecipes: [], descriptors: {}, cache: "disabled", provenance: {} } satisfies ResolvedHostPlan;
}
const renderModule = (surface: RecordingSurface) => ({ setup(ctx: { ports: { registerRenderer: (key: typeof renderer, factory: () => RecordingSurface) => void } }) { ctx.ports.registerRenderer(renderer, () => surface); } });
test("kit options are independent bounded data", () => {
  const a = browser(), b = browser(); expect(a).not.toBe(b); expect(a.options).not.toBe(b.options);
  expect(() => browser({ listen: { hostname: "127.0.0.1", port: -1 } })).toThrow();
  expect(() => browser({ profile: "unknown" as never })).toThrow();
});
test("abort resolves surface reads before application scope task joins, independent launch survives", async () => {
  const surfaceA = new RecordingSurface(), surfaceB = new RecordingSurface(); let done = false;
  const modules = (surface: RecordingSurface) => ({ renderer: renderModule(surface), app: { start(ctx: { scope: import("@loop-kit/host").Scope; surface: RecordingSurface }) { const task = ctx.scope.task(async () => { await ctx.surface.nextEvent(); done = true; }); void task.result.catch(() => {}); } } });
  const a = await bootstrapBrowser({ plan: fixture(), modules: modules(surfaceA) });
  const b = await bootstrapBrowser({ plan: fixture(), modules: modules(surfaceB) });
  const stopping = a.dispose(); expect(surfaceA.nextEvent()).resolves.toBeUndefined(); await stopping; expect(done).toBe(true);
  expect(b.host.inspect().state).toBe("active"); await b.dispose(); expect(a.dispose()).toBe(stopping);
});
test("external kit can explicitly delegate the reviewed public browser bootstrap profile", async () => {
  const base = fixture(), surface = new RecordingSurface();
  const runtime = await bootstrapBrowser({ plan: { ...base, kit: { id: "example:kit/custom-browser", version: "2.0.0" } }, modules: { renderer: renderModule(surface), app: { start() {} } } });
  expect(runtime.host.inspect().state).toBe("active"); await runtime.dispose();
});
test("partial setup aborts pending registration activation before scope creation join", async () => {
  const controller = new AbortController(); let captured: Host | undefined, began!: () => void;
  const started = new Promise<void>(r => { began = r; });
  const plan = fixture();
  const capability = { id: "test:slow", version: "1" };
  plan.plugins[0]!.contributions[0]!.provides = [{ kind: "provider", host: "application", ...capability }] as never;
  const launch = bootstrapBrowser({ plan, signal: controller.signal, modules: { renderer: { async setup(ctx: { host: Host; scope: import("@loop-kit/host").Scope }) {
    captured = ctx.host;
    const registration = ctx.host.provide(capability, { activate: async ({ signal }) => { began(); await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true })); }, create: () => ({}) });
    ctx.scope.defer(() => registration.unregister());
    const pending = ctx.scope.task(async () => { await ctx.scope.acquire(capability); }); void pending.result.catch(() => {});
    await registration.activate();
  } } } });
  await started; controller.abort(new Error("stop during activate")); await expect(launch).rejects.toThrow();
  expect(captured?.inspect().state).toBe("disposed");
});
test("same-key same-version provider replacement cannot hide in setup receipts", async () => {
  const base = fixture(), cap = { id: "test:provider", version: "opaque" };
  let previous: ReturnType<Host["provide"]>;
  const first = { ...base.plugins[0]!.contributions[0]!, provides: [renderer, { kind: "provider" as const, host: "application", ...cap }], entry: { specifier: "first", export: "setup", sha256: "test" } };
  const second = { ...first, key: "rogue", provides: [], entry: { specifier: "rogue", export: "setup", sha256: "test" } };
  const plan: ResolvedHostPlan = { ...base, plugins: [{ ...base.plugins[0]!, contributions: [first, second] }] };
  const surface = new RecordingSurface();
  await expect(bootstrapBrowser({ plan, modules: {
    first: { setup(ctx: { host: Host; scope: import("@loop-kit/host").Scope; ports: Parameters<ReturnType<typeof renderModule>["setup"]>[0]["ports"] }) { previous = ctx.host.provide(cap, { create: () => ({}) }); ctx.scope.defer(() => previous.unregister()); renderModule(surface).setup(ctx); } },
    rogue: { async setup(ctx: { host: Host; scope: import("@loop-kit/host").Scope }) { await previous.unregister(); const replacement = ctx.host.provide(cap, { create: () => ({}) }); ctx.scope.defer(() => replacement.unregister()); } },
  } })).rejects.toThrow("removed/replaced");
});
test("partial failure aggregates cleanup and never runs application", async () => {
  let ran = false, cleaned = false;
  const launch = bootstrapBrowser({ plan: fixture(), modules: { renderer: { setup(ctx: { scope: import("@loop-kit/host").Scope }) { ctx.scope.defer(() => { cleaned = true; throw new Error("cleanup"); }); throw new Error("setup"); } }, app: { start() { ran = true; } } } });
  await expect(launch).rejects.toBeInstanceOf(AggregateError); expect(cleaned).toBe(true); expect(ran).toBe(false);
});
