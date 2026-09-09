# Research ledger — 2026-09-08 UTC

Evidence is local Windows x86_64 unless marked otherwise. Pins are project-specific; global Rust defaults are unchanged.

| Tool | Selected source/version | Finding |
|---|---|---|
| Rust | [1.98.0 target documentation](https://doc.rust-lang.org/rustc/platform-support/wasm32-wasip3.html) | Installed 1.98.0 (88d9e12ae). `rustup target add wasm32-wasip3 --toolchain 1.98.0` reports no prebuilt artifacts. Same result on 1.94.0. Historical page caveats are not current build evidence. |
| wit-bindgen | [0.61.1](https://docs.rs/wit-bindgen/0.61.1/wit_bindgen/) | Released async WIT bindings; compiling explicit `async func` on wasm32-wasip2 succeeds. |
| wasi-rs | [wasip3 0.8.0+wasi-0.3.0](https://docs.rs/wasip3/0.8.0+wasi-0.3.0/wasip3/) | Published source explicitly supports wasm32-wasip2 plus P3 bindings. Compiler target, interface version, and async canonical ABI are separate facts. |
| Wasmtime | [48.0.0](https://docs.rs/wasmtime/48.0.0/wasmtime/), [WASI](https://docs.rs/wasmtime-wasi/48.0.0/wasmtime_wasi/) | Direct Rust embedding; enable component-model-async and WASI p3. P3 module still labels itself experimental, incomplete, outside semver guarantees. |
| ComponentizeJS | [0.22.0](https://www.npmjs.com/package/@bytecodealliance/componentize-js/v/0.22.0) | JS input; TS needs typechecking/transpilation. Actual async-world probe retained in tools/js. |
| Jco | [1.32.1](https://www.npmjs.com/package/@bytecodealliance/jco/v/1.32.1) | Component inspection tooling; browser execution is a separate, deferred experiment. |
| wasm_component_layer | [upstream](https://github.com/DouglasDwyer/wasm_component_layer) | README advertises 0.1.16, host/guest resources and synchronous calls, but supplies no required P3 async proof. Not selected; no runtime abstraction needed. |
| wit-deps | [0.6.0 library](https://docs.rs/wit-deps/0.6.0/wit_deps/), [CLI source](https://github.com/bytecodealliance/wit-deps) | Manages wit/deps, deps.toml and deps.lock; supports paths, immutable archive URLs and digests. Authored WIT must live outside managed deps. |

Context7 was consulted for Wasmtime, clap and Wry; pinned published crate sources are authoritative for compilation. No upstream fork or local toolchain patch is used.

Toolchain installation completed, but rustup's subsequent optional self-update reported access denied removing rustup-init.exe. `cargo +1.98.0` and the installed target work.

## Executed findings, 2026-09-09

See `handoff.md` for exact verification and remaining gaps. Rust Component Model async, WIT future/stream, P3 clocks, scoped grants and native desktop DOM routing passed. Actual probe imports are in `probe-interfaces.wit`. ComponentizeJS 0.22.0 async-world generation panics at splicer bindgen.rs:987; synchronous generation succeeds, but corrected host execution remains unverified after an early handoff.

[WASI's consolidated release page](https://github.com/WebAssembly/WASI/releases/tag/v0.3.0) is the current standard source; older wasi-clocks repositories are archived. This does not override the experimental status documented by the selected Wasmtime P3 implementation. Wry 0.56.1 and Tao 0.37.0 were tested with WebView2 152.0.4191.66. Wry's custom protocol maps loop://localhost/ to http://loop.localhost/ on Windows, which is the exact bridge/navigation allowlist. MiniJinja 2.24.0 and dialoguer 0.12.0 supply declarative rendering and prompts. Cargo.lock pins all selected transitive versions.
