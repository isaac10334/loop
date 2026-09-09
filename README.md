# Loop

Build desktop applications from WebAssembly components. Write your application
logic in Rust, describe its interface, and run it in a native host with explicit
access to capabilities.

Loop includes a CLI to create, run, and package applications, plus an embeddable
Rust host built on Wasmtime.

> [!WARNING]
> Early preview for Windows x64. APIs and project formats may change. Start with
> Rust; TypeScript support is experimental and uses a synchronous component ABI.

## Install

Run in PowerShell:

```powershell
powershell -c "irm https://isaac10334.github.io/loop/install.ps1 | iex"
```

The installer downloads the CLI, verifies its checksum, and sets up Rust 1.98.0
with the WebAssembly target. It installs for your user account and keeps your
existing default Rust toolchain. Open a new terminal after installation.

> [!IMPORTANT]
> Building applications also requires **Microsoft C++ Build Tools** with the
> **Desktop development with C++** workload and Windows SDK. Desktop windows
> require **WebView2 Runtime**. See [Windows setup](docs/windows.md).

```powershell
loop create hello
loop run hello
loop build hello
```

Share the resulting `hello/dist/hello` directory. Your friend can run the packaged
application without installing Loop or Rust; desktop apps still need WebView2.

## Upgrade or uninstall

```powershell
loop upgrade
loop uninstall
```

Wait for the install manager's completion message. You can also uninstall **Loop
CLI** from Windows Settings → Apps. Uninstall keeps your projects and Rust tools.

[Website](https://isaac10334.github.io/loop/) ·
[Downloads](https://github.com/isaac10334/loop/releases) ·
[Windows setup](docs/windows.md) · [Design](docs/design.md)

## In this repository

| Path | Purpose |
| --- | --- |
| `crates/loop-cli` | Create, run, and package applications |
| `crates/loop-host` | Embeddable runtime, desktop host, and application WIT contract |
| `templates` | Rust and experimental TypeScript starters |
| `examples` | Sample components and applications |

Licensed under [MIT](LICENSE-MIT) OR [Apache-2.0](LICENSE-APACHE).
