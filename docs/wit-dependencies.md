# WIT dependencies

The tested manager is `wit-deps-cli 0.6.0` / library `wit-deps 0.6.0`. It is an explicit development command, not a network-fetching build.rs. Authored packages are `crates/loop-host/wit`, `wit/signals` and `wit/probe/probe.wit`. Only `wit/probe/deps` is managed output.

```powershell
cargo +1.98.0 install wit-deps-cli --version 0.6.0 --locked --root .tools
.\.tools\bin\wit-deps.exe --manifest wit/probe/deps.toml --lock wit/probe/deps.lock --deps wit/probe/deps
.\.tools\bin\wit-deps.exe --manifest wit/probe/deps.toml --lock wit/probe/deps.lock --deps wit/probe/deps lock --check
```

Local `../signals` resolves from the manifest directory (`wit/probe`), not the shell directory. The remote WASI random v0.2.0 archive is release-pinned and SHA-256 pinned in the manifest; deps.lock records SHA-256 and SHA-512 for local and external packages. The probe actually calls the imported random function; it is not a decorative dependency.

The CLI's `lock --check` calls `lock_path` and reports whether it changed anything **after materializing**; it is not a read-only frozen check. Use a disposable checkout when checking drift. `update` is deliberate and may replace managed content. Keep authored files outside deps: the tool can delete this entire managed directory.

Commit deps.lock and the small materialized definitions for offline guest builds. `cargo build --offline` then needs the ordinary Cargo crate cache; it does not invoke wit-deps. The manager has a URL cache but no offline flag: never claim an uncached `lock` cannot access the network. For strict offline regeneration use already-vendored inputs or a disconnected disposable environment. Cargo.lock, bun.lock and deps.lock retain their separate ownership; there is no loop.lock.
