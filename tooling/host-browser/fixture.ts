/** Actual browser acceptance fixture; all adapters consumed through public package roots. */
import { browser, bootstrapBrowser, type BrowserRuntime } from "@loop-kit/host-browser";
import { semanticDom, setup, createDomSurface } from "@loop-kit/renderer-dom";
import { h, type Surface } from "@loop-kit/ui";
import { createDocumentOwner, createPolyengineSession, type PolyengineSession, type ComponentArtifact } from "@loop-kit/component-polyengine";
import type { ResolvedHostPlan } from "@loop-kit/host";
const api = globalThis as unknown as { acceptance: Record<string, unknown> };
let runtime: BrowserRuntime;
const assert = (v: unknown, text: string) => { if (!v) throw new Error(text); };
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
let count = 0;
function plan(): ResolvedHostPlan {
  const kit = browser(), plugin = semanticDom({ key: "dom", root: "#app" });
  const ref = (specifier: string, name: string) => ({ specifier, export: name, sha256: "0".repeat(64) });
  return { schemaVersion: 1, protocolVersion: 1, planId: "fixture", features: [], targetId: "web", kind: "browser", kit: kit.identity, profile: kit.profile, coordinator: ref(kit.coordinator.specifier, kit.coordinator.export), kitOptions: kit.options, hosts: kit.hosts, toolchain: [], inputs: { sourceSnapshotDigest: "fixture", configDigest: "fixture", lockDigests: [], modules: [] }, plugins: [{ key: plugin.key, identity: plugin.identity, hooks: [], contributions: plugin.runtime.map(c => ({ ...c, entry: ref(c.entry.specifier, c.entry.export) })) }], application: ref("application", "start"), dependencyEdges: [], buildRecipes: [], descriptors: {}, cache: "disabled", provenance: {} };
}
async function boot() {
  runtime = await bootstrapBrowser({ plan: plan(), modules: {
    "@loop-kit/renderer-dom": { setup },
    application: { async start(ctx: { surface: Surface; scope: BrowserRuntime["scope"]; signal: AbortSignal }) {
      let revision = 0;
      const render = () => ctx.surface.render({ revision, root: h("column", { key: "root" }, h("text", { key: "count", text: String(count) }), h("button", { key: "increment", label: "Increment", text: "Increment" })) });
      await render();
      const task = ctx.scope.task(async () => { while (!ctx.signal.aborted) { const e = await ctx.surface.nextEvent(); if (!e || ctx.signal.aborted) return; count++; revision++; await render(); } });
      void task.result.catch(e => { if (!ctx.signal.aborted) console.error(e); });
    } },
  } });
  return true;
}
async function domChecks() {
  const root = document.querySelector<HTMLElement>("#dom-checks")!, surface = createDomSurface({ root });
  await surface.render({ revision: 0, root: h("button", { key: "go", label: "Go", text: "<img src=x onerror=alert(1)>" }) });
  assert(root.querySelectorAll("img").length === 0, "HTML escaped");
  const old = root.querySelector<HTMLButtonElement>("button")!;
  const errors: string[] = [];
  const denied = (e: Parameters<typeof surface.event>[0]) => { try { surface.event(e); errors.push("accepted"); } catch { errors.push("denied"); } };
  surface.event({ revision: 0, sequence: 1, key: "go", type: "activate" }); await surface.nextEvent();
  denied({ revision: 0, sequence: 1, key: "go", type: "activate" }); denied({ revision: 8, sequence: 2, key: "go", type: "activate" }); denied({ revision: 0, sequence: 2, key: "unknown", type: "activate" });
  old.focus();
  await surface.render({ revision: 1, root: h("button", { key: "go", label: "Go", text: "Go" }) });
  assert(document.activeElement === root.querySelector("button"), "focus restored by key");
  old.click(); // Detached listener must no longer have effects.
  await surface.render({ revision: 2, root: h("button", { key: "go", label: "Go", text: "Go", disabled: true }) });
  denied({ revision: 2, sequence: 2, key: "go", type: "activate" });
  const waiting = surface.nextEvent(); surface.dispose(); assert(await waiting === undefined, "pending read closed");
  denied({ revision: 2, sequence: 3, key: "go", type: "activate" });
  assert(errors.every(x => x === "denied"), "all invalid events denied");
  const cleanup = surface.inspect(); assert(cleanup.listeners === 0 && cleanup.pendingEventReads === 0 && cleanup.pendingFrames === 0, "DOM ownership counters drained");
  return { escapedHtml: true, focusRestored: true, invalidEventsDenied: errors.length, pendingReadClosed: true, nextFrame: true, cleanup };
}
async function inputs() {
  const artifacts = await (await fetch("./components.json")).json();
  return artifacts as Record<string, { artifact: ComponentArtifact; bytes: string; translation: { plan: unknown; adapters: [string, number[]][] } }>;
}
const decode = (base64: string) => Uint8Array.from(atob(base64), c => c.charCodeAt(0));
async function componentChecks() {
  const data = await inputs(), events: string[] = [], sessions: PolyengineSession[] = [];
  const owners: ReturnType<typeof createDocumentOwner>[] = [];
  const makeOwner = (source = "hello world") => { const owner = createDocumentOwner({ source, authorize: p => p === "author", beforeOperation: async operation => { events.push(`${operation}-enter`); await sleep(35); events.push(`${operation}-resume`); } }); owners.push(owner); return owner; };
  const owner = makeOwner(), grant = owner.issue({ principal: "author", read: true, write: true });
  const make = async (name: string, o = owner, g = grant, surface?: Surface, callTimeoutMs = 5000, signal?: AbortSignal) => {
    const input = data[name]!;
    const session = await createPolyengineSession({ workerUrl: new URL("./worker.js", location.href), componentBytes: decode(input.bytes), translation: { plan: input.translation.plan, adapters: new Map(input.translation.adapters.map(([k,v]) => [k, new Uint8Array(v)])) } as never, artifact: input.artifact, document: { owner: o, grant: g }, surface, callTimeoutMs, signal }); sessions.push(session); return session;
  };
  try {
    const a = await make("document");
    let settled = false; const call = a.replaceText("hello", "browser").finally(() => { settled = true; });
    await sleep(15); assert(!settled && events[0] === "read-enter", "genuine async nominal document read");
    const result = await call; assert(owner.snapshot.source === "browser world", "document CAS committed");
    const changedOwner = makeOwner(), changedGrant = changedOwner.issue({ principal: "author", read: true, write: true }), changed = await make("changed", changedOwner, changedGrant);
    const changedResult = await changed.replaceText("hello", "changed");
    assert(changedResult === "fresh-v2;revision=1;source=changed world" && data.changed!.artifact.sha256 !== data.document!.artifact.sha256, "changed source bytes change guest-produced output");
    const viewerOwner = makeOwner(), viewer = viewerOwner.issue({ principal: "author", read: true, write: false }), v = await make("document", viewerOwner, viewer);
    let denied = false; try { await v.replaceText("hello", "bad"); } catch (e) { denied = (e as { failure?: { kind: string } }).failure?.kind === "denied"; } assert(denied && viewerOwner.snapshot.revision === "0", "viewer denied");
    const deniedIngress: string[] = [];
    for (const mode of ["wrong-principal", "forged", "foreign-owner"]) {
      const o = makeOwner(), foreign = makeOwner();
      const g = mode === "forged" ? {} as typeof grant : (mode === "foreign-owner" ? foreign : o).issue({ principal: mode === "wrong-principal" ? "other" : "author", read: true, write: true });
      const s = await make("document", o, g); let failed = false;
      try { await s.replaceText("hello", "forbidden"); } catch (e) { failed = (e as { failure?: { kind: string } }).failure?.kind === "denied"; }
      assert(failed && o.snapshot.revision === "0", `${mode} nominal ingress denied`); deniedIngress.push(mode);
    }
    const cancellationSchedules: { phase: string; revision: string }[] = [];
    for (const [phase, delay, revoke] of [["cancel-before-read", 10, false], ["cancel-during-write", 50, false], ["revoke-during-write", 50, true], ["cancel-after-commit", 120, false]] as const) {
      const o = makeOwner(), g = o.issue({ principal: "author", read: true, write: true }), controller = new AbortController(), s = await make("document", o, g, undefined, 5000, controller.signal);
      const result = s.replaceText("hello", "race").then(value => ({ value }), error => ({ error }));
      const timer = sleep(delay).then(() => { if (revoke) o.revoke(g); else controller.abort(new Error(phase)); });
      const [out] = await Promise.all([result, timer]); await s.dispose();
      assert(o.snapshot.revision === (delay < 100 ? "0" : "1"), `${phase} linearization`);
      assert(delay < 100 ? "error" in out : "value" in out, `${phase} result preserved`);
      cancellationSchedules.push({ phase, revision: o.snapshot.revision });
    }
    owner.advanceGeneration(); let revoked = false; try { await a.replaceText("browser", "bad"); } catch (e) { revoked = (e as { failure?: { kind: string } }).failure?.kind === "revoked"; } assert(revoked, "generation denied");
    const raceOwner = makeOwner(), rg = raceOwner.issue({ principal: "author", read: true, write: true }), r1 = await make("document", raceOwner, rg), r2 = await make("document", raceOwner, rg);
    const race = await Promise.allSettled([r1.replaceText("hello", "A"), r2.replaceText("hello", "B")]); assert(race.filter(r => r.status === "fulfilled").length === 1 && raceOwner.snapshot.revision === "1", "one CAS winner");
    const workerBoundaryBudgets: { mode: string; error: string; revision: string; pending: number }[] = [];
    for (const mode of ["oversize-default", "invalid-at-budget", "oversized-result"]) {
      const o = makeOwner(), g = o.issue({ principal: "author", read: true, write: true }), s = await make("budget", o, g);
      let error = ""; try { await s.replaceText(mode, "ignored"); } catch (e) { error = String(e); }
      await s.dispose(); assert(error && o.snapshot.revision === "0" && s.inspect().workers === 0, "malformed/oversized result cannot cross worker boundary or mutate");
      workerBoundaryBudgets.push({ mode, error, revision: o.snapshot.revision, pending: s.inspect().pendingHostCalls });
    }
    const OriginalWorker = globalThis.Worker; let invalidRevisionHostFrames = 0;
    class ObservedWorker extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); this.addEventListener("message", event => { if (event.data?.type === "host" && event.data.operation === "write") invalidRevisionHostFrames++; }); }
    }
    const invalidRevisionResults: Record<string, string> = {};
    try {
      globalThis.Worker = ObservedWorker;
      for (const mode of ["overlong-revision", "overlong-utf8-revision"]) {
        const o = makeOwner(), g = o.issue({ principal: "author", read: true, write: true }), s = await make("budget", o, g);
        invalidRevisionResults[mode] = await s.replaceText(mode, "ignored"); await s.dispose();
        assert(invalidRevisionResults[mode] === "revision-rejected" && invalidRevisionHostFrames === 0 && o.snapshot.revision === "0", "decoded invalid revision rejected before host message");
      }
    } finally { globalThis.Worker = OriginalWorker; }
    const fullSource = "x".repeat(1048576), fullOwner = makeOwner(fullSource), fullGrant = fullOwner.issue({ principal: "author", read: true, write: true }), fullSession = await make("document", fullOwner, fullGrant);
    const fullResult = await fullSession.replaceText("x", "x"), fullResultBytes = new TextEncoder().encode(fullResult).byteLength;
    assert(fullOwner.snapshot.revision === "1" && fullOwner.snapshot.source === fullSource && fullResultBytes > 1048576 && fullResultBytes <= 1048832, "full-size committed source returns bounded metadata output");
    await fullSession.dispose();
    const escapedSource = "\n".repeat(530000), conflictOwner = makeOwner(escapedSource), conflictGrant = conflictOwner.issue({ principal: "author", read: true, write: true });
    const staleOwner = { ...conflictOwner, write: (grant: typeof conflictGrant, _revision: string, source: string, signal: AbortSignal) => conflictOwner.write(grant, "stale", source, signal) };
    const conflictSession = await make("document", staleOwner, conflictGrant); let escapedConflict: unknown;
    try { await conflictSession.replaceText("absent", "unchanged"); } catch (error) { escapedConflict = error; }
    const failure = (escapedConflict as { failure?: { kind?: string; value?: { source?: string } } })?.failure;
    const escapedJsonBytes = new TextEncoder().encode(JSON.stringify({ kind: "conflict", value: { revision: "0", source: escapedSource } })).byteLength;
    assert(escapedJsonBytes > 1049088 && failure?.kind === "conflict" && failure.value?.source === escapedSource && conflictOwner.snapshot.revision === "0" && !conflictSession.inspect().closed, "bounded escaped conflict survives structured-clone transport");
    await conflictSession.dispose();
    const runawayOwner = makeOwner(), runawayGrant = runawayOwner.issue({ principal: "author", read: true, write: true }), runaway = await make("runaway", runawayOwner, runawayGrant, undefined, 250);
    const start = performance.now(); let terminated = false; try { await runaway.replaceText("hello", "never"); } catch { terminated = true; }
    const forcedStopMs = performance.now() - start; assert(terminated && forcedStopMs < 1500, "bounded forced worker termination");
    const bOwner = makeOwner(), bg = bOwner.issue({ principal: "author", read: true, write: true }), b = await make("document", bOwner, bg);
    await b.replaceText("hello", "survives"); assert(bOwner.snapshot.source === "survives world", "B independent after A runaway");
    await Promise.all(sessions.map(s => s.dispose())); owners.forEach(o => o.dispose());
    const cleanup = { workers: sessions.reduce((n,s) => n + s.inspect().workers, 0), pendingGuestCalls: sessions.reduce((n,s) => n + s.inspect().pendingGuestCalls, 0), pendingHostCalls: sessions.reduce((n,s) => n + s.inspect().pendingHostCalls, 0), liveGrants: owners.reduce((n,o) => n + o.inspect().liveGrants, 0), pendingOperations: owners.reduce((n,o) => n + o.inspect().pendingOperations, 0) };
    assert(Object.values(cleanup).every(n => n === 0), "Worker/document counters drained");
    return { componentSha256: data.document!.artifact.sha256, changedSha256: data.changed!.artifact.sha256, changedResult, result, events, genuineAsync: true, viewerDenied: denied, deniedIngress, cancellationSchedules, generationDenied: revoked, casOneWinner: true, workerBoundaryBudgets, invalidRevisionResults, invalidRevisionHostFrames, fullResultBytes, escapedJsonBytes, escapedConflictKind: failure?.kind, forcedStopMs, isolationB: bOwner.snapshot.source, cleanup };
  } finally { await Promise.all(sessions.map(s => s.dispose())); owners.forEach(o => o.dispose()); }
}
let semanticSession: PolyengineSession | undefined, semanticResult: Promise<string>;
let semanticSurface: ReturnType<typeof createDomSurface>, semanticOwner: ReturnType<typeof createDocumentOwner>;
async function semanticStart() {
  const input = (await inputs()).semantic!, root = document.querySelector<HTMLElement>("#semantic")!;
  const owner = createDocumentOwner({ source: "hello world", authorize: p => p === "author", beforeOperation: async () => sleep(35) }), grant = owner.issue({ principal: "author", read: true, write: true });
  semanticOwner = owner; semanticSurface = createDomSurface({ root });
  semanticSession = await createPolyengineSession({ workerUrl: new URL("./worker.js", location.href), componentBytes: decode(input.bytes), translation: { plan: input.translation.plan, adapters: new Map(input.translation.adapters.map(([k,v]) => [k, new Uint8Array(v)])) } as never, artifact: input.artifact, document: { owner, grant }, surface: semanticSurface });
  semanticResult = semanticSession.run(); return { sha256: input.artifact.sha256 };
}
async function semanticFinish() { const result = await semanticResult; const text = document.querySelector("#semantic")?.textContent; assert(text === "semantic world", "semantic next frame"); await semanticSession!.dispose(); semanticOwner.dispose(); const cleanup = { session: semanticSession!.inspect(), surface: semanticSurface.inspect(), document: semanticOwner.inspect() }; assert(cleanup.session.workers === 0 && cleanup.session.pendingHostCalls === 0 && cleanup.surface.listeners === 0 && cleanup.surface.pendingEventReads === 0 && cleanup.document.liveGrants === 0, "Semantic counters drained"); return { result, text, cleanup }; }
async function engineConformance() {
  const data = await inputs(), worker = new Worker(new URL("./conformance-worker.js", location.href), { type: "module" });
  let timer: ReturnType<typeof setTimeout>;
  try { return await new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error("Test-only engine conformance timed out")), 5000); worker.onerror = e => { e.preventDefault(); reject(new Error(e.message)); }; worker.onmessage = e => e.data.fatal ? reject(new Error(e.data.fatal)) : resolve(e.data.results); worker.postMessage({ lifecycle: data.lifecycle, budget: data.budget }); }); }
  finally { clearTimeout(timer!); worker.terminate(); }
}
api.acceptance = { engineConformance, boot, count: () => count, stop: async () => { await runtime.dispose(); const snapshot = runtime.host.inspect(); return { state: snapshot.state, scopes: snapshot.scopes.length, providers: snapshot.providers.length, services: snapshot.services.length }; }, domChecks, componentChecks, semanticStart, semanticFinish };
