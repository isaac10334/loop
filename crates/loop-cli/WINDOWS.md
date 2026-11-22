# Windows setup

Loop currently ships for Windows 11 x64.

## Install

```powershell
powershell -c "irm https://isaac10334.github.io/loop/install.ps1 | iex"
```

The installer checks the release SHA-256 checksum, installs the CLI into
`%LOCALAPPDATA%\Loop\bin`, and adds that directory to your user PATH. It also
installs rustup if missing, then Rust 1.98.0 and `wasm32-wasip2`. Existing default
toolchains stay unchanged. It never modifies system PATH.

Open a new terminal after installation, then run `loop doctor`.

> [!IMPORTANT]
> Install [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
> with **Desktop development with C++**, including MSVC and the Windows SDK.
> Desktop windows also need [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
> The installer does not install these system components. Rust compilation may
> require substantial disk space and time on the first build.

For CLI-only installation, or a specific release:

```powershell
& ([scriptblock]::Create((irm https://isaac10334.github.io/loop/install.ps1))) -SkipRust
& ([scriptblock]::Create((irm https://isaac10334.github.io/loop/install.ps1))) -Version 0.1.0
```

An older Rust installation is fine: Loop installs its pinned toolchain alongside
it. If another `loop` command exists, the installer stops and identifies it.
For the old checkout installer, remove only its `loop.exe` and
`loop-install-source.txt` from your Cargo bin directory before switching. Keep
Cargo's shared PATH entry.

## Create and run

```powershell
loop create hello --template desktop --language rust --yes
loop run hello
loop run hello --headless --actions refresh,increment,delayed-increment
loop build hello
.\hello\dist\hello\hello.exe
```

Keep the packaged executable and `component.wasm` together. `loop build --release`
requests optimized builds. Move the old bundle before building another one.

> [!WARNING]
> Only build projects you trust. Cargo build scripts and JavaScript tooling run
> native code on your computer; component capability restrictions do not sandbox
> the development tools.

Generated hosts use an exact version of `loop-host` from crates.io. For host
development, use `--host-source <checkout>` or `LOOP_HOST_SOURCE`. User-owned hosts
live in `host/`; generated hosts live in `.loop/host/`.

## Upgrade and uninstall

```powershell
loop upgrade
loop uninstall
```

These commands start a PowerShell manager, then exit so Windows can replace or
remove the executable. Wait for its completion message. Close other running Loop
processes before upgrading or uninstalling. Rerunning the installer also upgrades.

Windows Settings → Apps → **Loop CLI** offers the same uninstall. Uninstall
removes only installer-owned files and its own PATH entry. It keeps projects,
Rust toolchains, and Cargo's shared PATH entry. A direct ZIP download is portable;
managed upgrade/uninstall commands apply only to installer-managed copies.

## Development checkout (no installed Loop required)

Repository development uses Bun and Cargo directly, not `loop`. Install the
prerequisites above and the toolchain in `rust-toolchain.toml`; do not change your
Rust default. From the checkout:

```powershell
bun install --frozen-lockfile
# Build SDK output, regenerate embedded tools/templates, then build the Rust CLI.
$cli = .\scripts\build-cli.ps1
& $cli --version
.\scripts\test-cli.ps1 -Binary $cli
# Optional persistent development command; rerun after editing to update.
.\scripts\install-dev.ps1
loop-dev --version  # -V also works
loop-dev --help     # -h or `help` also works
loop-dev help create
```

The build script uses the checkout's pinned Rust toolchain and Cargo's reported
artifact path (including `CARGO_TARGET_DIR`). `-Release` selects the release
profile. It never invokes an installed `loop` or installs dependencies. Running
Cargo alone does not regenerate the embedded Bun worker and asset inventory.

The development installer always rebuilds and copies to `loop-dev.exe` in
`$CARGO_HOME\bin` (default `%USERPROFILE%\.cargo\bin`). It records checkout,
version and SHA-256 in `loop-dev-install.json`, refuses unrecognized/modified
copies or another owning checkout, and leaves `loop.exe` alone. There is no
`-SkipBuild` shortcut. Use `-InstallDir <directory> -NoPath` for an isolated copy
without persistent PATH changes. Without `-NoPath`, it adds the development bin
to user and current-session PATH if needed. Reopen PowerShell to refresh other
sessions, then check `Get-Command loop,loop-dev -All`.

Use `loop` for an installed stable release and `loop-dev` for local source. Their
version numbers alone may match; inspect command paths and the development marker.
`loop-dev upgrade`/`uninstall` refuse unmanaged copies: update by rerunning the
script. To remove development installation, inspect its marker and remove only
its `loop-dev.exe` and `loop-dev-install.json`; keep Cargo's shared PATH entry.
The old installer used `loop.exe` plus `loop-install-source.txt`; those are legacy
development files, not evidence of a stable release. Inspect them before removing
only those two files to switch to the stable installer. No automatic migration
or replacement of a legacy `loop.exe` occurs.

For legacy host development, pass an absolute checkout path:

```powershell
loop-dev create hello --host-source C:\src\ilt\loop --yes
```

`test-cli.ps1` copies the supplied binary to a temporary directory outside the
repository and tests PATH resolution, version/help/doctor, embedded Rust scaffolding
and managed-upgrade refusal with repository/tool directories absent from PATH.
It leaves its evidence directory. `scripts/test-dev-install.ps1` additionally
runs real isolated install/repeat-update checks, stable-file preservation, and
modified/unmanaged executable rejection without changing user PATH.
These checks do not prove application compilation or native-window execution. For the stronger published-host gate, run
`scripts/test-release.ps1 -Binary <absolute-cli-path>`; it requires the matching
published host, Rust target, MSVC and network access. See
[release prerequisites](../../RELEASING.md#published-versus-prepared-checked-november-11-2026).

## TypeScript preview

TypeScript additionally requires Node and Bun. Its starter uses a synchronous
component ABI; upstream P3 async generation is not supported in the pinned tools.
The isolated async WIT probe and its JavaScript limitation are documented in [experiments/wasip3](../../experiments/wasip3/README.md).
