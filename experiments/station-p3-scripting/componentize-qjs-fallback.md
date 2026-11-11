# Deferred compiler option: componentize-qjs

The selected Station scripting path is wasm-rquickjs v0.4.13 on Polyengine 0.6.7.
This option is retained for an explicit future change of compiler. There is no
automatic fallback, permission migration, or second execution system.

## Preserved reproduction

Keep `evaluate-only.wit`/`.js`, `probe.wit`/`.js` and Station's
`apps/station/scripts/probe-p3-scripting.ts`. They demonstrate the difference
between a reusable evaluator that runs and a required async import that fails
during compilation. The script checks the official executable's SHA-256.

- Compiler release: v0.4.5.
- Source commit: `e563c6d6ae50b087980414015663ca9c948c09bb`.
- Windows x64 archive SHA-256:
  `77b0dd43fe54f8090e26430486ae90eba0fd4dc2910d5cd7a5ce7eedd4fb2314`.
- Executable SHA-256:
  `7b4e240a2cd110306144c3a69badb9b05bf08a6e7b3eb841367c8f1dab8f508a`.
- Embedded `wasmtime` and `wasmtime-wasi` dependency: major 47.

Custom async imports fail with `type mismatch with async`, both with and without
`--stub-wasi`. The maintainer identifies the issue in
[componentize-qjs #89](https://github.com/andreiltd/componentize-qjs/issues/89).

## Potential workaround, not verified

The maintainer names Wasmtime fixes
[13821](https://github.com/bytecodealliance/wasmtime/pull/13821) and
[14396](https://github.com/bytecodealliance/wasmtime/pull/14396). The first fixes
async stubs and the second preserves resource aliases. As checked on October 18,
2026, stable 50.0.0 was unpublished; the published
[50.0.0-rc.1](https://github.com/bytecodealliance/wasmtime/releases/tag/v50.0.0-rc.1)
contains the second fix. The issue also offers a maintainer workaround without
publishing its implementation; do not invent or assume that patch.

A separate development build can investigate updating both embedded dependencies
to the exact `=50.0.0-rc.1` release (or an explicitly pinned fixed stable release),
adapting any changed APIs and retaining the resulting Cargo.lock and diff. This
is a candidate route, not an established one-line repair. Installing a standalone
Wasmtime executable does not update a compiler's embedded Rust dependency.

Before changing the selected engine:

1. Pin the compiler source, Wasmtime source/release and dependency lock in an
   isolated checkout. Build from the recorded patch and hash the executable.
2. Give that development executable its own provenance configuration. Never
   bypass the official-release hash check in the retained reproduction.
3. Compile the original custom async import/resource fixture, then port and run
   the complete lifecycle acceptance: bounded memory/output/logs/resources,
   subscriptions, revocation, retained handles, CPU termination, stale-source
   denial and fresh/retained sessions.
4. Inspect actual imports and run the resulting bytes on unchanged Polyengine
   in Node and Browser. Repeat portable renderer and installed acceptance when
   that implementation exists. Keep any incompatibility explicit.

Assets, activation identity, grants, services and UI contracts should remain
independent of the compiler. A compiler switch requires a new reviewed engine
artifact/profile and explicit session replacement; it must not revive stopped
sessions or expand authority.
