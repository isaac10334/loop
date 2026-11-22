/** Browser host-kit composition. Trusted modules execute only in a fresh per-launch host. */
import { createHost, type HostKit, type Host, type Scope, type ResolvedHostPlan, type Json, type RegistrationKey } from "@loop-kit/host";
import type { Surface } from "@loop-kit/ui";
export { createGpuSession } from "./gpu.js";
export type { GpuAdapterResource, GpuBufferResource, GpuCanvasResource, GpuDeviceResource, GpuPlatform, GpuSession } from "./gpu.js";

export interface BrowserAsset {
  /** Project-relative regular file, captured and pinned by the CLI evaluator. */
  readonly source: string;
  /** Portable output basename used to serve this exact asset. */
  readonly path: string;
  /** Lowercase SHA-256 of the source bytes. */
  readonly sha256: string;
}
export interface BrowserOptions {
  readonly profile?: "loop:profile/browser-ts@0.1.0" | "loop:profile/browser-components@0.1.0";
  readonly listen?: { readonly hostname: "127.0.0.1"; readonly port: number };
  /** Exact project-local assets copied into static and development browser output. */
  readonly assets?: readonly BrowserAsset[];
}
/** Data-only kit use; the CLI owns endpoint reservation/bundling, not this browser runtime. */
export function browser(options: BrowserOptions = {}): HostKit<"browser"> {
  if (Object.keys(options).some(key => !["profile", "listen", "assets"].includes(key))) throw new TypeError("Unknown browser option");
  const selected = options.profile ?? "loop:profile/browser-ts@0.1.0";
  if (!["loop:profile/browser-ts@0.1.0", "loop:profile/browser-components@0.1.0"].includes(selected)) throw new TypeError("Unsupported browser profile");
  const listen = options.listen ?? { hostname: "127.0.0.1", port: 0 };
  if (listen.hostname !== "127.0.0.1" || !Number.isInteger(listen.port) || listen.port < 0 || listen.port > 65535 || Object.keys(listen).some(k => !["hostname", "port"].includes(k))) throw new TypeError("Expected loopback endpoint and port 0..65535");
  const assets = validateBrowserAssets(options.assets ?? []);
  const profile = { id: selected.slice(0, selected.lastIndexOf("@")), version: "0.1.0" };
  return { apiVersion: 1, identity: { id: "loop:kit/browser", version: "0.1.0" }, kind: "browser", profile, options: { listen: { ...listen }, ...(assets.length ? { assets: assets.map(asset => ({ source: asset.source, path: asset.path, sha256: asset.sha256 })) } : {}) } as Json, hosts: [{ key: "coordinator", realm: "coordinator", profile }, { key: "application", realm: "application", profile }, ...(selected.includes("components") ? [{ key: "guest", realm: "guest-worker" as const, profile }] : [])], coordinator: { specifier: "@loop-kit/host-browser", export: "bootstrapBrowser" }, plugins: [] };
}
const reservedAssetPaths = new Set(["index.html", "app.js", "component-worker.js", "build-receipt.json"]);
/** Validate and detach declared asset metadata; byte pinning is performed by the CLI. */
function validateBrowserAssets(input: readonly BrowserAsset[]): BrowserAsset[] {
  if (!Array.isArray(input) || input.length > 16) throw new TypeError("Browser kit accepts at most 16 assets");
  const seen = new Set<string>();
  return input.map((asset, index) => {
    if (!asset || typeof asset !== "object" || Object.getPrototypeOf(asset) !== Object.prototype || Object.keys(asset).some(key => !["source", "path", "sha256"].includes(key)) || Object.keys(asset).length !== 3 || Object.keys(asset).some(key => Object.getOwnPropertyDescriptor(asset, key)?.get || Object.getOwnPropertyDescriptor(asset, key)?.set)) throw new TypeError(`Invalid browser asset ${index}`);
    const { source, path, sha256 } = asset;
    if (typeof source !== "string" || !source || source.startsWith("/") || source.includes("\\") || source.includes(":") || source.includes("\0") || source.split("/").some(part => !part || part === "." || part === "..") || /^[a-zA-Z]:/.test(source)) throw new TypeError(`Invalid browser asset source ${index}`);
    if (typeof path !== "string" || path.length > 120 || !/^[a-z][a-z0-9.-]*$/.test(path) || reservedAssetPaths.has(path) || path.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(path)) throw new TypeError(`Invalid browser asset path ${index}`);
    if (seen.has(path)) throw new TypeError(`Duplicate browser asset path ${path}`);
    seen.add(path);
    if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError(`Invalid browser asset SHA-256 ${index}`);
    return { source, path, sha256 };
  });
}
export interface BrowserApplicationContext { readonly host: Host; readonly scope: Scope; readonly surface: Surface; readonly signal: AbortSignal; readonly workerUrl?: string }
export interface BrowserRuntime extends BrowserApplicationContext { /** Idempotent; synchronously aborts registration activation and pending event reads before any task join. */ dispose(reason?: unknown): Promise<void> }
export interface BrowserBootstrapOptions {
  readonly plan: ResolvedHostPlan;
  /** Bundler-generated static public-root imports; never import the config into the browser. */
  readonly modules: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly root?: HTMLElement;
  readonly workerUrl?: string;
  readonly signal?: AbortSignal;
}
/** Compose providers/renderers, then call start with the already-owned host/scope/surface.
 * Failure unwinds the partially initialized host before awaiting scope tasks. Trusted code can
 * ignore cooperative cancellation; guest hard termination belongs to its dedicated worker.
 */
export async function bootstrapBrowser(options: BrowserBootstrapOptions): Promise<BrowserRuntime> {
  const { plan, modules } = options;
  if (plan.kind !== "browser" || !["loop:profile/browser-ts", "loop:profile/browser-components"].includes(plan.profile.id) || plan.profile.version !== "0.1.0") throw new TypeError("Incompatible browser plan");
  if (plan.hosts.filter(h => h.key === "application" && h.realm === "application").length !== 1) throw new TypeError("Missing application host");
  const controller = new AbortController(), host = createHost(), scope = host.scope({ name: "Browser application" });
  const pluginScopes: Scope[] = [];
  let surface: Surface | undefined, completion: Promise<void> | undefined;
  let renderer: ((signal: AbortSignal) => Surface) | undefined;
  const abort = () => { void dispose(options.signal?.reason).catch(() => {}); };
  function dispose(reason?: unknown): Promise<void> {
    if (completion) return completion;
    // Cache before dispatch; listeners may reenter disposal.
    let resolve!: () => void, reject!: (e: unknown) => void;
    completion = new Promise<void>((a, b) => { resolve = a; reject = b; });
    controller.abort(reason);
    const errors: unknown[] = [];
    try { surface?.dispose(); } catch (e) { errors.push(e); }
    // Critical: host.dispose aborts *registration* activation before joining task/scopes.
    const disposing = host.dispose(reason);
    void (async () => {
      try { await disposing; } catch (e) { errors.push(e); }
      options.signal?.removeEventListener("abort", abort);
      if (errors.length) reject(new AggregateError(errors, "Browser disposal failed")); else resolve();
    })();
    return completion;
  }
  options.signal?.addEventListener("abort", abort, { once: true });
  const assertActive = () => { if (controller.signal.aborted) throw controller.signal.reason ?? new Error("Browser launch cancelled"); };
  function entry(specifier: string, name: string): (ctx: unknown) => unknown {
    const value = modules[specifier]?.[name];
    if (typeof value !== "function") throw new TypeError(`Missing public runtime export ${specifier}:${name}`);
    return value as (ctx: unknown) => unknown;
  }
  try {
    if (options.signal?.aborted) { abort(); assertActive(); }
    for (const plugin of plan.plugins) for (const contribution of plugin.contributions) {
      assertActive();
      if (contribution.host !== "application") throw new TypeError("Browser static runtime rejects coordinator/undeclared remote providers");
      const child = scope.scope({ name: `${plugin.key}/${contribution.key}` }); pluginScopes.push(child);
      const before = host.inspect();
      const rendered: RegistrationKey[] = [];
      await entry(contribution.entry.specifier, contribution.entry.export)({ host, scope: child, signal: controller.signal, options: contribution.options, ports: {
        document: options.root?.ownerDocument ?? globalThis.document,
        workerUrl: options.workerUrl,
        registerRenderer(key: { id: string; version: string; surfaceProfile: { id: string; version: string } }, create: (signal: AbortSignal) => Surface) {
          assertActive(); if (renderer) throw new Error("Duplicate semantic surface renderer");
          rendered.push({ kind: "renderer", host: "application", ...key }); renderer = create;
        },
      } });
      assertActive();
      const after = host.inspect();
      const providerKey = (r: { capabilityId: string; serviceId?: string }) => JSON.stringify([r.capabilityId, r.serviceId ?? null]);
      const previous = new Set(before.providers.map(providerKey));
      const remaining = new Map(after.providers.map(r => [providerKey(r), r]));
      if (before.providers.some(r => remaining.get(providerKey(r))?.registrationId !== r.registrationId || remaining.get(providerKey(r))?.version !== r.version || remaining.get(providerKey(r))?.state !== r.state)) throw new Error(`Runtime contribution removed/replaced an existing provider: ${plugin.key}/${contribution.key}`);
      const added: RegistrationKey[] = after.providers.filter(r => !previous.has(providerKey(r))).map(r => ({ kind: "provider", host: "application", id: r.capabilityId, version: r.version, ...(r.serviceId === undefined ? {} : { serviceId: r.serviceId }) }));
      const key = (r: RegistrationKey) => JSON.stringify(r.kind === "provider" ? [r.kind, r.host, r.id, r.version, r.serviceId ?? null] : r.kind === "renderer" ? [r.kind, r.host, r.id, r.version, r.surfaceProfile.id, r.surfaceProfile.version] : [r.kind, r.host, r.id, r.version, r.phase]);
      const actual = [...added, ...rendered].map(key).sort();
      if (JSON.stringify(actual) !== JSON.stringify(contribution.provides.map(key).sort())) throw new Error(`Runtime registration receipt mismatch: ${plugin.key}/${contribution.key}`);
    }
    if (!renderer) throw new Error("Browser requires an explicit semantic renderer contribution");
    surface = renderer(controller.signal);
    // Owner listener precedes application task creation. Scope abort alone also closes event reads.
    const close = () => surface?.dispose(); scope.signal.addEventListener("abort", close, { once: true });
    scope.defer(() => { scope.signal.removeEventListener("abort", close); surface?.dispose(); });
    assertActive();
    const context = { host, scope, surface, signal: controller.signal, ...(options.workerUrl ? { workerUrl: options.workerUrl } : {}) };
    await entry(plan.application.specifier, plan.application.export)(context);
    assertActive();
    return { ...context, dispose };
  } catch (primary) {
    try { await dispose(primary); } catch (cleanup) { throw new AggregateError([primary, cleanup], "Browser start and cleanup failed"); }
    throw primary;
  }
}
