# Run a Rust application headlessly

Use the existing Rust starter to exercise a Component, semantic views and scoped
note access without opening a desktop window. This legacy `loop.toml` application
route is separate from the newer TypeScript-config native kit.

## Prerequisites

Use Windows x64, a current source-built Loop CLI, Rust 1.98.0 and the
`wasm32-wasip2` target. Building the CLI or a desktop distribution also requires
MSVC C++ Build Tools and the Windows SDK. A visible Tao/Wry desktop window requires
WebView2; the headless commands below do not open one. See
[installation](installation.md) for source-build and published-release differences.

Only build trusted projects: Cargo build scripts execute with your user authority.
Component import restrictions do not sandbox the build toolchain. The commands
below assume dependencies and the Rust target are already available. Offline mode
fails rather than fetching missing Cargo dependencies.

## Create a fresh starter from the selected checkout

From the Loop checkout root, after building the CLI:

```powershell
$checkout = (Get-Location).Path
$loop = Join-Path $checkout 'target/debug/loop.exe'
$demo = Join-Path $env:TEMP ('loop-native-' + [guid]::NewGuid())
& $loop create $demo --template desktop --language rust --host-source $checkout --yes
```

Create refuses an existing destination. The project contains a Rust guest and
`loop.toml` with a read-only note grant. `--host-source` selects this checkout for
generated host compilation; it does **not** replace the runtime already compiled
into the selected CLI. Ordinary generated-host `run --headless` uses that CLI's
runtime. Keep checkout-specific host paths out of distributed projects.

## Run actions and inspect denial

```powershell
$previousOffline = $env:CARGO_NET_OFFLINE
$env:CARGO_NET_OFFLINE = 'true'
try {
  & $loop run $demo --headless --actions refresh,increment,delayed-increment,read-note,write-note
  & $loop run $demo --headless --actions write-note,read-note --writable
} finally {
  $env:CARGO_NET_OFFLINE = $previousOffline
}
```

The first command builds the guest and prints one JSON view per action. Increment
and delayed increment should move the count from zero to one to two. The default
read-only grant permits reading the note and denies `write-note` with an
`AccessError` named `denied`. The second command explicitly permits writes for
this invocation; it should report `Note saved.` followed by `Saved count: 0`.
Each invocation starts fresh in-memory guest and note state.

`--writable` is specific to this example's notes provider. It does not grant
filesystem access or general document rights. The raw `.wasm` run route supports
these application worlds, not arbitrary Component worlds.

## Build a desktop directory separately

Building the native executable can be substantially slower than the guest-only
headless run:

```powershell
& $loop build $demo
```

The bundle is written under the project's `dist` directory. Keep its executable,
`component.wasm` and README together. Build refuses an existing bundle directory.
The packaged executable's `--headless` option runs its own built-in count check;
it does not accept the CLI's full action grammar.

Running the executable **without** `--headless`, or running `loop run $demo`
without that flag, opens a Tao/Wry/WebView2 window. Do that only when you explicitly
want visible desktop execution. Headless success does not prove pointer/keyboard
rendering, WebView2 lifecycle, installed distribution or clean-machine behavior.

## New native kit

The official `@loop-kit/host-native` package is a separate source-build and
reviewed-pack preview. Its Windows adapter composes Wasmtime execution, Tao/Wry
presentation and, when selected, trusted TypeScript providers through a checked
semantic-surface bridge. Its UI supports a restricted semantic subset; a legacy
starter success does not verify this bridge or the new Component profiles.

See the [support matrix](support.md), [compatibility guide](compatibility.md) and
[package contract](../../packages/host-native/README.md) before selecting that
route. Use the [browser quickstart](quickstart.md) for the currently demonstrated
TypeScript application shell and editable input.
