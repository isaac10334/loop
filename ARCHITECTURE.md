# Architecture

Loop-kit currently has two implementation paths. The new TypeScript packages make capability contracts and local providers usable without WebAssembly. The existing Rust host and CLI run component applications with concrete native grants and desktop/headless integrations. They do not currently share a runtime API.

**Portable development proof, 2026-10-28:** `@loop-kit/workspace` now owns bounded
immutable text-source snapshots, pinned dependency references, build-provider/receipt
contracts and checked Git change requests. It owns no Station persistence, grants,
renderer, cloud account or execution engine. `tooling/workspace.ts` is the concrete
file/Git adapter; `tooling/github-change-port.ts` is an explicitly authenticated
GitHub draft-PR adapter. Neither is a durable event/workflow service.

Capabilities may retain a pinned WIT source identity and binding dialect. The
official parser/codegen and TypeScript 7.1 content mapper proof use
[the WIT fixture](tooling/fixtures/wit/README.md) and `tooling/wit-*`;
`bun run contracts:generate` writes disposable output under `target/svg-editor-contract`.
Generated jco declarations are not
Polyengine runtime facades, and source hashes are not canonical world ABI digests.

**Host lifecycle expansion, 2026-10-20:** [the current contract](packages/host/LIFECYCLE.md) adds retained/transferred/borrowed leases, explicit shared generations, eager named services and bindings, task groups with cancellation/deadlines, partial-initialization ownership and registration activation. Factories receive narrow dependency objects; permissions stay in callers. Resource and lease signals have distinct lifetimes; `toLegacyHandle` is the explicit old raw-value/provider-signal adapter. The [independent monitor](examples/lifecycle-monitor/README.md) consumes real public tarballs in Bun, Node and a browser.

`@loop-kit/capabilities` defines an ID and version associated with a TypeScript service type. `@loop-kit/host` registers providers under exact capability/version identities with optional named services, creates independent provider instances by default or explicit shared generations, and groups handles in independently revocable scopes. Providers own instance cleanup. A handle carries an abort signal; cancellation is cooperative because its plain JavaScript value is not intercepted.

Scopes have host-local IDs, optional display names and optional parent ownership. Revoking a parent revokes descendants, aborting their work synchronously and awaiting cleanup. `Host.inspect()` exposes a cached, deeply frozen snapshot of registrations, scopes and pending/active/releasing acquisitions; `Host.subscribe()` provides coalesced microtask notifications isolated from lifecycle operations. Reflection contains no service values, signals, errors or lifecycle methods. Revoking scopes and unregistering providers remain visible until their cleanup finishes, including failed cleanup; completed records are removed. Names and parentage are diagnostics/ownership, not permissions. Applications keep any authorization binding private.

`Host.define()` documents an ID/version without providing it. Snapshots include a definition catalog with namespace and contract package derived from the ID. Provider registration automatically records unknown definitions without replacing explicit documentation. Definitions survive unregistration and are cleared on disposal; multiple documented versions do not relax exact-version acquisition. This catalog contains explicit display metadata, not inferred TypeScript members or authorization rules.

The generic TypeScript capability host does not automatically turn a WASM Component into a provider under a capability identity. The separate [Polyengine adapter](packages/component-polyengine/README.md) implements bounded document/semantic sessions and a separate import-free string-call Component session in dedicated workers; neither is an automatic capability-provider bridge. Trusted adapters explicitly map a guest contract to a registered provider. Pure sessions pin component/translation/world identities, deny all host imports before instantiation, serialize calls, and terminate on cancellation/deadline; payload checks do not establish canonical pre-lift allocation limits. [Native composition](packages/host-native/README.md) uses a checked surface transport and a separate Rust document runtime. Arbitrary remote provider placement remains future work.

The Rust host uses Wasmtime 48, an authored WIT application contract in `crates/loop-host/wit`, per-use scoped notes grant checks, and desktop/headless dispatch. The CLI embeds its starters from `crates/loop-cli/templates` and is released through manual GitHub workflows. The isolated `experiments/wasip3` probe retains pinned async WIT inputs and documents the current JavaScript generation limit.

Repository map: `packages/` is the publishable TypeScript SDK; `crates/` is existing Rust implementation; `experiments/` holds reproducible probes; `site/`, `scripts/`, and `.github/workflows/` own the existing Windows distribution. Design proposals for cloud, Station, registries and UI systems are outside this implemented architecture.

Browser kit configuration also supports explicitly pinned artifact assets. The CLI
captures local regular-file bytes separately from the bounded authored text snapshot,
checks digests/currentness, copies them into static/live output and serves only the
declared basenames. This delivery mechanism is not a guest filesystem grant; see
[the browser kit](packages/host-browser/README.md) for budgets and constraints.

## Proposed CLI host-kit composition

[HK1](specs/host-kits.md) specifies typed trusted-local configuration, versioned
kits/plugins, independent instances and optional bundled agent skills. The
November 7 scope selects only the official browser and Rust/Wasmtime native Wry
host kits. External ecosystems, including Electrobun, are optional compatibility
examples through public ports, never official dependencies or release gates;
see [desktop evidence](docs/reference/desktop-hosts.md). The existing Rust host/CLI
and Station Electrobun packaging remain active. The proposal reuses
portable host/UI/workspace contracts. It does not implement a unified runtime,
replace Station React UI or turn kit selection into isolation. See the
[November audit and probe limits](docs/development-alpha/host-kits-evidence.md).

## Shared vocabulary and product direction

Station is the editable workspace consumer at `C:/Users/ijhar/Desktop/station`; this independent upstream is [isaac10334/loop](https://github.com/isaac10334/loop). Station's documentation starts at `C:/Users/ijhar/Desktop/station/docs/README.md`; this is a machine-local route, not a package dependency. In another checkout, locate the consumer explicitly rather than assuming that path exists.

| Term | Meaning and owner |
| --- | --- |
| Capability | Versioned service contract identity; Loop Kit supplies portable descriptors. Identity alone grants nothing. |
| Provider / adapter | Implementation of a contract / bridge to another implementation or transport. Placement does not change the caller's contract or policy obligations. |
| Scope / resource / lease | Lifecycle owner / owned implementation instance / consumer ownership ticket in `@loop-kit/host`. These are not grants. |
| UI element / surface / renderer | Semantic node type / revisioned UI frame-and-event session / trusted host mapping to DOM or another platform. `@loop-kit/ui` describes the first two; hosts render them. |
| React component | Host implementation unit. A component is not automatically a registered semantic element or a Station widget. |
| WASM Component | Component Model executable with declared imports/exports. Distinct from a React component; execution and permission enforcement require a concrete host. |
| Asset / widget definition / widget instance | Station's stored authored content / reusable widget recipe / placed, stateful occurrence. These product concepts are not Loop host resources or npm packages. |
| Layout / dock / overlay | Station composition / its placement authority / a presentation layer. Layer order, focus and interaction passthrough need explicit host policy; they are not capabilities provided by `@loop-kit/ui`. |
| Property descriptor / value reference | Portable editor metadata / source-and-key identity in `@loop-kit/ui`. These do not yet constitute a general expression engine, asset-reference resolver or shared persistence system. |

The direction is authored, inspectable configuration rendered by trusted adapters, with explicit service bindings and ownership. Reuse the current descriptors, controllers and guest bindings before adding another settings model. Station's asset references, theme resolution and widget placement remain product responsibilities unless a proven portable contract is extracted upstream. Keep runtime installation, instantiation, activation and execution separate.

Open investigations include richer property evaluation, remote machines/providers and alternative Component-to-DOM transport. No choice of transport, DOM protocol or WASI version is made here. Evaluate these against cancellation, resource lifetime, accessible rendering, capability denial and version compatibility; a DOM protocol alone does not establish guest isolation. Do not confuse the implemented document/semantic Component adapters with a generic Component/native/remote capability-provider adapter. The Rust host and isolated WASIP3 probe retain their own evidence, as described above and in [the probe README](experiments/wasip3/README.md).

## Enforced package ownership

`tooling/architecture-policy.json` is the versioned owner and dependency policy. `bun run repo check` resolves imports and re-exports, literal dynamic imports, import types, TypeScript aliases and real filesystem paths using the TypeScript compiler resolver. Both runtime and type-only imports count toward cycles. Computed module specifiers fail until reviewed as an exact exception. `bun test tooling` supplies deliberate rejection fixtures. CI runs these checks and consumes packed packages outside the workspace.

| Package | Owner | Role and allowed package dependencies |
| --- | --- | --- |
| `@loop-kit/capabilities` | Loop Kit runtime | Portable contracts; no workspace dependency |
| `@loop-kit/host` | Loop Kit runtime | Provider resolution, resource scopes, leases and disposal; capabilities |
| `@loop-kit/ui` | UI interaction | Renderer-independent semantic data, events and recording adapter; no workspace dependency |
| `@loop-kit/scripting` | Loop Kit runtime | Authored execution contracts and explicitly injected guest bindings; capabilities and ui |
| `@loop-kit/workspace` | Loop Kit authoring | Immutable text source/build/change-request contracts; no package dependency |
| `@loop-kit/host-browser` | Browser runtime | Official browser composition/bootstrap; host and ui |
| `@loop-kit/host-native` | Native runtime | Typed native composition and semantic process bridge; host and ui |
| `@loop-kit/renderer-dom` | UI interaction | Trusted semantic-to-DOM presentation; host and ui |
| `@loop-kit/component-polyengine` | Component runtime | Dedicated worker document/semantic and import-free string-call adapters; ui |

The graph includes `host → capabilities`, `scripting → capabilities, ui`, `host-browser/host-native/renderer-dom → host, ui`, and `component-polyengine → ui`; workspace and ui have no package dependencies. The policy file is the machine-checked owner of this graph. No package imports Station or the optional Rust implementations. Root exports are the only current npm entrypoints; publishing source for declaration maps does not make private paths an API. Runtime-installable Station contributions are a separate concept from these npm packages.

Package boundaries and internal roles are separate checks. Contracts contain identities and public schemas; domain contains pure algorithms and invariants; application implements use cases through injected ports; providers implement concrete ports; presentation adapts typed state and actions; composition constructs implementations and owns startup/disposal. Dependencies point inward: domain to contracts, application to domain/contracts, providers and presentation to those inward roles, composition to all roles. Providers and presentation cannot import each other. Cohesive packages may contain multiple roles; folders named for roles or explicit longest-prefix policy overrides identify internal boundaries. Current single-module packages have a default role. No speculative package split is required.

Inward code cannot import React/platform modules or read browser globals. Resource ownership is independent of authorization: host scopes and abort signals release and cancel work, while Station decides grants. Prefer small `createX` factories and specialized dependency ports over a service locator. Public reusable APIs document invariants, failures, cancellation and disposal beside their code; examples belong with reusable contracts, not decorative private comments.

Exceptions require exact file, target, rule, owner and reason, with a reviewed `exceptionLimit`. The current limit is zero. Diagnostics identify source, resolved target, rule and the public package entrypoint where applicable. No unknown dependency can be made legal by silently expanding a path wildcard.

## Source and native ownership

The `packages/*/src` trees are authoritative TypeScript implementation sources; `dist` is generated and package exports resolve there. `bun run repo context <package> --json` includes each real source path, exports, direct dependencies, reverse dependents and verification command. Station may consume snapshots or optional developer symlinks; it does not move this repository's Git history or CI ownership.

`crates/loop-host` and `crates/loop-cli` are active existing Rust release code, not obsolete code and not the current TypeScript host's implementation. The CLI's embedded starters live under `crates/loop-cli/templates`; existing Windows release, bootstrap and installation scripts remain necessary. `experiments/wasip3` is experimental. The scripting engine's pinned optional WASM build is separate from ordinary TypeScript consumers; this task does not claim fresh engine/native acceptance.

## Repository commands and agent handoff

- `bun run repo graph --json`: manifests, realpaths, resolved source edges and violations.
- `bun run repo check`: package/layer enforcement and manifest checks.
- `bun run repo affected [--base REF] --json`: tracked diff plus untracked files, changed packages and reverse dependents in dependency order. Shared policy/lock/root changes affect all packages.
- `bun run repo verify <package>`: build, typecheck and tests for that package and its dependency closure, then architecture fixtures.
- `bun run verify`: full TypeScript regression plus packed-consumer validation. Rust release gates remain in their existing workflow.
- `bun run repo context <package> --json`: compact machine-readable ownership and public API context.
- `bun run watch`: initial build and serialized dependency-ordered rebuilds of workspace packages after source edits. This refreshes linked `dist` and declarations without publishing.

An agent task names owned files/packages, public dependencies, forbidden changes, checks and acceptance evidence. Architecture/integration owns shared contract changes, Loop Kit runtime owns host/scripting, Station product/asset owns product contracts, UI/interaction owns surface adapters, verification/security independently reviews policy and evidence. These are assignments, not five always-running processes. One integrating owner coordinates a shared contract; agents must not edit it concurrently. Handoffs include changed sources, contract effects, unresolved issues and one next recommended slice. See `ENGINEERING_PLAN.md` for the active gate.

