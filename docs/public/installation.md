# Installation and release status

Loop Kit is a developer preview. Choose a route explicitly; source availability, a locally installed binary and a published release are different claims.

## Current public Windows CLI

The public release channel is [GitHub Releases](https://github.com/isaac10334/loop/releases). The latest release checked on November 11, 2026 was **v0.1.0**, with a Windows x64 ZIP. There are no advertised macOS, Linux or ARM CLI artifacts.

[Download the Windows ZIP](https://github.com/isaac10334/loop/releases/latest/download/loop-windows-x64.zip) or review the [PowerShell installer](https://isaac10334.github.io/loop/install.ps1) before running it:

```powershell
powershell -c "irm https://isaac10334.github.io/loop/install.ps1 | iex"
loop --version
loop --help
loop doctor
```

The installer verifies the release checksum, installs under the user's local application directory and updates user PATH. It can prepare Rust 1.98.0 and `wasm32-wasip2`; CLI-only installation supports `-SkipRust`. It does not install Microsoft C++ Build Tools, the Windows SDK or WebView2. Native development needs those prerequisites. Review all downloaded build tools; guest restrictions do not sandbox Cargo build scripts or JavaScript tooling.

The installer/ZIP route is preserved for the existing release. **Do not assume v0.1.0 contains the new host-kit/config implementation.** Check help on your chosen binary. `loop upgrade` and `loop uninstall` apply to installer-managed copies, not arbitrary extracted ZIPs.

## Current host-kit development route

Use the selected checkout with Bun and the pinned Rust toolchain. Install workspace dependencies, then build the CLI:

```powershell
bun install --frozen-lockfile
cargo build --locked -p loop-cli
.\target\debug\loop.exe --help
```

Rust compilation on Windows requires MSVC/Windows SDK; native windows require WebView2. Browser execution uses the browser kit and a local browser, not Tao/Wry. The [quick start](quickstart.md) documents reviewed packed dependencies and an outside-checkout consumer.

All nine `@loop-kit/*` npm registry endpoints returned 404 when checked on November 11, 2026. Until publication, **do not use an unqualified `bun add @loop-kit/host-browser` as a working installation instruction**. Local tarball overrides are an explicit preview technique, not proof of public npm installation.

## Compatibility before the next release

Published `loop-host 0.1.0` lacks APIs required by the current CLI implementation. Use the source/packed route above for the host-kit preview; do not combine a current CLI source archive with that older registry crate. Local Cargo path patches do not prove public installation. Maintainers can follow the [coordinated release instructions](../../RELEASING.md); no new version has been published by these docs.

See [language and runtime support](compatibility.md) for guest/host distinctions and [CLI/config reference](cli.md) for source-build commands.
