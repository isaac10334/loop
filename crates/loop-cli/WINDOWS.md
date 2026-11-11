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

## Development checkout

```powershell
.\scripts\install-dev.ps1
loop create hello --host-source . --yes
```

## TypeScript preview

TypeScript additionally requires Node and Bun. Its starter uses a synchronous
component ABI; upstream P3 async generation is not supported in the pinned tools.
The isolated async WIT probe and its JavaScript limitation are documented in [experiments/wasip3](../../experiments/wasip3/README.md).
