# loop-kit

Loop-kit is becoming a TypeScript-first SDK for typed capabilities and local providers. Ordinary JavaScript can define a contract, register an implementation, acquire it in a scope, and clean it up. WebAssembly is optional.

The current TypeScript runtime is deliberately in-process. The existing Rust CLI and Wasmtime host remain available for native/component applications, but are a separate implementation path.

Start with the [browser application quick start](docs/public/quickstart.md),
[installation and release status](docs/public/installation.md), and
[runnable examples](docs/public/examples.md). The current host-kit implementation
is a source-build/reviewed-pack preview; npm publication is pending. Contributor
plans live separately under `specs/` and `docs/development-alpha/`.

## Start

```powershell
bun install
bun run build
bun run typecheck
bun test
```

```ts
import { defineCapability } from "@loop-kit/capabilities";
import { createHost } from "@loop-kit/host";

interface Greeting { greet(name: string): string }
const greeting = defineCapability<Greeting>({ id: "unit:hello/greeting", version: "1.0.0" });
const host = createHost();
host.provide(greeting, { create: () => ({ greet: name => `Hello, ${name}` }) });
const scope = host.scope();
const handle = await scope.acquire(greeting);
console.log(handle.value.greet("world"));
await handle.release();
await scope.revoke();
await host.dispose();
```

## Repository

| Path | Purpose |
| --- | --- |
| `packages/capabilities` | Contract identities and TypeScript service association |
| `packages/host` | In-process provider registration, scopes, handles and lifecycle |
| `packages/ui` | Portable semantic surfaces and event contracts |
| `packages/scripting` | Authored execution contracts and explicitly injected guest bindings |
| `packages/workspace` | Immutable source snapshots, build receipts and checked Git change requests |
| `crates/loop-host` | Existing Wasmtime Component Model and desktop/headless host |
| `crates/loop-cli` | Existing Windows component application authoring CLI |
| `experiments/wasip3` | Isolated async Component Model probe and its current JS limitation |
| `site`, `scripts`, `.github/workflows` | Existing Windows release, installer and Pages assets |

See [release and canary instructions](RELEASING.md), the generated [SDK documentation](https://isaac10334.github.io/loop/docs/), [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md), and each package README. Rust CLI users: [Windows setup](crates/loop-cli/WINDOWS.md).

Portable authoring: `bun run workspace snapshot <directory> <output.json>` reads
an explicit `loop.package.json` file list without executing it. See
[workspace contracts](packages/workspace/README.md), [WIT/content mapper proof](tooling/fixtures/wit/README.md)
and [the development proof](docs/portable-development.md). Cloud hosting is optional;
the initial GitHub adapter prepares draft pull requests, never merges them.

Contributors can start with the [development workflow](docs/reference/agent-workflow.md).

## Rust CLI development

No installed `loop` is needed to develop Loop Kit. After
`bun install --frozen-lockfile`, use `scripts/build-cli.ps1` to rebuild SDK output,
embedded tools and the CLI, or `scripts/install-dev.ps1` to install/update the
separate `loop-dev` command. Stable `loop.exe` is left untouched. Run
`scripts/test-cli.ps1 -Binary <path-to-built-cli>` for standalone relocated smoke
checks. See [Windows development setup](crates/loop-cli/WINDOWS.md#development-checkout-no-installed-loop-required)
for prerequisites, PATH checks and legacy-install migration.

## Rust status

The prepared Rust host and CLI are 0.1.1; published host/Windows CLI 0.1.0 do not provide the new native-kit APIs. Release the host first, then verify the matching CLI against the registry without a local patch; see [release instructions](RELEASING.md). They implement component hosting, scoped notes grants, desktop/headless execution, and Windows release/install workflows. They are not yet adapters for the TypeScript host. Validate them with `cargo fmt --all --check`, `cargo test --locked --workspace --all-features`, and `cargo clippy --locked --workspace --all-features --all-targets -- -D warnings`.

Licensed under [MIT](LICENSE-MIT) OR [Apache-2.0](LICENSE-APACHE).
