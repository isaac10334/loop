# Windows desktop checkout proof — 2026-10-29

The existing Rust desktop starter ran against this checkout on Windows x64,
Rust 1.98.0, wasm32-wasip2 and WebView2 156.0.4314.50. No runtime blocker
required a source fix. Station was not modified; no cloud service, daemon,
renderer rewrite or build system was introduced.

## Reproduce without installing Loop

From the checkout root, choose an absent disposable destination:

```powershell
cargo build --locked -p loop-cli
$checkout = (Get-Location).Path
$demo = Join-Path $env:TEMP 'loop-desktop-checkout-20261029'
.\target\debug\loop.exe create $demo --template desktop --language rust --host-source $checkout --yes
.\target\debug\loop.exe run $demo --headless --actions refresh,increment,delayed-increment,read-note,write-note
.\target\debug\loop.exe build $demo
$bundle = Join-Path $demo 'dist\loop-desktop-checkout-20261029'
$exe = Join-Path $bundle 'loop-desktop-checkout-20261029.exe'
& $exe --headless
$env:LOOP_UI_SMOKE = Join-Path $demo 'desktop-smoke.txt'
try { & $exe } finally { Remove-Item Env:LOOP_UI_SMOKE }
# For an interactive window, run & $exe without LOOP_UI_SMOKE.
```

Use the fresh explicit checkout CLI (`../target/debug/loop.exe`), not `loop` from
PATH. `--host-source` selects the packaged host dependency; it does **not**
redirect the runtime compiled into an installed CLI. Generated-host `loop run`
uses that CLI's own host. This proof built both the CLI and the packaged host.

The disposable [manifest](C:/Users/ijhar/AppData/Local/Temp/loop-desktop-checkout-20261029/loop.toml)
records `host_source = '\\?\C:\src\ilt\loop'`; the generated
[host manifest](C:/Users/ijhar/AppData/Local/Temp/loop-desktop-checkout-20261029/.loop/host/Cargo.toml)
has a path dependency on this checkout's `crates/loop-host` with `desktop` enabled.

## Actual executable and observed acceptance

- [Standalone Windows executable](C:/Users/ijhar/AppData/Local/Temp/loop-desktop-checkout-20261029/dist/loop-desktop-checkout-20261029/loop-desktop-checkout-20261029.exe)
  and adjacent [component.wasm](C:/Users/ijhar/AppData/Local/Temp/loop-desktop-checkout-20261029/dist/loop-desktop-checkout-20261029/component.wasm)
  were built, not merely located from an earlier build. Keep them together.
- CLI guest execution: count `0 -> 1 -> 2`; delayed action resumed after a
  WASI 0.3 timer; note read succeeded; default read-only write returned
  `AccessError` with name `denied`. With explicit `--writable`, write returned
  `Note saved.` and the subsequent read returned `Saved count: 0`.
- Actual packaged executable `--headless`: `PASS: relocated bundle guest count=2`.
- Actual native WebView2 window: existing smoke code clicked DOM buttons,
  dispatched guest actions and closed/joined its worker. The
  [receipt](C:/Users/ijhar/AppData/Local/Temp/loop-desktop-checkout-20261029/desktop-smoke.txt)
  reads `DOM input -> guest views: [0, 1, 2]; worker joined on close`.
- Clean relocation passed from the checkout working directory, not the bundle
  directory: [relocated executable](C:/Users/ijhar/AppData/Local/Temp/loop-desktop-checkout-20261029/relocated-clean/loop-desktop-checkout-20261029.exe)
  printed `PASS: relocated bundle guest count=2`. Executable size: 47,747,584 bytes;
  SHA-256: `6796371665F82BB0561460B6C62F973E5EC943F3E3314F82346D8CD7B7D63662`. Copy the three distribution files (executable, component and README),
  not the runtime-created `*.exe.WebView2` browser profile: recursively copying
  a used profile can encounter locked cookie files. This is runtime state, not a
  shipped dependency.

The disposable files are intentionally outside the repository and may be deleted
later. No installer/PATH modification or clean-machine installation is claimed.
Cargo dependency downloads and trusted-local builds are not guest sandboxing.

## Contract/provider boundary

```text
Rust guest: counter state + WASI timer + semantic View
    imports notes.store; exports dispatch(action) -> view
        | loopkit:app@0.1.0 WIT boundary
Native loop-host: Wasmtime linker + resource table + per-use notes policy
        | validated semantic tree / typed actions
Existing Windows desktop provider: Tao + Wry/WebView2 + bundled DOM renderer
```

- [WIT contract](../crates/loop-host/wit/application.wit#L1-L33): scoped notes
  resources with denied/revoked results, semantic actions/nodes/views and async
  Rust dispatch. Acquiring another handle never elevates authority. The separate
  synchronous world is the TypeScript compatibility path, not P3 JS support.
- [Guest starter](../crates/loop-cli/templates/rust/lib.rs#L1-L49): owns guest
  state and authored semantic nodes, not the native window or grant controller.
- [Concrete notes provider](../crates/loop-host/src/lib.rs#L36-L175): isolated
  memory-backed scope, no filesystem authority. Native-only grant control;
  reads check revocation and writes check revocation plus rights under one lock.
  Resource-table IDs alone grant nothing.
- [Runtime linking](../crates/loop-host/src/lib.rs#L193-L245): links P2/P3 WASI
  and notes, starts an empty WASI context and checks the actual dispatch signature.
- [Desktop provider](../crates/loop-host/src/desktop.rs#L15-L135): fixed document,
  origin-checked IPC, bounded action queue, worker dispatch, close cancellation
  and join. The existing [renderer](../crates/loop-host/src/desktop.html#L15-L24)
  creates DOM elements/text from semantic nodes; guest HTML is not the contract.
- [Generated executable](../crates/loop-cli/src/dev.rs#L515-L560): injects native
  Notes/Rights and locates the component relative to its executable, not cwd.

This Rust runtime is separate from `@loop-kit/host`; it does not prove a
TypeScript native/Component-provider adapter. Station is the first consumer,
retaining assets, widgets, placement, themes, policy and concrete renderers.
Do not transplant Station wholesale or treat lifecycle/transport as authorization.

## Checks

Passed: `cargo build --locked -p loop-cli`, `cargo fmt --all --check`,
`cargo test --locked --workspace --all-features` (three unit tests and one
Rustdoc test), and
`cargo clippy --locked --workspace --all-features --all-targets -- -D warnings`.

Only this evidence document was added by this slice. Existing checkout changes
were preserved. Next bounded slice: let Station select one real contract to
consume and supply its own policy/provider wiring; do not infer an adapter from
this native starter proof.
