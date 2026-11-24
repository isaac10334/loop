# Use the Loop CLI

The legacy examples below describe the existing Rust Component application CLI,
reviewed November 4, 2026. The November 7 source build also includes explicit
host-config commands and bundled skills. Host-kit runtime and release gates remain
in progress; [the host-kit guide](host-kits.md) separates source commands from those
gates. Check `loop --version` and `loop --help` against the binary you selected.

## Install and check prerequisites

Loop currently distributes a Windows 11 x64 CLI. Follow [Windows setup](../crates/loop-cli/WINDOWS.md)
for the installer, pinned Rust toolchain, MSVC/Windows SDK and WebView2 requirements.
Then open a new terminal:

```powershell
loop --version
loop --help
loop doctor
```

Doctor reports tool availability; it does not compile a sample, validate every ABI,
or prove that an installed native application works. Building executes trusted
Cargo build scripts and JS tools with your user authority. Guest capability
restrictions do not sandbox those build tools.

## Create a desktop application

Choose a new, absent destination with a lowercase name:

```powershell
loop create hello --template desktop --language rust --yes
loop run hello
```

The starter has a Rust Component, scoped note access and a small native semantic
renderer. The desktop host uses Wasmtime and Tao/Wry/WebView2. Closing this example
closes its worker. This is separate from the TypeScript host package and from host applications built on Loop Kit.

Without explicit flags, create defaults to a Rust desktop application and a
generated host. Interactive invocation offers template/language selection.
Create refuses an existing destination rather than overwriting your source.

## Run headlessly and check grants

```powershell
loop run hello --headless --actions refresh,increment,delayed-increment,read-note,write-note
loop run hello --headless --actions write-note --writable
```

The first run uses the starter's read-only note grant; writing is denied. The
second explicitly selects writable note access in the CLI host. This flag is
specific to the existing note application, not general filesystem/document rights.
Headless output contains one JSON view per action; build and runtime diagnostics
go to stderr. Supported actions are `refresh`, `increment`, `delayed-increment`,
`read-note` and `write-note`. Desktop mode uses rendered interactions instead of
that action list.

A directory argument builds that explicit project. A raw supported `.wasm` file
uses the CLI's fixed application dispatch runtime; it is not a generic arbitrary-
world Component launcher. The CLI does not search parents for a project or run
all nested Components.

## Add a separate Component project

```powershell
loop add component helper --workspace hello --language rust
loop run hello/components/helper --headless --actions refresh,increment
```

Add creates an independent project under `components/helper` with its own manifest.
It does not rewrite the parent manifest, automatically compose/link the child or
inherit the parent's language. Choose the child path explicitly.

For a Component-only project:

```powershell
loop create calculator --template component --language rust --yes
loop build calculator --release
```

Component builds return a Wasm artifact rather than a desktop distribution.

## Build a standalone desktop directory

```powershell
loop build hello --release
.\hello\dist\hello\hello.exe
.\hello\dist\hello\hello.exe --headless
```

Keep the executable, `component.wasm` and accompanying README together. The
executable resolves the Component beside itself, so you can relocate the whole
directory without a source checkout or CLI installation. System WebView2 remains
a prerequisite. The bundled `--headless` mode runs its built-in count check; it
is not the full `loop run` action grammar.

Build refuses an existing `dist/hello` directory. Preserve or move the previous
bundle yourself before rebuilding; the CLI does not silently replace it. See
[recorded native/relocation evidence](windows-desktop-proof.md) for what was
actually tested, including its clean-machine/installer limitations.

## Generated versus user-owned hosts

```powershell
loop create custom --template desktop --language rust --host user --yes
loop run custom
```

The user-owned host source lives under `host/`; generated host build source lives
under `.loop/host/`. The user host chooses its own grants. Nonheadless `loop run`
rejects `--writable` for a user-owned host; headless execution uses the CLI runtime
instead. Generated distributions pin an exact published `loop-host` crate version.

For Loop host development, `create --host-source <checkout>` selects a local
checkout for generated/user host compilation; `LOOP_HOST_SOURCE` is the fallback.
That override does **not** replace the runtime already compiled into the CLI's
normal generated-host `run` path. Keep local host paths out of released projects
and packages. See [Windows host development](../crates/loop-cli/WINDOWS.md#development-checkout-no-installed-loop-required).

## Project formats and experimental TypeScript

| File or option | Current meaning |
| --- | --- |
| `loop.toml` version 1 | Existing Rust CLI project, source/language, generated/user host and note grant. Read from the explicitly supplied directory. |
| `loop.package.json` version 1 | Separate literal text-source snapshot inventory used by workspace tooling, not current Rust CLI configuration. |
| `loop.config.ts` | Source-build trusted host-kit composition. Run/build require explicit `--config`; evaluation requires `--trust-local-config`. Legacy commands do not load it. |
| `--template-dir` | UTF-8 MiniJinja source overlay during create, not a runtime plugin or sandbox. |

```powershell
loop create ts-preview --template component --language typescript --yes
loop build ts-preview
```

The TypeScript starter additionally needs Bun/Node and uses a **synchronous**
Component ABI, even though its JS export returns a Promise. It does not implement
the new async document profile. First TS build may install dependencies/create its
lock; later builds freeze an existing Bun lock. Current Cargo development build
commands do not themselves promise a locked/reproducible source receipt.

## Update or remove the managed CLI

```powershell
loop upgrade
loop uninstall
```

These hand off to the managed Windows installer. Wait for its completion and keep
other Loop processes closed. Uninstall preserves projects and Rust. Direct ZIP
copies are portable; managed update/uninstall applies only to managed installations.
The [installation guide](../crates/loop-cli/WINDOWS.md#upgrade-and-uninstall) owns
conflict, PATH and recovery details.

## Bundled skills and host-kit status

The November 7 source-built CLI includes the offline [bundled skill manager](reference/skills.md).
Run `loop skills list --json` to verify its catalog. Inspect, install, update, remove
and recover require explicit scope/root/adapter arguments. Mutations plan unless
you pass `--write`; the local CLI receipt covers all verbs with project/user fixture
roots and zero-write plans. The reference documents its parser, JSON results and
recovery limits. Codex app-server discovery passed for a project fixture; model
invocation and release relocation remain unverified. Older installed releases may
lack `loop skills`.

The legacy commands above do not install skills or evaluate typed config. The
source-built CLI implements the [explicit host-kit command grammar](host-kits.md#source-build-cli-workflow),
including config inspection, trusted evaluation, create/run/dev/build and owned
stop/restart. The [custom kit/provider example](../examples/host-kits/custom-provider/README.md)
records an actual evaluated CLI browser run, semantic interaction and lifecycle
hooks. Official kit integration and release gates remain partial; consult the
guide's [current acceptance limits](host-kits.md#current-acceptance-limits) before
claiming a working browser Component or native CLI distribution.
