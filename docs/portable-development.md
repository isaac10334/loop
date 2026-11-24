# Portable package development proof

Selected and implemented October 28, 2026. This is a bounded development substrate,
not a new universal runtime, asset database or managed cloud service.

## Ownership

- Loop `@loop-kit/workspace`: immutable bounded source, pinned dependency identities,
  build provider/receipt types and checked change requests. No host application imports.
- Loop capabilities: optional immutable WIT provenance; host reflection retains it.
  Existing ID/version matching and cooperative lifecycle semantics remain intact.
- Loop development tooling: actual WIT parsing/codegen, TS7.1 content mapping,
  explicit file snapshots and GitHub REST adapter.
- Independent `loop-svg-editor` repository: source/controller/static SVG validation,
  one portable UI and standalone/host application public-SDK document adapters.
- host application: current store, permissions, package preparation/installation, opened-asset
  bindings, sandbox, production renderer and concrete compiler providers.

The editor is a TypeScript web contribution. Its WIT resource contract/codegen
proof is not a claim that the editor UI already executes as a Rust/WASM Component.
The existing Rust CLI/application ABI is preserved and has not been promoted into
a generic package host by this work.

## Source and Git change requests

A file workspace declares `loop.package.json` with `version: 1`, an `id`, explicit
`sourcePaths` and optional `dependencies` as pinned repository/asset/revision refs.
The manifest itself always participates in source identity. Paths never imply authority. The adapter rejects source symlinks, virtual traversal,
case collisions, invalid OS names and oversized closures. Snapshots include exact
UTF-8 text and dependency pins; binary dependency tarballs stay separate.

```powershell
bun run workspace snapshot C:/src/ilt/loop-svg-editor target/svg-editor-source.json
bun run workspace change C:/src/ilt/loop-svg-editor 23652ca007ee0a950a2ad6c660d9e3d521c49072 isaac10334/loop-svg-editor target/svg-editor-change.json
```

The example repository name is the intended projection destination, not evidence
that a remote repository exists. The independent local repository has no remote.
The concrete request changes `src/ui.ts` and `test/editor.test.ts`; the adjacent
base/next snapshot JSON makes it reviewable. Each path records its expected base
digest, including explicit additions/deletions. Dependency-pin changes currently
reject; lockfile projection and general merging are later contracts.

Submission is a separate explicit operation:

```powershell
# Supply a repository-scoped credential through the process environment.
# Do not store the credential in source, request JSON or a package.
bun run workspace submit target/svg-editor-change.json isaac10334/loop-svg-editor main
```

The CLI reads `GH_TOKEN` only for submission. The injected REST provider restricts
repository and branch namespace; verifies pinned source bytes, parent commit,
complete leaf trees and exact request identity; creates a deterministic branch and
draft PR; reconciles lost responses; and rejects tampering. It never merges or
force-updates refs. GitHub.com only; truncated trees fail closed. This adapter has
protocol tests, not a claimed live remote PR acceptance.

A future Loop Cloud service can host the same adapter with a GitHub App installation
token supplier. Loop login identifies an account; repository installation and narrow
permissions separately authorize GitHub. Webhooks need signature checks, deduplication,
durable storage and retry reconciliation before unattended hosting is claimed.

## WIT and runtime boundaries

Use original WIT for executable resources/imports/exports, generated language bindings
for consumers and JSON for inspected source receipts/control data. Resource handles,
errors and async semantics are not losslessly interchangeable with arbitrary JSON
Schema/gRPC. Current generator pins jco; Polyengine's own bindgen is the eventual
runtime-specific facade adapter. No new WIT namespace replaces host application compatibility IDs.

Dynamic scripting reuses a compiled QuickJS engine, but each unrelated trust/lifetime
boundary needs a separate engine instance/worker. Current evaluator `start` stops a
session without creating a new realm. Compiled engine caching is safe to separate from
mutable VM pooling. Scripts can use only the imports compiled into that engine;
they cannot dynamically acquire arbitrary new WIT imports. Stop owns external effects
and worker termination, not only a cooperative guest flag.

## Verification and remaining gates

The source/contract/adapter tests, packed external consumers and host application acceptance
are recorded in host application's `docs/independent-package-proof.md`. A real fresh Rust cloud
build and execution passed separately; that does not make the TypeScript SVG editor
a Component. Installed desktop/mobile, hostile marketplace confinement, general
Component composition, durable workflows and managed multi-tenant services remain
independent gates. Production host application continues consuming its frozen Loop artifacts;
these new upstream APIs have not been silently released into that dependency set.
