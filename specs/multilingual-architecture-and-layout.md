# RFC: Multilingual Host Architecture and Symmetric Crate/Package Layout

Status: Proposed (pre-publish architecture decision; no refactoring started).
Baseline: `main` at `d1a96b4` (9 npm packages under `packages/`, 2 Rust crates under `crates/`).

## Recommendation (Summary)

Before publishing to npm or crates.io, adopt a **Contract-First Hybrid (Option C)** with a **symmetric 4-layer layout**:

1. **Share canonical contracts and behavioral parity first, not a mandatory WASM runtime kernel.** Keep **WIT under `contracts/` as the canonical source of truth** (WKG/WAC-compatible; declarative TS/Rust SDKs sit above it as ergonomic authoring/wiring layers) alongside wire/manifest schemas. Organize language-agnostic JSON test vectors under `conformance/` keyed by contract version (covering positive, adversarial denial, and manifest/wire migration cases), and run them in CI against both Rust and TypeScript.
2. **Extract a pure, no-IO `loop-core` Rust crate now, without forcing a `.wasm` dependency onto TypeScript consumers yet.** Keep `loop-core` strictly `wasm32-unknown-unknown`-clean (zero `tokio`, `wasmtime`, `wry`/`tao`, or OS I/O), including pure manifest/compatibility/migration validation (`manifest`/`compat`). Promote specific high-complexity, synchronous host-side kernels (such as a future policy evaluator or semantic UI tree differ) to a small zero-dep `.wasm` module (`@loop-kit/core-wasm`) or C/Python FFI *only* when drift risk or a third host language justifies the bundler/boundary cost.
3. **Make Rust and TypeScript naming symmetric before first publish.** Split Rust `loop-host` into `loop-core` (pure state/policy/validation/compat) and `loop-host-native` (Wasmtime + WASI + OS kits + optional `desktop` feature), alongside `loop-cli` (`publish = false`). Do **not** create a `loop-host-browser` Rust crate. On the TypeScript side, keep platform-specific adapters (`@loop-kit/host-browser`, `@loop-kit/host-native`, `@loop-kit/renderer-dom`, `@loop-kit/component-polyengine`) and pure domain packages (`@loop-kit/ui`, `@loop-kit/workspace`, `@loop-kit/scripting`), and decide whether to fold `@loop-kit/capabilities` + `@loop-kit/host` into `@loop-kit/core` (8 packages, exact symmetry with `loop-core`) or keep the current 9 package names unchanged.

---

## Context and Current Asymmetry

Today, Loop Kit has two implementation paths that evolved independently (see [ARCHITECTURE.md](../ARCHITECTURE.md)):

- **TypeScript (`packages/*`, 9 packages at `0.1.0`, root-only exports):**
  - Pure / no-platform-IO: `@loop-kit/capabilities` (identity contracts), `@loop-kit/host` (in-process scopes, leases, services, host-kit resolution), `@loop-kit/ui` (semantic UI schemas, keyed revision/event state, `packages/ui/wit/surfaces.wit`), `@loop-kit/workspace` (snapshots, build receipts, generation/stale-replacement lifecycle), `@loop-kit/scripting` (guest callback SDK + injected host bindings).
  - Platform / runtime adapters: `@loop-kit/host-browser` (browser composition, worker, WebGPU), `@loop-kit/host-native` (native kit metadata + strict JSON framing over an injected process bridge), `@loop-kit/renderer-dom` (DOM renderer with focus/selection restoration; no general tree diff module yet), `@loop-kit/component-polyengine` (Polyengine runtime/worker integration).
- **Rust (`crates/*`, 2 crates at `0.1.1`):**
  - `loop-host` mixes pure policy/validation (`document_runtime/policy.rs`, grant/Notes policy, view/action validation), Wasmtime 48 component execution (`wasmtime`, `wasmtime-wasi`, `tokio`), native kit orchestration, and optional Windows desktop GUI (`wry`/`tao` under the `desktop` feature). Its WIT lives at `crates/loop-host/wit/application.wit`.
  - `loop-cli` (`publish = false`, binary `loop`) wraps `loop-host` with CLI commands, `dev` scaffolding, and subprocess framing (`config_process.rs`).

Three pre-publish problems follow from this layout:

1. **Naming collision:** `@loop-kit/host` is a platform-neutral lifecycle core, while Rust `loop-host` is a Wasmtime + desktop native host.
2. **Scattered contracts and conformance:** WIT files live in both `packages/ui/wit/` and `crates/loop-host/wit/`, and conformance tests live separately in `crates/loop-host/src/document_runtime/conformance.rs` and `tooling/host-browser/conformance-worker.ts`.
3. **Coupled Rust crate:** Pure policy and validation logic in `loop-host` cannot be tested, reused, or compiled to `wasm32` without pulling in `wasmtime` and `tokio`.

---

## Real-World Multi-Host WASM Precedents

| Project | Architecture Pattern | How Host Logic Is Shared | Practical Tradeoffs |
| --- | --- | --- | --- |
| **Wasmtime + JCO** ([wasmtime](https://github.com/bytecodealliance/wasmtime), [jco](https://github.com/bytecodealliance/jco), [preview2-shim](https://bytecodealliance.github.io/jco/wasi/preview2-shim.html)) | **Option A:** Shared WIT contracts + cross-runtime conformance suite + idiomatic per-language host shims | WIT (`wasi:*` 0.2/0.3) is the single source of truth. Rust implements host imports in `wasmtime-wasi`; JS/browser implements them in `@bytecodealliance/preview2-shim`. Parity is verified by running Wasmtime's WASI conformance suite against JCO/Node while allowing capability-safe browser differences. | Idiomatic async, zero WASM-in-JS marshaling overhead, clean bundler story. Requires maintaining parallel host implementations backed by strict conformance tests. |
| **Extism** ([extism/extism](https://github.com/extism/extism), [extism/js-sdk](https://github.com/extism/js-sdk), [kernel](https://github.com/extism/extism/blob/main/kernel/Cargo.toml)) | **Option C (Hybrid):** Tiny zero-dep Rust WASM kernel + idiomatic host runtimes | Native hosts (Rust, C `libextism`, Python/Go/Ruby via C FFI) wrap Wasmtime. JS (`@extism/extism`) and Java (`chicory-sdk`) use the host's native WASM runtime and implement `Plugin`, manifests, config, and host-function callbacks natively. Every host embeds a tiny zero-dependency Rust-to-WASM kernel (`extism-runtime-kernel`) for linear-memory allocation and ABI state. | Proves that compiling *only* a tiny, synchronous, zero-dep kernel to WASM works across browsers and native hosts while keeping async host glue and callbacks native. |
| **wasmCloud** ([wasmCloud/wasmCloud](https://github.com/wasmCloud/wasmCloud)) | **Single-language host + WIT boundary** | Rust owns the embeddable host runtime (`crates/wash-runtime`, wrapping Wasmtime with capability plugins) and CLI (`crates/wash`); top-level `wit/` holds shared contracts. TypeScript and Go live in separate repos for guest components or out-of-process providers, not browser-native hosts. | Strong model for Rust crate separation (`wash-runtime` vs `wash` + top-level `wit/`), but does not solve browser-native JS host sharing on its own. |
| **Cedar & OPA** ([cedar-policy/cedar](https://github.com/cedar-policy/cedar), [OPA Wasm](https://www.openpolicyagent.org/docs/wasm)) | **Option B (for pure evaluators):** Pure core compiled to WASM for JS + native crate | Cedar separates `cedar-policy-core` (pure Rust evaluator/validator) from `cedar-policy` (Rust API), `cedar-policy-cli`, and `cedar-wasm` (JS/TS wrapper). OPA compiles Rego policies to pure no-IO `.wasm` modules with a versioned ABI where hosts supply memory and builtin callbacks. | Eliminates semantic drift for complex, security-critical synchronous evaluators. Worth the WASM boundary cost *once* the core logic is too complex to reimplement safely. |

---

## Comparison of Sharing Options

We need to share pure deterministic logic (capability identities, scopes/leases, grants/policy, lifecycle state machines, UI semantic validation/diffing, workspace receipts, manifest/compatibility checks, framing) across Rust, TypeScript, and future host languages—without compiling Wasmtime to WASM and while keeping platform shims (DOM/WebGPU, Wasmtime, Wry/Tao, OS processes) native.

### Option A: Shared WIT Contracts + JSON Conformance Suite + Idiomatic Cores in Rust & TS

- **How it works:** Authoritative WIT + wire schemas live in `contracts/`. Language-agnostic JSON test fixtures live in `conformance/` and run in CI against both `loop-core` (Rust) and `@loop-kit/*` (TypeScript). Each host language implements the pure state machines idiomatically.
- **Strengths:**
  - Zero WASM-in-JS tax: no async `.wasm` init, no bundler/Vite/Workers asset headaches, no CSP `wasm-unsafe-eval` issues, no JS↔WASM serialization on hot UI/lifecycle paths.
  - Preserves existing repo invariant: ordinary TS consumers have no native or binary dependency (`packages/AGENTS.md`).
  - Matches Wasmtime + JCO directly and fits Loop Kit's current pure-core size (hundreds of lines per domain, not a compiler or full policy language).
- **Weaknesses:**
  - Re-implements pure rules per host language; adding Python or C hosts later multiplies maintenance unless a native core is exposed.
  - Relies on conformance suite completeness (including denial/mutation tests) to catch drift.

### Option B: Pure No-IO Rust Core (`loop-core`) Compiled to WASM (JS) + Native Crate/FFI (Rust/C/Python)

- **How it works:** All shared logic lives once in `loop-core` (Rust). Rust hosts link it natively; C/Python hosts link via C-FFI/UniFFI; TypeScript/browser packages wrap a compiled `loop-core.wasm` binary.
- **Strengths:**
  - Single implementation of every policy, lifecycle, UI, and receipt invariant across all host languages.
  - Adding Python, Go, or C hosts later requires only thin FFI wrappers.
- **Weaknesses:**
  - **Premature friction for JS/TS:** Every ordinary TS package (`@loop-kit/host`, `@loop-kit/ui`, `@loop-kit/workspace`) becomes async-initialized or bundler-sensitive.
  - **Awkward boundary for live host objects:** Scopes and leases in `@loop-kit/host` own live JS disposers, callbacks, and `AbortSignal`s; mirroring handle tables across WASM adds indirection for simple Map/Set transitions.
  - **Coupled release pipeline:** Every npm release now requires Rust `wasm32` builds and binary artifact verification.

### Option C (Recommended): Contract-First Hybrid (Option A Now, Option B Promotion Path)

- **How it works:**
  1. **Foundation (now, pre-publish):** Establish `contracts/` (canonical WIT + schemas) and `conformance/` (contract-versioned JSON vectors, including migration fixtures) as the source of truth, and keep **both** Rust (`loop-core`) and TypeScript (`packages/*`) pure, zero-IO, and conformance-tested.
  2. **Architectural discipline in Rust:** Build `loop-core` from day one with zero I/O, zero `tokio`, zero `wasmtime`, and CI verification that `cargo check -p loop-core --target wasm32-unknown-unknown` passes.
  3. **Targeted promotion (later, only when triggered):** Keep async host glue, live callbacks, and lightweight scope/lease containers native in each language permanently. Pure/virtualizable capabilities with a WIT contract can ship directly as standard WKG/WAC WASM Components; promote *only* specific synchronous, high-complexity trusted host-side kernels (e.g., an expressive policy/grant evaluator, a general UI semantic tree differ, or a 3rd host language via C/Python FFI) to a tiny zero-dep `.wasm` kernel (Extism/Cedar pattern) behind the existing package APIs and conformance suite.
- **Why this wins without overengineering:**
  - Ships clean, idiomatic, zero-WASM-friction npm packages and crates today.
  - Solves the immediate risk (Rust/TS drift) with `contracts/` + `conformance/` rather than premature WASM marshaling.
  - Preserves a zero-rewrite escape hatch to Option B for any submodule that grows complex enough to warrant a single Rust binary kernel.

**Explicit promotion triggers (when to introduce a `.wasm` or FFI kernel):**
- A pure submodule exceeds ~1,500–2,000 LOC of tricky branching/algorithmic logic (e.g., full semantic tree diffing, SAT/PubGrub version solving, or complex capability policy evaluation) where conformance vectors alone feel brittle; **or**
- A third host language (Python, C/C++) enters active support and needs `loop-core` via C-FFI/UniFFI.

---

## Proposed Symmetric Crate & Package Layout

### 4-Layer Architecture

| Layer | Responsibility | Shared Root | Rust Crates (`crates/`) | TypeScript Packages (`packages/`) |
| --- | --- | --- | --- | --- |
| **0. Contracts & Conformance** | Canonical WIT interfaces (WKG/WAC-compatible), versioned wire/manifest schemas, contract-versioned JSON test vectors (positive, adversarial denial, and migration cases) | `contracts/`, `conformance/` | *(test/build inputs)* | *(test/build inputs)* |
| **1. Pure Core (no-IO)** | Capability IDs, grants/policy, scopes/leases, UI semantic schemas & validation, workspace snapshots/receipts, manifest/compat & migration validation, strict framing | — | `loop-core` *(pure, `wasm32`-clean; internal modules `capabilities`, `policy`, `lifecycle`, `ui`, `workspace`, `manifest`/`compat`, `framing`)* | `@loop-kit/core` *(capabilities + host lifecycle/kits + compat/framing)*, `@loop-kit/ui`, `@loop-kit/workspace` |
| **2. Host Runtimes & Bridges** | WASM component execution, async host glue, platform capabilities, registry/OCI/filesystem I/O | — | `loop-host-native` *(Wasmtime + WASI + native kits + optional `desktop` feature)* | `@loop-kit/host-browser` *(browser WASM/JCO + workers + WebGPU)*, `@loop-kit/host-native` *(TS bridge to `loop-host-native`)* |
| **3. Renderers, Guest SDKs & Apps** | UI renderers, guest authoring SDKs, optional engine adapters, CLI | — | `loop-cli` (`publish = false`, `loop` bin); future `loop-guest` | `@loop-kit/renderer-dom`, `@loop-kit/scripting` *(guest SDK)*, `@loop-kit/component-polyengine` |

### Key Naming & Boundary Decisions

1. **Split `loop-host` into `loop-core` + `loop-host-native`:**
   - Resolves the current ambiguity where `loop-host` in Rust meant "Wasmtime + desktop host" while `@loop-kit/host` in TS meant "platform-neutral lifecycle core."
   - Keeps `manifest`/`compat` (pure manifest parsing, contract-semver compatibility resolution, and migration transforms) inside `loop-core` rather than adding another crate, while keeping OCI/WKG/registry fetching and filesystem caching in `loop-cli` (or an I/O resolver in `loop-host-native`). Guest/project compatibility checks validate against `loop-core`'s contract semver table rather than exact CLI binary versions.
   - Keeps `desktop` (`wry`/`tao`) as a Cargo feature on `loop-host-native` for now (avoiding a separate `loop-desktop` crate until a second desktop shell or independent release cadence justifies it).
   - **No `loop-host-browser` Rust crate:** Browser hosting stays in TypeScript (`@loop-kit/host-browser`) using the browser's native WASM runtime and JCO/transpiled bindings.
2. **TypeScript package granularity (8 vs. 9 packages):**
   - **Recommended (8 packages):** Fold tiny `@loop-kit/capabilities` + `@loop-kit/host` into `@loop-kit/core`, keeping `@loop-kit/ui` and `@loop-kit/workspace` separate because they have zero dependency on host lifecycle and tree-shake cleanly for UI-only or workspace-only consumers. This gives exact naming symmetry with `loop-core`.
   - **Minimal-churn alternative (9 packages):** Keep all 9 current npm package names as-is (zero TS import renames) and only clarify in docs that `@loop-kit/capabilities` + `@loop-kit/host` + `@loop-kit/ui` + `@loop-kit/workspace` collectively mirror Rust `loop-core`.
   - Either way, keep root-only exports (`packages/AGENTS.md`) and avoid a dumping-ground package that mixes pure logic with DOM, Wasmtime, or engine adapters.
3. **Why Rust uses one `loop-core` crate while TS uses 3–4 focused pure packages:**
   - In Cargo, one cohesive `loop-core` crate with well-scoped modules (and optional Cargo features if needed) avoids multi-crate version-lockstep boilerplate and keeps `crates.io` publishing simple (`loop-core` + `loop-host-native`).
   - In npm, separate `@loop-kit/core`, `@loop-kit/ui`, and `@loop-kit/workspace` packages match JS ecosystem expectations (minimal install surface, zero circular deps, independent consumer graphs).
4. **Canonical WIT and two capability tiers:**
   - **WIT under `contracts/` is canonical** for all shared and published contracts so WKG, WAC, `wit-bindgen`, `jco`, and WIT semver tooling work natively. Declarative TS/Rust SDKs sit *above* canonical WIT for ergonomic authoring and wiring (and optional draft WIT export during local prototyping).
   - **Two capability tiers:** (i) *Platform-bound & authority-owning capabilities* (DOM/WebGPU, Wry/Tao, OS filesystem/processes, live host callbacks, grant/policy enforcement) stay native host code; (ii) *pure/virtualizable/middleware capabilities* can ship as portable Loop Kit WASM Components distributed via WKG and composed via WAC. Composed capability components remain sandboxed bytecode—WAC composition never bypasses host grant checks or mints authority, and coarse-grained boundaries should be preferred in browsers to avoid per-frame JCO marshaling overhead.

---

## Minimal Migration Path (Pre-Publish)

Execute in four small, independently verifiable slices—no big-bang rewrite:

1. **Slice 1 — Contracts & Conformance Foundation (non-breaking):**
   - Create root `contracts/` (consolidating canonical WIT from `crates/loop-host/wit/application.wit` and `packages/ui/wit/surfaces.wit` in a WKG/WAC-compatible layout, plus versioned JSON wire/manifest schemas).
   - Create root `conformance/` keyed by contract version with initial JSON test vectors covering: capability grant/denial policy, scope/lease disposal & revocation, UI frame/revision/event validation, workspace receipt/stale-generation checks, manifest/wire migrations, and strict JSON framing.
   - Wire both `cargo test` and `bun test` to run `conformance/` in CI.
2. **Slice 2 — Extract Rust `loop-core` (workspace-internal):**
   - Create `crates/loop-core` (zero `tokio`/`wasmtime`/`wry`), moving pure policy (`document_runtime/policy.rs`), grant checks, view/action validation, framing/receipt types, and pure `manifest`/`compat` resolution out of `loop-host` and `loop-cli`.
   - Add `cargo check -p loop-core --target wasm32-unknown-unknown` to CI as a permanent no-IO guardrail.
3. **Slice 3 — Rename `loop-host` → `loop-host-native` (pre-crates.io publish):**
   - Rename `crates/loop-host` to `crates/loop-host-native` (updating `Cargo.toml`, `crates/loop-cli`, scripts, and docs). Keep `desktop` as a feature flag.
4. **Slice 4 — Optional TS Consolidation (pre-npm publish):**
   - If adopting the 8-package layout, fold `@loop-kit/capabilities` + `@loop-kit/host` into `@loop-kit/core` and update internal workspace dependencies + `RELEASING.md` / `bun run verify`. (Skip Slice 4 if keeping the 9-package layout.)

---

## Non-Goals & Deferred Work

- **Non-goals:** No Wasmtime-in-WASM; no mandatory `loop-core.wasm` in TS packages before first publish; no splitting `desktop` (`wry`/`tao`) into its own crate yet; no refactoring in this RFC branch.
- **Companion RFC (tracked separately):**
  - [Issue #11](https://github.com/isaac10334/loop/issues/11) (`specs: draft companion RFC specs/versioning-and-contract-lifecycle.md`): 3-axis versioning model (WIT contract semver vs. crate/npm semver vs. WASI/toolchain ABI profile), interface evolution and manifest migration guarantees, WKG/WAC publishing & authority rules, and post-publish static tag-based docs versioning in CI.
- **Deferred (trigger-gated):**
  - `crates/loop-core-wasm` + `@loop-kit/core-wasm`: defer until a pure trusted host-side kernel (policy engine, dependency solver, or semantic UI tree diff) hits the complexity trigger.
  - `crates/loop-core-ffi` (C/Python bindings): defer until a non-Rust, non-JS host language is actively targeted.
  - `crates/loop-guest`: defer until Rust guest authoring needs shared helpers beyond generated `wit-bindgen` bindings.

---

## Acceptance Criteria for Approving This RFC

1. Confirm **Option C (Contract-First Hybrid)** as the pre-publish sharing strategy, canonical WIT under `contracts/`, and the explicit WASM/FFI promotion triggers.
2. Confirm the Rust 3-crate split (`loop-core` including `manifest`/`compat`, `loop-host-native`, `loop-cli`) with `desktop` kept as a feature flag and no `loop-host-browser` Rust crate.
3. Choose between **8 TS packages** (`@loop-kit/core` unifying `capabilities` + `host`) vs. **9 TS packages** (keep current npm names unchanged) before running `bun run release:prepare`.
