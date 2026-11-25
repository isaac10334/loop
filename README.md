# Loop Kit

[![TypeScript CI](https://github.com/isaac10334/loop/actions/workflows/typescript.yml/badge.svg)](https://github.com/isaac10334/loop/actions/workflows/typescript.yml)
[![Knowledge Checks](https://github.com/isaac10334/loop/actions/workflows/knowledge.yml/badge.svg)](https://github.com/isaac10334/loop/actions/workflows/knowledge.yml)
[![Status: Pre-alpha](https://img.shields.io/badge/status-pre--alpha-d97706)](docs/public/support.md)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-2563eb)](LICENSE-MIT)
[![Docs](https://img.shields.io/badge/docs-reference-0f766e)](https://isaac10334.github.io/loop/docs/)
[![Discord](https://img.shields.io/badge/Discord-Join%20community-5865F2?logo=discord&logoColor=white)](https://discord.gg/pbrqMSXbWM)

Loop Kit is an experimental SDK and runtime architecture for building software out of swappable, typed parts.

The core idea is straightforward: define capabilities as explicit typed contracts, wire concrete providers at the host boundary, acquire resources inside a scope with deterministic cleanup, and keep UI semantics decoupled from whatever renderer draws them. The same contracts are meant to span ordinary in-process TypeScript and WebAssembly Component Model guests without locking your application into one host, one renderer, or a pile of ambient global singletons.

> **Honest status:** Loop Kit is pre-alpha and **not quite usable yet** as a drop-in library. The TypeScript packages are not published to npm (source builds only for now), the TypeScript runtime and the Rust Wasmtime host/CLI are still two separate implementation paths rather than one unified bridge, and much of the broader vision (full polyglot component composition, renderer ecosystem, engine adapters) is still in progress. Check the [capability support matrix](docs/public/support.md) for what actually works and is tested today versus what is still proposed.

---

## Why this exists

Most interactive tools, editors, and games end up tightly coupled to their host environment, their UI framework, and hidden global state. Swapping a storage backend, isolating an untrusted script, or running the same logic in a browser, a desktop window, and a headless test harness turns into a rewrite.

Loop Kit approaches this from a few narrow, composable primitives:

- **Typed capability contracts** (`@loop-kit/capabilities`) — stable contract identities paired with TypeScript service shapes, independent of package versions.
- **Explicit resource ownership and scopes** (`@loop-kit/host`) — capabilities are acquired as handles inside a scope; revoking a scope or disposing a host deterministically tears down everything it owns.
- **Host-controlled authority** — guests and scripts only get the bindings a host explicitly grants them. Plain metadata objects never grant authority on their own.
- **Renderer-independent UI** (`@loop-kit/ui`, `@loop-kit/renderer-dom`) — portable semantic surface trees and interaction events, with concrete renderers plugged in at the host layer.
- **Bounded authored execution and portable workspaces** (`@loop-kit/scripting`, `@loop-kit/workspace`) — explicit guest bindings, immutable source snapshots, build receipts, and checked change requests.
- **Optional WebAssembly Component Model path** (`crates/loop-host`, `crates/loop-cli`) — a Rust Wasmtime host and Windows authoring CLI for native/component apps, currently maintained alongside the TypeScript-first SDK.

## A quick look at the API

Ordinary TypeScript can define a capability, register a provider, acquire a handle inside a scope, and tear everything down cleanly — no WebAssembly required:

```ts
import { defineCapability } from "@loop-kit/capabilities";
import { createHost } from "@loop-kit/host";

interface Greeting {
  greet(name: string): string;
}

const greeting = defineCapability<Greeting>({
  id: "unit:hello/greeting",
  version: "1.0.0",
});

const host = createHost();
host.provide(greeting, {
  create: () => ({ greet: (name) => `Hello, ${name}` }),
});

const scope = host.scope();
const handle = await scope.acquire(greeting);
console.log(handle.value.greet("world"));

await handle.release();
await scope.revoke();
await host.dispose();
```

## Trying it from source

Since packages are not published to npm yet, running from a local checkout with [Bun](https://bun.sh/) is the best way to kick the tires:

```powershell
bun install
bun run build
bun run typecheck
bun test
```

From there, see the [browser application quick start](docs/public/quickstart.md) and [runnable examples](docs/public/examples.md).

You can also inspect portable workspace snapshots without executing any project code:

```powershell
bun run workspace snapshot <directory> <output.json>
```

See [workspace contracts](packages/workspace/README.md), the [WIT/content mapper proof](tooling/fixtures/wit/README.md), and [portable development](docs/portable-development.md) for how that fits together.

## Repository layout

### TypeScript packages

| Package | Path | Purpose |
| --- | --- | --- |
| `@loop-kit/capabilities` | [`packages/capabilities`](packages/capabilities/README.md) | Typed runtime identities for capability contracts |
| `@loop-kit/host` | [`packages/host`](packages/host/README.md) | In-process provider registration, scopes, handles, and lifecycle |
| `@loop-kit/ui` | [`packages/ui`](packages/ui/README.md) | Portable semantic surfaces and guest interaction contracts |
| `@loop-kit/scripting` | [`packages/scripting`](packages/scripting/README.md) | Bounded scripting execution contracts and guest SDK |
| `@loop-kit/workspace` | [`packages/workspace`](packages/workspace/README.md) | Immutable source snapshots, build receipts, and checked change requests |
| `@loop-kit/host-browser` | [`packages/host-browser`](packages/host-browser/README.md) | Browser host adapter |
| `@loop-kit/host-native` | [`packages/host-native`](packages/host-native/README.md) | Native host adapter |
| `@loop-kit/renderer-dom` | [`packages/renderer-dom`](packages/renderer-dom/README.md) | DOM renderer adapter for `@loop-kit/ui` surfaces |
| `@loop-kit/component-polyengine` | [`packages/component-polyengine`](packages/component-polyengine/README.md) | Polyengine component adapter |

### Rust crates, tooling, and docs

| Path | Purpose |
| --- | --- |
| [`crates/loop-host`](crates/loop-host) | Wasmtime Component Model and desktop/headless host |
| [`crates/loop-cli`](crates/loop-cli) | Windows component application authoring CLI |
| [`experiments/wasip3`](experiments/wasip3) | Isolated async Component Model probe and current JS limitations |
| [`docs/`](docs/README.md) | Public guides, reference docs, and alpha execution notes |
| [`specs/`](specs/README.md) | Proposed specifications and design gates (not promises of current support) |
| [`skills/`](skills) | Repo-local skills for writing, host kits, and GitHub workflows |
| [`site/`](site) | Static landing page and generated SDK documentation builder |

## Investigating the architecture

If you are reading the repo to see how the pieces fit together (or deciding whether the model makes sense for what you build), these are the best starting points:

- [Public overview](docs/public/overview.md) and [core concepts](docs/public/concepts.md) — high-level mental model and vocabulary
- [Capability support matrix](docs/public/support.md) — honest breakdown of what is implemented, tested, or still planned
- [ARCHITECTURE.md](ARCHITECTURE.md) — dual TypeScript/Rust paths, authority boundaries, and host vs. downstream ownership
- [DECISIONS.md](DECISIONS.md) — settled architectural decisions and rationale
- [QUESTIONS.md](QUESTIONS.md) — open product and trust questions still being worked out
- [Generated SDK docs](https://isaac10334.github.io/loop/docs/) — browseable reference built from `site/`
- [Roadmap](docs/public/roadmap.md) — where this is headed once the foundations settle

## Contributing

Contributions, design critiques, and bug reports are welcome — especially around capability ergonomics, lifecycle edge cases, and renderer/host boundaries.

1. Read the [development workflow](docs/reference/agent-workflow.md) for branch/PR conventions and repo tooling.
2. Run focused checks while iterating on a package:
   ```powershell
   bun run repo context <package>
   bun run repo check
   bun run repo verify <package>
   ```
3. Before opening a PR that touches packages, tooling, `skills/`, or embedded CLI assets, run the full verification gate:
   ```powershell
   bun run verify
   ```
4. If you edit docs or knowledge pointers, check links with `bun run knowledge links` (and `bun run knowledge check` for vault edits).

### Rust host and CLI

You do not need an installed `loop` binary to develop the Rust side. After `bun install --frozen-lockfile`:

- `scripts/build-cli.ps1` rebuilds SDK output, embedded tools, and the CLI.
- `scripts/install-dev.ps1` installs or updates a separate `loop-dev` command without touching any stable `loop.exe`.
- `scripts/test-cli.ps1 -Binary <path-to-built-cli>` runs relocated smoke checks.

Validate Rust changes with:

```powershell
cargo fmt --all --check
cargo test --locked --workspace --all-features
cargo clippy --locked --workspace --all-features --all-targets -- -D warnings
```

See [Windows development setup](crates/loop-cli/WINDOWS.md#development-checkout-no-installed-loop-required) for prerequisites and PATH setup.

### Releases and packaging

Packaging, version-bump policy, dry-run checks, and publishing workflows live in [RELEASING.md](RELEASING.md) and [`.github/WORKFLOWS.md`](.github/WORKFLOWS.md).

## Community and draft prompts

- **Discord:** Join the [Loop Kit Discord](https://discord.gg/pbrqMSXbWM) to ask questions, poke at the architecture, or share feedback.
- **Draft agent prompts:** We are currently keeping a working scratchpad of Loop Kit agent prompts in [this Affine doc](https://app.affine.pro/workspace/1ceec593-ccac-4ed8-8e28-0e1a3d6b68f9/ZRps4ivnXuQSmVI8y9iaK) while a better prompt-drafting workflow takes shape. Since Affine doesn't easily let outside readers leave comments, drop any suggestions or edits in the Discord.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE).
