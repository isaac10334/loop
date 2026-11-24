# CLI host kits

Status: **proposed contract HK1**, November 3, 2026. No API, command, package or
schema introduced below exists until its implementation tests pass. This run owns
design and disposable probes, not production migration. The observable outcome is:
**create two independently owned hosts from typed configuration, start either by
explicit target, and stop/restart one without affecting the other's resources.**

[Audit and runtime evidence](../docs/development-alpha/host-kits-evidence.md) records
the dirty baselines, source references and limits. [Examples](host-kits-examples.md)
contain proposed help and two complete source projects. The existing
[execution plan](../docs/development-alpha/execution-plan.md#host-kit-implementation-lane)
own sequencing. [Architecture](../ARCHITECTURE.md) describes implemented software.

## 1. Vocabulary and selected initial integrations

| Term | Contract |
| --- | --- |
| Host | One runtime composition and ownership root, not a process-global service locator. A target can contain separate trusted realms and guest instances. |
| Host kit | Versioned trusted runtime integration plus supported target profiles, bootstrap, run/build/inspect/stop adapters and compatibility checks. A kit supplies runtime composition before application entry. |
| Host plugin | Trusted factory contribution within a kit: providers, renderer adapters or lifecycle hooks. Configuration or package installation does not grant it guest-like isolation. |
| Template | Source scaffolding copied at create time. Editing/removing a template cannot change an existing application's runtime integration. |
| Target | Explicit config-local name selecting one kit/profile/application entry. |
| Instance | One launch of a target, with unique epoch, ownership tree, endpoint reservations and profile lease. Target name and persisted product identity remain distinct. |
| Guest Component | Verified Component Model bytes instantiated with only reviewed/granted imports. A host plugin and a guest have different trust profiles. |

**November 7 selected scope: two official kits only.** Build our own Rust desktop
host around Wasmtime and Tao/Wry, plus the browser kit. Rust owns desktop lifecycle,
presentation and Component execution; typed TS/Bun config/tooling and explicitly
selected ordinary TS provider bridges remain supported. Reuse maintained Rust
libraries rather than an application framework. Preserve existing Rust application
WIT/templates/releases while making execution reusable through public ports.

Electrobun is **not** an official kit, required exemplar, dependency or release gate.
The earlier November 4 required-exemplar direction is superseded. Keep optional
cross-language/ecosystem demonstrations under isolated compatibility examples;
Electrobun may be one such example if cheap, never the reason for core abstractions,
SDK preparation, extra services, forks or patches. No default starter, official
manifest/build or portable resolver may depend on it or Hutch. Skip/defer examples
that require substantial integration work; that does not make the official mission
partial. Preserve host application's independent Electrobun application and saved behavior.

The [version-pinned desktop investigation](../docs/reference/desktop-hosts.md)
retains useful compatibility evidence, including the npm shim/projected SDK and
native Rust updater limitation. Its SDK/preparation requirements apply only if an
optional example is explicitly selected. They are not official desktop prerequisites.
Do not nest frameworks or rebuild CEF/Dawn/updating for feature parity. No selected
integration is implemented merely by this contract.

A browser runtime can run ordinary TS providers and semantic DOM rendering.
Its selected Component candidate is a dedicated Polyengine worker, matching the
existing `0.6.7` consumer evidence. The native kit uses Wasmtime for Components and
Tao/Wry for presentation. An explicitly TS-enabled profile may run trusted TS
providers in a Bun-owned application host with a checked surface bridge; this is
not a reason to put another application framework under the official Rust host.
Optional external compatibility examples must use the same public ports, not alter
those official defaults. An explicitly selected Polyengine-in-WebView profile needs
separate acceptance; passing Chrome does not prove Bun or every WebView supports it.
Language, renderer, Component engine and packaging platform have separate IDs and
compatibility constraints; none should select the others by filename extension.

## 2. Existing formats, discovery and compatibility

### Current behavior to preserve

[The Rust CLI](../crates/loop-cli/src/main.rs) implements create/add/run/build/doctor,
upgrade/uninstall. `run`/`build` read the **explicit directory's** `loop.toml`, not
ancestors or child projects. A raw Component path uses the CLI's fixed dispatch
runtime. `add component` creates a self-contained child project and does not edit
a workspace list. Existing human/JSON-view output and exit 1 errors remain unchanged
unless the user chooses a new protocol/JSON mode.

[Manifest v1](../crates/loop-cli/src/dev.rs#L54-L126) rejects unknown fields and
supports source=`component`, Rust `loopkit:app/application@0.1.0` or TS
`loopkit:app/application-sync@0.1.0`, generated/user host and notes grants. TS's
Promise implementation still uses a synchronous Component ABI. `--host-source`
and then `LOOP_HOST_SOURCE` select generated host source during create; they do
not replace the runtime compiled into CLI `run`. Preserve that diagnostic distinction.

[Snapshot manifest v1](../tooling/workspace.ts#L8-L38) has `version`, `id`,
`sourcePaths`, optional pinned `dependencies`. It describes text source closure;
it does not choose a host, run code or grant authority. Reuse public
`@loop-kit/workspace` snapshots, `BuildRequest`, `BuildReceipt` and `BuildProvider`.

### Proposed operation selection

1. `loop create ...` without new `--kit` keeps today's legacy grammar/defaults,
   including Rust default language and generated host. `--kit browser|native`
   selects the new typed-config project scaffolder. Reject legacy-only `--host`,
   `--host-source`, `--template-dir` combinations in that mode until an explicit
   compatibility adapter implements them. New scaffold language defaults TS **host**;
   Rust guest bootstrap is a separate option after the Component gate.
2. Existing run/build/add without `--config` keep explicit `loop.toml` semantics.
   If config alone exists, return `E_CONFIG_OPT_IN` with the exact new invocation;
   do not execute it. If both exist, retain legacy selection and mention the ignored
   config on stderr. No silent migration or nearest-parent execution.
3. New `dev`, `inspect --evaluate-config`, and run/build with `--config` use the
   explicit root (default `.`). They look only at `<root>/loop.config.ts`, or an
   explicit config file directly inside that root. No parent search, dependency search,
   remote URL imports or fallback to a user's home. Canonicalize the chosen root;
   reject symlink/reparse config paths initially. An explicit root/config mismatch
   returns `E_CONFIG_ROOT`. Config-relative paths resolve from the config directory;
   record that directory as project root in the plan.
4. `inspect` without evaluation reads literal manifests/catalog/receipt headers and
   filesystem metadata only. It reports `config: present, evaluated: false`.
   `inspect --plan receipt.json` verifies a stored inert plan without importing code.
   `--evaluate-config --trust-local-config` executes trusted local code and clearly
   marks `executedConfig: true`. `dev` and config-mode run/build require the same
   trust flag, or an interactive confirmation scoped to this invocation. No stored
   blanket trust decision in v1. Noninteractive execution without it fails.
5. Multiple configured targets require `--target <id>` for run/dev/build; there is
   no implicit all/default/first target. A single target may be selected implicitly
   with an explicit selection record. `--instance <id>` is required to address an
   existing instance; launch may allocate one and report it. Kit aliases apply only
   to scaffolding; plan identities are fully qualified and versioned.

### Owner and precedence table

| Input | Owner and precedence |
| --- | --- |
| CLI root/config/target/instance | Explicit selectors, not field merges. They cannot override locked ABI, kit range or grant constraints. |
| `loop.config.ts` schemaVersion 1 | Trusted composition, kit/plugin options and target entries. One default export from `defineConfig`. Unknown keys reject after evaluation. |
| `loop.package.json` version 1 | Literal source inventory/pinned references. Config may point to it, but cannot replace its ID/closure with unrecorded files. Host config/import closure and lockfiles become additional build inputs. |
| `loop.toml` version 1 | Existing legacy application definition only. Config may select a named legacy adapter with an explicit relative manifest. No field-by-field overlay. |
| `package.json`, `bun.lock`, Rust/WIT locks | Dependency/tool inputs. Frozen install is a separate explicit prepare operation; execution does not auto-install. Conflicting pins reject. |
| CLI endpoint/profile flags | Override config defaults only where the selected kit declares an overrideable field. Record origin and previous value. They cannot widen guests' imports or shared-profile ownership. |
| Environment | No undocumented config override precedence. Allowlisted inputs appear in provenance, with secrets represented by dependency class rather than value/hash. Legacy host-source environment behavior stays limited to legacy mode. |

Coexisting formats have separate jobs. Fail `E_CONFIG_CONFLICT` with both source
locations when an explicit legacy adapter disagrees on source/world/build recipe,
or config names an undeclared source outside the snapshot. Do not infer a legacy
adapter from the presence of `loop.toml`. Keep schema version, protocol version,
kit version, plugin API version, world/profile version and package version separate.
Reject unknown major/schema versions before activation. Use exact installed package
versions/hashes in resolved plans; author ranges require lock resolution. A new
minor field must carry a default and compatibility test; unknown required features
fail rather than disappear through downlevel parsing.

## 3. Typed factories and one resolved contract

All signatures in this section are proposed root exports. Reuse `Host`, `Scope`,
`Provider`, leases and `ResourceOwner` from `@loop-kit/host`, and `Surface`, frames,
events/controllers/descriptors from `@loop-kit/ui`; do not define replacement classes.
Keep the portable kit contracts/resolver in **the existing host package** first.
Introduce concrete kit/renderer packages only when their runtime adapter lands.

```ts
// Proposed additions to @loop-kit/host; JSON means bounded finite plain data.
type Json = null | boolean | number | string | readonly Json[]
  | { readonly [key: string]: Json };
type TargetKind = 'browser' | 'desktop';
type VersionedId = { readonly id: string; readonly version: string };
type ModuleRef = {
  readonly specifier: string; // project-relative file or installed public package root
  readonly export: string;
  readonly sha256?: string;   // required after resolution, not author-maintained
};
interface RuntimeHostProfile {
  readonly key: string; // kit-local host, e.g. application, coordinator, guest.preview
  readonly realm: 'application' | 'coordinator' | 'guest-worker';
  readonly profile: VersionedId;
}
type RegistrationKey =
  | { readonly kind: 'provider'; readonly host: string;
      readonly id: string; readonly version: string; readonly serviceId?: string }
  | { readonly kind: 'renderer'; readonly host: string;
      readonly id: string; readonly version: string; readonly surfaceProfile: VersionedId }
  | { readonly kind: 'hook'; readonly host: string;
      readonly id: string; readonly version: string;
      readonly phase: 'prepare' | 'ready' | 'quiesce' };
interface RuntimeContribution {
  readonly key: string; // qualified as plugin-use/key in the plan
  readonly host: string; // exact RuntimeHostProfile.key, never inferred from realm
  readonly requires: readonly RegistrationKey[];
  readonly provides: readonly RegistrationKey[];
  readonly entry: ModuleRef;
  readonly options: Json;
}
interface PluginContext {
  readonly signal: AbortSignal;
  readonly resources: ResourceOwner;
  readonly targetId: string;
  readonly instanceId: string;
  readonly epoch: string;
  readonly log: (level: 'debug'|'info'|'warn'|'error', text: string) => void;
}
interface HostPlugin<K extends TargetKind = TargetKind> {
  readonly apiVersion: 1;
  readonly identity: VersionedId;
  readonly key: string; // config-local unique plugin use, e.g. documents.primary
  readonly targets: readonly K[];
  readonly before?: readonly string[]; // other plugin-use keys, strict references
  readonly after?: readonly string[];
  readonly runtime: readonly RuntimeContribution[];
  // Trusted coordinator callbacks remain in the evaluated Bun process.
  prepare?(ctx: PluginContext): void | Promise<void>;
  ready?(ctx: PluginContext): void | Promise<void>;
  quiesce?(ctx: PluginContext): void | Promise<void>;
}
interface HostKit<K extends TargetKind> {
  readonly apiVersion: 1;
  readonly identity: VersionedId;
  readonly kind: K;
  readonly profile: VersionedId;
  readonly options: Json;
  readonly hosts: readonly RuntimeHostProfile[];
  readonly coordinator: ModuleRef;
  readonly plugins: readonly HostPlugin<K>[];
}
interface TargetConfig<K extends TargetKind = TargetKind> {
  readonly id: string;
  readonly kit: HostKit<K>;
  readonly application: ModuleRef;
  readonly plugins?: readonly HostPlugin<K>[];
}
interface LoopConfig {
  readonly schemaVersion: 1;
  readonly source: { readonly manifest: string };
  readonly targets: readonly TargetConfig[];
}
declare function defineConfig<const C extends LoopConfig>(config: C): C;
declare function defineHostPlugin<K extends TargetKind>(plugin: HostPlugin<K>): HostPlugin<K>;
declare function defineHostKit<K extends TargetKind>(kit: HostKit<K>): HostKit<K>;
```

Factories such as `browser({...})`, `native({...})`, `semanticDom({...})` and
local `statusProvider({...})` return typed kit/plugin **uses**, not constructors
that mutate a global registry. `defineConfig` preserves inference and validates
literal structure; it cannot guarantee module behavior or authorize effects.
Validate kind/profile compatibility at runtime as well as in types. Factories may
close over trusted coordinator state only; runtime provider functions travel by
module reference, never closure serialization. Each runtime module exports a
`setup({host, scope, signal, options, ports})` function and registers cleanup
immediately. `ports` contains only kit-declared narrow dependencies, not a global
resolver or private owner dispatcher. An application entry exports
`start({host, scope, surface, signal})`; the kit has already created/injected them.
The application need not call `createHost` or discover an implicit singleton.
`defineHostKit` validates an external factory's definition; it registers no global
framework name. Adding another installed integration must require its own factory/
module/profile and conformance fixtures, not a new branch in portable resolution.

### Runtime and platform provider seam

The implementation freezes one versioned port/corpus for artifact inspection,
instance creation/invocation, cancellation/disposal and nominal resource/error
mapping. Reuse source/build identities and semantic Surface/UiFrame/UiEvent contracts.
A Rust provider owns Wasmtime stores, granted document resources and interruption;
a shell adapter owns native windows/view lifetimes and policy. The supervisor maps
reviewed operations over bounded IPC, not arbitrary WIT-to-JSON guessing, native
pointers or raw owner dispatch. Resource references bind principal/instance/epoch/
grant generation; serializing a diagnostic ID cannot mint one.

Keep execution and presentation separable: the native kit composes the provider
with Wry; optional external examples may consume the same headless provider. New
Rust logic may extend the existing concrete `loop-host` crate behind ports first;
extract only a proven responsibility while preserving public compatibility. The
CLI may launch a separately supervised backend invocation of its installed binary;
no checkout-local executable is a release dependency. Windows UI-thread constraints
and SDK singleton assumptions require explicit process-per-instance ownership.
Optional GPU/browser/update provider profiles report their supported features;
there is no universal CEF/Dawn/updater capability promised by the core.

### Identity, ordering and conflict rules

- Kit/profile/plugin IDs use reviewed namespaced lowercase identities such as
  `loop:kit/browser`, `loop:kit/native`, `loop:renderer/dom`. Kit/plugin/profile/
  package versions are exact semver in plans. **Capability versions remain opaque
  nonempty strings** compared exactly, as existing public APIs permit; `1` is
  distinct from `1.0.0` and must not be normalized or rejected as a legacy
  capability identity. Config target/plugin-use keys use `[a-z][a-z0-9.-]{0,63}`.
  A plugin identity can appear twice with different use keys only when it declares
  independent options/registrations. Host IDs are not capability IDs or host application IDs.
- Provider conflict keys match the existing host: **capability ID + serviceId**
  (or the explicit default sentinel), not version. Acquisition/dependency matching
  additionally requires the exact version. Different versions cannot occupy the
  same conflict key; different named keys remain distinct. Renderer keys
  include semantic element ID/version and surface profile; hook keys name a phase
  and unique contribution. Host/realm prefixing prevents cross-instance collision.
- Each runtime contribution declares its registrations and exact kit-local host key.
  Only that host can satisfy its requirements; identical keys in another host/realm
  cannot conflict or satisfy them. Renderer matching also requires exact surface
  profile identity/version. Reject unknown host keys and declaration-host mismatch.
  Cross-host access requires an explicit bridge contribution with a separately
  registered local contract and checked transport, not cross-realm key resolution.
- Union kit-owned and target plugins, then validate all registrations before effects.
  Duplicate keys, missing required providers/renderers, incompatible profiles and
  nonexistent ordering references fail. No last-writer-wins or fallback provider.
  Replacement requires explicit old-owner removal, not `override: true`.
- Order runtime contribution nodes by qualified `plugin-use/contribution` keys,
  with required provider edges plus expanded plugin before/after constraints.
  Include dependencies between contributions of the same plugin; declaration list
  order alone cannot satisfy them. Coordinator phase hooks follow plugin ordering,
  and ready runs only after all runtime setup succeeds. Reject cycles (including
  collapsed cross-plugin phase cycles) with an edge path. Stable topological order
  uses declared list position, then qualified key as tie-break. Independent plugins need not execute concurrently initially. A soft
  optional dependency must be an explicit feature with a recorded absence outcome;
  it cannot silently change a required dependency into fallback resolution.
- Runtime `setup` returns `void | Promise<void>`. The kit records a declaration
  receipt from before/after host registration snapshots and the explicit renderer/
  hook registration ports, then compares actual changes with the contribution's
  resolved keys. Run setup sequentially to attribute changes; reject mismatch and
  unwind. No self-reported receipt or function value crosses JSON. Trusted code
  can still bypass conventions; this diagnoses mistakes, not malicious host code.

### Resolved plan (data-only boundary)

`ResolvedHostPlan` schema 1 contains `planId` (content digest), protocol/features,
CLI/evaluator versions, project/config/source/lock digests, execution/cache policy,
selected target, exact kit/profile identities, ordered plugin-use identities,
module references resolved to pinned content, registration keys/dependency edges,
application entry, build recipe references, engine/renderer descriptors and budgets.
Include per-field origin locations and diagnostics; keep origins and timestamps
outside the canonical content-digest projection. Reuse workspace build identities
rather than inventing a second source snapshot. Canonical JSON uses sorted object
keys, preserved array order, UTF-8 and finite numbers; reject prototype-bearing
objects, accessors, functions, cycles, undefined, bigint and duplicate wire keys.

```ts
// Proposed data-only type; runtime schemas, not TS erasure, enforce this boundary.
interface ResolvedModuleRef extends ModuleRef { readonly sha256: string }
interface ResolvedHostPlan {
  readonly schemaVersion: 1;
  readonly protocolVersion: 1;
  readonly planId: string;
  readonly features: readonly string[];
  readonly targetId: string;
  readonly kind: TargetKind;
  readonly kit: VersionedId;
  readonly profile: VersionedId;
  readonly coordinator: ResolvedModuleRef;
  readonly kitOptions: Json;
  readonly hosts: readonly RuntimeHostProfile[];
  readonly toolchain: readonly {
    readonly id: string; readonly version: string; readonly sha256: string;
  }[]; // CLI/evaluator/Bun and declared engine/translator tools, canonical inputs
  readonly inputs: {
    readonly sourceSnapshotDigest: string;
    readonly configDigest: string;
    readonly lockDigests: readonly { readonly path: string; readonly sha256: string }[];
    readonly modules: readonly ResolvedModuleRef[];
  };
  readonly plugins: readonly {
    readonly key: string;
    readonly identity: VersionedId;
    readonly contributions: readonly (Omit<RuntimeContribution, 'entry'> & {
      readonly entry: ResolvedModuleRef;
    })[];
    readonly hooks: readonly ('prepare' | 'ready' | 'quiesce')[];
  }[];
  readonly application: ResolvedModuleRef;
  readonly dependencyEdges: readonly { readonly from: string; readonly to: string }[];
  readonly buildRecipes: readonly string[]; // references to public workspace build inputs
  readonly descriptors: Json; // validated kit-specific engine/renderer/budget options
  readonly cache: 'disabled';
  readonly provenance: Json; // validated tool versions, origins; outside planId projection
}
```

The evaluator extracts only known coordinator hook fields into its private callback
map before calling the pure resolver; it passes hook-name metadata, not functions.
Literal `options` and plan fields reject functions. The resolver never invokes a
factory, hook, getter or module. The build adapter binds `buildRecipes` to public
workspace BuildRequest/Receipt contracts, not a new duplicate receipt format.

A separate `LaunchRecord` adds instance ID, random epoch, reserved endpoint/profile
leases, start/stop state and generation. It contains no grants or credentials in
persisted plans. Secret-bearing bootstrap travels through a private per-instance
channel, never source, HTML, URLs, logs or the canonical plan. Plan digests establish
identity/currentness, not publisher authenticity, isolation or reproducibility.

## 4. Startup, restart and resource ownership

The kit uses one fresh `createHost()` per runtime realm and launch, one root scope,
and explicit child ownership. Host-local scopes/registries/controllers cannot be
module globals. Immutable byte/module caches may be shared if keyed by actual
inputs; privileged mutable instances, provider state and grants may not.

| Phase | Success and failure contract |
| --- | --- |
| validate/resolve | Execute no runtime modules. Validate types, versions, graph, requested endpoints and source currentness. No locks/profiles/ports created by static inspection. |
| reserve | Launch owns an endpoint reservation and profile lock keyed by project/target/instance. Bind loopback port 0 by default and report actual origin. Explicit occupied ports fail; no kill/reuse/fallback. |
| prepare | Sequential coordinator hooks under per-plugin `ResourceOwner`; adopt each resource before the next await. Failed hook unwinds its partial stack, then prior plugins in reverse dependency order. |
| bootstrap/setup | Construct host/scopes before application entry. Runtime plugin setup owns registrations and partial provider initialization; use existing activation resources and `ProviderContext.resources`. Ready consumers start only after their required registrations activate. |
| ready | Health check, then publish active generation once. A ready-hook failure fails startup and unwinds the candidate; no half-ready endpoint advertised. |
| quiesce | Close admission, abort signal, stop new events/writes and drain permitted in-flight work. Reverse dependency hooks run once; errors do not skip remaining cleanup. |
| dispose | First initiate each runtime `host.dispose(reason)` without awaiting a scope join: existing host disposal aborts registration activation before revoking/joining scopes, then unregisters in reverse registration order. Close/cancel surface event reads and bridge pending requests synchronously on abort before task joins. Await host disposal and plugin owners in reverse dependency order, then join/close remaining workers, windows, servers, processes and profile reservations. Aggregate primary and cleanup failures without losing either. |

Apply those pre-join cancellation rules on **every failed-start and partial-unwind
path**, including activation still pending before application entry. Do not await
`scope.revoke()` first while its creations may await an un-aborted registration
activation. Register runtime contributions in dependency order so existing host's
reverse registration cleanup preserves dependencies. The kit surface owner abort
listener resolves pending `nextEvent()` before the application task joins; a LIFO
resource cleanup registered after the task is not sufficient.

Cancellation before commit forbids that commit; cancellation after commit reports
the committed result or an uncertain outcome requiring reconciliation. Cancellation
is not rollback. Scope/task cancellation is cooperative. A trusted plugin that
never settles can block cleanup; the kit uses its process/worker boundary for a
measured hard-stop deadline (proposed 5 seconds after graceful cancellation), logs
incomplete cleanup and never calls it successful disposal. The outer supervisor
closes OS-owned resources even if guest disposal never runs. Do not self-await the
scope shutdown currently waiting on your cleanup callback.

Registration activation failure is sticky until explicit remove/re-register;
resource-generation failure follows existing host retry semantics. No automatic
retry of writes or failed start. `stop` and disposal return the same completion on
repeat. After stopped/failed, `restart` allocates a new epoch, fresh hosts, callbacks
and module process; old leases/events cannot bind to it. Re-evaluate config in a
fresh worker if any input changes; do not reuse Bun's module cache as hot reload.

Development replacement follows [foreground generation rules](foreground-development.md#build-and-replacement):
editor/draft live in a sibling owner, candidate effects stay staged/read-only,
quiesce old writes before promotion, reject stale results and transfer state only
through a declared versioned adapter. A failed candidate leaves old active.
User-visible plain restart may stop old first, but must say so and preserve saved
source. Neither operation changes host application persisted identity or repairs a failed
external mutation by pretending rollback succeeded.

### Multiple instances

An instance owns its own process tree, runtime hosts, scopes, callback map, listeners,
worker URLs, endpoint/pairing credentials, profile lease and scratch outputs under
`.loop/instances/<target>/<instance>/<epoch>/`. Default profiles are transient and
unique. Persistent profile selection requires an explicit named profile and
exclusive lock; a second writer fails `E_PROFILE_BUSY`. Distinct targets do not
inherit shared profile names or hard-coded ports. Fail case/normalization aliases.
Stop A must leave B's host state, listeners, documents, profile and grants unchanged.
A kit needing a platform-global UI event loop declares one process per instance;
it cannot hide ownership behind a singleton. Product identifiers/update channels
are explicit kit options and remain separate from ephemeral instance IDs. For
transient desktop development, the kit derives an isolated development identity
from the declared base plus instance and records it; it never borrows an installed
product's identity. Persistent/release profiles keep declared product identity and
exclusive ownership, failing a second writer rather than redirecting to a hidden
singleton. No derived identity gets written into host application data.

## 5. Trusted config evaluation and Rust/Bun protocol

Executable TS config has **same-user host authority**. It may spawn processes,
read secrets or mutate files before returning; subprocess separation and plan
validation do not sandbox it. Only evaluate explicitly trusted local projects.
Guest Components receive none of these ambient rights. A config can *request*
bindings; only the concrete host policy issues grants and rechecks each operation.

### Launch and inputs

Rust resolves the selected Bun executable once, checks the declared supported
range and records actual path/version/hash. Spawn an argument vector with no shell:
`<bun> --no-install --no-env-file <bundled-worker> ...` (exact supported Bun flags
must pass the pinned-version fixture before release). `cwd` is the canonical config
directory, stdin/stdout are dedicated protocol streams, stderr is bounded logs.
The CLI bundles a checksummed evaluator asset; it does not run a project-selected
replacement worker or `bunx`. It uses the project's already-installed, frozen-lock
module graph; absent/stale packages produce a prepare instruction, never auto-install.
Reject remote specifiers and dependency symlink escapes initially; record deliberate
workspace/link use as development-only and prohibit it in packs/production builds.

Pass only selected environment variables to the child. Include OS-required process
inputs and explicit allowlisted build inputs; omit ambient credentials, NODE_OPTIONS,
BUN_OPTIONS, preload modules and implicit `.env` loading. Trusted config can still
read the user's files: this hygiene is not confinement. Instrument the resolved
import/bundle closure, record module and lock hashes and detect concurrent edits.
Config-dependent network/time/untracked reads prevent a complete deterministic
input claim. HK1 config execution is **uncached**; a later restricted reproducible
profile needs an enforceable input contract, not a self-declared cache flag.

### Framing and lifecycle

Use dedicated versioned **length-prefixed UTF-8 JSON** frames: 4-byte little-endian
length followed by one strict JSON object, max 1 MiB/frame, max 16 in-flight requests,
max 8 MiB queued payload, max 64 KiB error detail, bounded 256-record progress queue.
Binary framing tolerates config `console.log`; the worker redirects console output
to stderr before imports, and treats raw stdout/protocol corruption as fatal.
Arbitrary trusted code can bypass interception; do not try to repair a corrupted
stream. Bound logs to 1 MiB per operation with a truncation event, never backpressure
runtime disposal on a log reader. Artifact bytes travel via verified staging
references, not oversized frames or arbitrary client-chosen paths.

First exchange: Rust `hello {protocol:1, cliVersion, evaluatorDigest, nonce,
supportedPlanSchemas:[1], features}`; worker `helloAck {protocol:1, workerVersion,
bunVersion, nonce, schemas:[1], features}` within 5 seconds. Exact nonce/schema and
required features must match. No config import before acknowledgement and trust
selection. Messages carry session epoch, request ID, operation and generation.
Operations: `evaluate`, `prepare`, `start`, `inspectLive`, `cancel`, `stop`, `shutdown`.
Events: `accepted`, bounded `progress`, exactly one `completed|failed|cancelled`,
then optional session `closed`. No duplicate terminal, unsolicited result, stale
epoch or unknown required operation. Protocol errors close the channel and cancel
owned work. Typed errors include code, phase, target/plugin/source location and
redacted cause. Heartbeat is liveness, not successful health/authorization.

Proposed time bounds: handshake 5s; config import/evaluate 30s; progress idle timeout
30s for long build operations unless a declared operation budget says otherwise;
user cancellation immediate; graceful shutdown 5s before owned process-tree stop.
The Rust parent owns the worker and descendants via platform process supervision
(Windows Job Object, Unix process group), closes stdin on shutdown, waits for child
exit and suppresses late promotion. Parent death/EOF triggers worker cleanup;
forced kill cannot guarantee completion of trusted external effects. A lost write
reply reports uncertain/needs reconciliation, not implicit retry.

### Closures and realms

Use one evaluator/coordinator process per launched instance, not a multiplexed
process-global callback registry shared by targets. The Bun worker retains config
coordinator callbacks in a private map for that one session and launch. JSON
contains only stable module/export/content descriptors and literal options. Rust never receives/evaluates JS source as a callback or a
magic function-ID RPC. `prepare/ready/quiesce` run in that evaluated process.
Runtime modules execute separately in their declared realm and receive fresh
host/scope ports; browser bundling imports those modules, not the config closure.
A config-only closure presented as a browser/native provider returns
`E_NONPORTABLE_CALLBACK` with a module-export remedy.

Browser static builds reject coordinator-only runtime providers unless a declared,
reviewed remote bridge exists. Desktop bridges map checked serializable operations
and explicit resource handles; neither arbitrary callback RPC nor host-object
cloning is permitted. Renderer callbacks remain renderer-local; semantic events
carry revision/sequence/key, guest UI callbacks stay in the guest. A guest cannot
reach config hooks, Bun process APIs, the Rust protocol or an owner dispatcher.

Machine JSON commands use `{schemaVersion:1, operation, executedConfig, selected,
result?, diagnostics:[{code,phase,location?,message}], status}` on stdout; logs go to
stderr. New-mode exit codes: 0 success/no-op, 2 invocation/schema/compatibility,
3 trust/policy denial, 4 tool/runtime/start failure, 5 conflict/recovery-needed,
6 protocol failure, 130 cancellation. Preserve legacy exit behavior separately.

## 6. Directory/package/crate graph and owned file map

Implemented graph remains [architecture-owned](../ARCHITECTURE.md#enforced-package-ownership).
Proposed additions below are **conditional implementation locations**, not empty
packages to create in this design run.

```text
@loop-kit/host [kit contracts + pure resolver + existing lifecycle] -> capabilities
@loop-kit/ui [semantic nodes/controllers]                           -> (none)
@loop-kit/scripting [guest bindings]                                -> capabilities, ui
@loop-kit/workspace [source/build receipts]                         -> (none)
@loop-kit/host-browser [browser kit adapter]                        -> host, ui
@loop-kit/host-native [native kit + reusable runtime provider adapter] -> host, ui, renderer-dom; injected process port
@loop-kit/renderer-dom [semantic DOM adapter/plugin]                 -> host, ui
@loop-kit/component-polyengine [after G1/G2; real worker adapter]     -> host, scripting, ui, Polyengine
CLI-owned Bun worker [evaluation/build/server composition]          -> public package roots + Bun
Rust loop-cli [parsing/composition] -> loop-host-plan, process adapter, legacy loop-host
Rust loop-host-plan [literal protocol/plan validation through ports] -> serde/serde_json
Rust loop-host [existing concrete adapter]                          -> Wasmtime/WASI; optional Tao/Wry
```

| Owner | Proposed owned paths | Contract and dependency rule |
| --- | --- | --- |
| Integration | This spec, shared schemas/fixtures, policy files, manifests/locks | One writer for IDs/types, protocol and graph. No concurrent shared-schema edits. |
| Portable host | `packages/host/src/kits/{contracts,resolve}.ts`, root export, focused tests | Pure JSON/graph resolution; reuse host lifecycle. No Bun/React/WebView/Wasmtime/host application imports or globals. |
| Config evaluation | `crates/loop-cli/host-tools/{worker,evaluate,supervise}.ts`, `tooling/host-config/*` fixtures | Bun process adapter, module closure and callbacks; packaged built asset belongs to CLI include inventory. No portable resolver platform edges. |
| Rust CLI | `crates/loop-cli/src/{main,commands,config_process}.rs` and compatibility tests | Parser/adapters only; preserve legacy `dev.rs`, templates, manager and release commands while extracting responsibilities incrementally. |
| Rust plan | `crates/loop-host-plan/{Cargo.toml,src/*}` only when CLI consumes it | Bounded literal validation/protocol DTOs/ports, no engine/process/UI. Paired JSON golden corpus checks Rust/TS agreement. No parallel resolver semantics. |
| Browser kit | `packages/host-browser/src/*` with contracts/application/providers/composition roles | Kit bootstrap and app realm; Bun server/bundler stays in CLI tooling. Explicit source module export; no React requirement. |
| Native kit/runtime provider | `packages/host-native/src/*`; narrow `crates/loop-host/src/*` runtime/surface adapter modules and installed CLI backend dispatch | Reuse concrete Wasmtime and Wry through inward ports; shared native/headless provider, not a second SDK or speculative crate split. Integrator owns shared Rust DTOs/WIT. |
| Optional compatibility examples | `examples/compatibility/*` | Example-local dependencies and public ports only; no official Electrobun package, mandatory SDK/fork work or release dependency. Defer complex examples. host application bootstrap stays host application-owned. |
| DOM renderer | `packages/renderer-dom/src/*` | Map existing UI definitions/events with focus/a11y/disposal. React adapter remains optional and separate; no guest code loading. |
| Component adapters | Selected owned files under `experiments/` then actual adapter package/native modules | Gate on nominal async resources, engine limits and same-byte receipts. Do not turn existing host into an engine registry prematurely. |
| Scaffolding/releases | `crates/loop-cli/templates/*`, CLI asset build/include rules, release/pack tests | Templates call public kit APIs. Embed evaluator/catalog/payload assets with digest/version; no checkout-relative runtime file reads. |
| Agent workflow | `skills/loop-host-kits/*`, `skills/catalog.json`; future CLI manager modules/tests | Payload/data separate from install destinations. Generic manager, no per-skill branch. |
| host application | Later named adapter/test files only, chosen from a new baseline | Public packed imports and policy ports. No source copies, store replacement, persisted-ID changes or packaging rewrite. |

Only a real adapter justifies a new publishable package. Start portable resolution
inside host; do not add `core`, `common`, an empty runtime package, a second UI
registry or a second source/build receipt system. Runtime modules use public root
exports; private files and absolute development paths cannot enter packs.

### Enforceable boundaries

Extend the compiler-resolved TS policy with explicit longest-prefix roles for new
kit modules. Count type-only/dynamic/re-export/alias edges, computed imports,
realpaths and cycles. Rejection fixtures must catch portable resolver importing
Bun/React/WebView/Polyengine, browser globals, private exports, host application, a type-only
cycle and a workspace-link escape. Provider and presentation modules cannot import
each other's private implementations. Composition owns their wiring.

Add a dedicated Rust manifest/feature checker; `bun run repo check` does not
currently check Cargo. Inspect **all declared edges**, not just this host's active
feature graph: normal/build/dev/proc-macro, optional/renamed/workspace-inherited,
platform cfg and feature forwarding. Core cannot depend on outer adapters under a
disabled feature. Reject direct/transitive outer backedges, `cfg(windows)` or
inactive-target escape, default-feature native activation, renamed dependency
bypass and undeclared absolute/host application paths. Bound dev exceptions by exact owner
and edge. Positive fixtures preserve today's CLI→loop-host desktop and optional
Windows Wry/Tao while pure plan consumers remain engine-free.

Future gate commands must be added/tested before claiming them: `bun run repo
check --rust`, `bun test tooling/rust-boundaries.test.ts`; run metadata/tree plus
compile/test across no-default, all-features and Windows/headless profiles. Current
Rust required checks remain fmt, locked workspace/all-feature tests and clippy as
[documented](../README.md#rust-status). Pair those with TS/packed-consumer gates.

Release tests must run from a packed crate/CLI archive **without checkout access**:
all embedded starters plus new evaluator/catalog assets are present, local host
paths/links absent, registry host version pinned, runtime JS module resolution
works from installed project roots, browser output omits Bun/native modules and
production excludes dev pairing material. Preserve the current ZIP whitelist,
manager embedding, bootstrap/install rollback and published-host relocation tests.
Skill payload embedding and crate licenses need explicit file inventories; source
`include_str!` that works only in the workspace is not release acceptance.

## 7. Component profile and runtime gap matrix

The [async document runtime](async-document-runtime.md) remains G1/G2's authority.
It requires identical fresh Rust Component bytes in Wasmtime and a real browser,
actual delayed read/CAS write, per-use grants, conflicts/revoke/cancel races,
nominal resource ownership and measured forced stop. A synchronous note store,
ordinary TS provider, RecordingSurface or the TS SVG editor cannot pass it.

Do not widen the G1 document world to conceal a UI requirement. After the document
proof, define a separately versioned **document + semantic-surface extension**:
retain the document interface identity, add an explicit UI import and async event
entry using bounded existing UiFrame/UiEvent JSON semantics. Inspect actual ABI
imports and make adapters explicit. The event must originate in a real rendered
button, reach the same Component artifact and cause a granted document action;
return a new frame and dispose it. Use no callbacks in JSON. Freeze that extension
only after compiler/runtime feasibility; it is not implemented by naming it here.

| Path | Implemented evidence | Missing host-kit acceptance |
| --- | --- | --- |
| Ordinary TS host/providers | Independent scopes/leases/tasks and public package consumers | Typed kits/config/resolution, per-instance startup supervisor and adapters. No isolation claim. |
| Public semantic UI | Frames/events, registries/controllers/descriptors, recording adapter | General standalone DOM renderer kit; host application still owns its React adapter and product UI. |
| Rust legacy app | Async dispatch/timer, sync notes grants, native/headless package proof | New async document resource/CAS profile and bridge to TS host; native UI semantics differ from public UI. |
| Browser Components | host application fixed greeting worker; this run's disposable Chrome document + semantic-Component proof using same bytes as Wasmtime | Production reusable document facade/import allowlist and worker isolation/forced-stop conformance; disposable harness is not a shipped adapter. |
| TS guest via ComponentizeJS | Complete disposable TS guest compiles to JS; pinned 0.22 async-document generation fails with `not yet implemented`, no Component output | New async document ABI generation. Preserve the separate wasm-rquickjs possibility; do not generalize this to every JS compiler. |
| JS guest via wasm-rquickjs | Existing fixed P3 scripting engine/build wrapper with real async service/surface bindings | New document profile and independent-realm proof; `start` is not a new realm and a host kit cannot fix that by selection. |
| Bun Component execution | Host tooling/provider execution works; source engine exists | Multi-memory/JSPI engine acceptance on pinned Bun. Use browser worker candidate instead of silent engine fallback. |
| Rust desktop feasibility | Disposable Tao/Wry/WebView2 window runs the same semantic Component on Wasmtime; actual pointer event and rendered document result, close/join observed | Production kit/profile conformance and standalone distribution. This is not Electrobun or browser-Polyengine execution in a WebView. |
| Optional Electrobun compatibility | Existing host application packaging is independent; SDK projection is version-specific | No official kit is planned. If a cheap example is selected, test only its claimed public-port interaction; otherwise defer it without blocking release. |
| Wasmtime document bootstrap | Disposable same-byte document and semantic profiles invoked with delayed methods, denial/CAS/cancel/resource checks | Production nominal facade, complete malformed-input/borrow/runaway/isolation conformance and reviewed package/API; probe success does not close G1. |

The dated [probe receipt](../experiments/host-kits-2026-11-03/README.md) is the sole
owner of this run's actual versions, hashes, commands, imports/exports, grants,
results and disposal. Keep each outcome distinct: generated, compiled, translated,
instantiated, invoked, rendered, disposed. If TS guest compilation cannot emit this
world, use an **explicit Rust guest bootstrap** while TS/Bun still owns host config,
providers/tooling. Keep the TS guest gap visible. Stop only a dependent runtime
lane when a required tool/ABI fails; config, lifecycle, catalog and static packaging
work can continue without claiming the new application runtime is ready.

## 8. Repo skill and optional data-driven installation

Canonical source lives at `skills/loop-host-kits/`; it is usable through AGENTS
without installation. `skills/catalog.json` owns first-party payload metadata.
The skill routes config, kits/plugins, renderer adapters and boundary changes to
their owner docs/public APIs. It separates platform-neutral identity, authority,
revision and lifetime rules from conditional web/React implementation guidance.
Essential architecture/trust invariants remain in AGENTS/architecture even if the
skill is never installed. This run applies local skill-creator, writing-for-agents,
stop-slop and Bun-skill-creator guidance; it ships no Bun helper merely to justify
scripts. Future helpers use small dependency-free Bun scripts and must be run.

### Catalog schema 1

Each entry carries stable ID, exact skill version, description, compatibility
(manager/catalog schema, Loop API range, optional runtime requirements and adapter
versions), source `{kind:'bundled', relativeRoot}`, SHA-256 payload digest, explicit
sorted file inventory `{path, bytes, sha256}` and supported destination adapters.
An ID is independent of version and validated as one portable directory component.
The manager may bundle more than one entry; **adding the second skill changes
catalog data/content, not parsing/dispatch branches**. Remote registries remain a
future source adapter, not an implicit network fallback.

`source.relativeRoot` resolves from the catalog file's directory, not cwd or the
installation destination. The checked-in [catalog candidate](../skills/catalog.json)
uses `managerSchema`, `catalogSchema`, per-package `loopApi` ranges and adapter
versions under `compatibility`; `status: proposed` and unverified discovery stay
visible until a real manager/client gate passes.

Inventory paths are slash-relative UTF-8, sorted by ordinal encoded bytes, unique
under portable case folding. Payload digest is SHA-256 of UTF-8
`loop-skill-v1\n` followed for each file by `path + NUL + decimalBytes + NUL +
lowercaseSha256 + LF`. Inventory excludes the catalog itself. Inventory every
regular payload file and no unlisted file. Hashes establish bytes, not publisher
trust. Bundled files, schemas and destination adapters support offline operation;
no postinstall hooks, script execution, Bun auto-install or registry fetch.

Initial adapter ID `codex-v1`: project destination `<explicit-project>/.agents/skills/<id>`,
user destination `<explicit-codex-home>/skills/<id>` (`CODEX_HOME` or documented
`.codex` default is shown by inspect, never silently selected by a project request).
Project discovery through the real agent client needs a separate acceptance gate;
fixture path tests alone do not prove discovery. Other destinations return
`E_SKILL_ADAPTER` until tested. User scope always requires explicit scope/root.
No command may rewrite unrelated AGENTS/CLAUDE/user instructions.

### Proposed management operations

`loop skills list`, `inspect <id>`, `install <id>`, `update <id>`, `remove <id>`;
explicit `--scope project|user --root <path> --adapter codex-v1`, optional exact
`--version`, `--json`, `--dry-run`. Mutation verbs default to planning; **`--write`
is required to apply**. `--dry-run --write` rejects. No implicit all/update-on-run
or auto-install during create/build/doctor/config evaluation. Only these explicit
management commands with write intent may create/change skill files. Explicit
recovery uses `loop skills recover <id> ... --write`, never inspect/list.

Machine results use schemaVersion, operation, request, catalog/payload digest,
resolved destination, status, applied flag, ordered actions with before/after
hashes, conflicts and recovery state. `--json` yields JSON on stdout even for
errors; diagnostics go to stderr. Use the new-mode exit classes above. List,
inspect and dry-run have **zero writes**, including locks/temp/cache/journals, zero
network and no code execution. Apply computes the same plan then revalidates its
preconditions; a changed target returns conflict rather than trusting a stale plan.

### Filesystem and ownership contract

Reject traversal, absolute/drive/UNC/device paths, mixed separators, NUL, ADS,
reserved Windows names, trailing dot/space aliases and case-fold collisions. Reject
payload/ancestor symlinks, junctions and reparse points; validate opened resources
where no-follow handles exist and recheck immediately before mutation. If the
backend cannot exclude malicious same-user replacement races, label it trusted-local
and fail on detected replacement; do not claim a sandbox from realpath/prefix checks.

Store manager-owned receipts outside payload in a scope-local `.loop-skill-state/`
area: installer owner/version, ID/version/adapter, canonical root, source digest,
exact installed file types/hashes and created directories. Resolve the exact state
root through the adapter and include it in inspection. A matching directory name
or matching bytes without a valid receipt does not establish ownership. Reject
unmanaged collisions, local edits, unknown entries, corrupted receipts and owner
mismatch. HK1 has no force/adopt path. The user can export/move edits explicitly.

Identical owned install/update is a no-op. Update removes an upstream-deleted file
only when its current bytes/type match the old receipt. Remove preflights the
whole managed installation, preserves unknown/edited content and returns conflict
without partial removal. Repeated removal of an absent owned installation is
`absent`; a replacement unmanaged directory stays untouched. Prune only manager-
created empty directories, never recursively delete a user tree.

Under explicit write intent, acquire one per-destination lock, stage a verified
new generation beside the destination on the same volume, write a durable journal,
rename old to backup, rename staged to destination, then commit the receipt and
clean old data. Windows directory replacement is not one atomic operation. Journal
phases distinguish rollback-needed from committed-cleanup-needed. Preserve the last
good generation until commit; do not replay unverified journal paths. Read-only
inspect reports recovery-needed without repairing anything. Explicit recover checks
ownership/preconditions and resumes or restores. Declare actual fsync/directory-
durability guarantees per backend; sharing violations are recoverable errors, not
permission to delete backups. Inject a crash before/after each rename and receipt
write, including concurrent writers and replacement races.

## 9. Acceptance and integration gates

A test name/command listed here is a **future executable requirement**, not a pass
from this documentation run. Implementation cards select exact commands/files.

- Legacy CLI golden tests preserve grammar/defaults, generated/user/headless
  behavior, explicit directory discovery, embedded overlays, grants, release archive
  and relocation. A config sentinel file must prove legacy/static inspection never
  executes config or creates directories.
- Config tests cover coexistence/conflict, unknown versions/keys, stale/missing
  lock, nonportable closure, module import escape, changed source during evaluate,
  deliberate config logging/exit/hang, protocol byte/queue limits and handshake.
  Cross-language corpus rejects duplicate keys, oversize/truncated frames,
  wrong nonce/epoch/schema, stale generation and duplicate terminal events.
- Lifecycle tests fault each startup step, including partial resource acquisition;
  assert reverse-order cleanup continues on errors. Cancel at build/prepare/ready/
  commit boundaries; prove no late promotion, no detached work and no double cleanup.
  Two instances with identical provider IDs remain independent; same explicit
  endpoint/profile fails without touching the first; stop/restart A leaves B live.
- Rejection fixtures check TS and all Cargo feature/target/kind edges; packed
  consumers reject private/local-path imports and work without React/native tools.
  New crate/evaluator/skill assets survive checkout-free release packaging.
- G1/G2 use actual new Component bytes and the existing async gate. The semantic
  UI extension adds real rendered button→Component→granted document→frame evidence
  on browser and isolated desktop, with invalid/stale/duplicate/disabled events,
  denied/revoked imports and disposal. Keep desktop/WebView and Wasmtime results
  separate. No availability flag can replace these observations.
- Skill manager fixtures prove zero-write inspection/dry-run, exact bytes,
  idempotency, data-only second entry, separate project/user roots, offline use,
  path/link aliases, local-edit preservation, ownership-safe remove and fault-injected
  recovery. Forward-test the repo skill on config, renderer, boundary and host application
  policy-trap tasks, plus outside-checkout use.
- host application adoption completes the current authored Action Button seam through public
  Loop artifacts and an independent packed consumer. Preserve saved definitions,
  IDs, placement, config, bindings/grants, undo/reload and existing React/Electrobun
  behavior. The [host-kit evidence inventory](../docs/development-alpha/host-kits-evidence.md)
  records those checks. Autosave risk needs a separate host application regression, not opportunistic
  rewriting in this run. Broad dock/property extraction remains Gate B.

Record unresolved consequential choices in [QUESTIONS](../QUESTIONS.md). Record
observed implementation evidence in existing engineering ledgers. Preserve dated
runtime/release evidence and inbound links when shortening old prose. HK1 does not
advance cloud/distribution gates or authorize third-party hostile execution.
