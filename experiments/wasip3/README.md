# WASI P3 probe

This isolated experiment holds the authored async WIT probe, pinned WIT dependencies, a Rust Wasmtime host example in `crates/loop-host/examples/probe.rs`, and a JavaScript componentization attempt. The Rust host code exercises async imports/exports, a future, a stream, and WASI clocks when passed a compatible `probe.wasm`.

Current limit: on Bun 1.3.14/Windows, the pinned ComponentizeJS 0.22.0 async-world generator panics at `crates/spidermonkey-embedding-splicer/src/bindgen.rs:865:18` (`entered unreachable code`). The JavaScript probe does **not** establish working TypeScript/WASI P3 execution. The checked-in JS source also lacks a full implementation of the WIT world; the Rust host example needs a separately built compatible component.

To reproduce the JavaScript generator attempt from this directory:

```powershell
cd js
bun install
bun build probe.ts --target browser --outdir out
bun probe.mjs
```

To refresh the pinned WIT dependencies, install `wit-deps-cli 0.6.0` separately and run it with `--manifest probe/deps.toml --lock probe/deps.lock --deps probe/deps`. This writes managed `probe/deps`; authored WIT stays outside that directory.
