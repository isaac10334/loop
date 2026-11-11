# Disposable async document / host-kit feasibility receipt

**Observed November 3–4, 2026; experiment only.** Owned boundary: this directory only, on the existing dirty tree above `4fd90622a43700a027f3da2d06ab44ffc2e33361`. No production API, manifest, Station file/link/app, installation, publication or commit was changed by this probe. No Station ports 43157–43159 were used.

## Results, kept separate

| Lane | Actual result | Evidence |
| --- | --- | --- |
| Fresh Rust G1 document v1 | Compiled, translated, instantiated and invoked in **Wasmtime48 and actual Chrome**; real async host resource read/CAS-write | [immutable bytes](artifacts/document-v1.wasm), [native final log](native-final-v1.log), [browser receipt](browser-receipt.json), [rendered screenshot](browser-result.png) |
| Changed authored source v2 | Different artifact; `fresh-v2;` marker appears in both hosts, not added by host/input; same world digest | [v2 source](guest-v2/src/lib.rs), [immutable bytes](artifacts/document-v2.wasm), [native final log](native-final-v2.log), [browser receipt](browser-receipt-v2.json) |
| Separate semantic extension | Exact same extension bytes: Chrome rendered button → Component async event → granted document action → rendered next frame; native Wasmtime synthetic-event tests also pass | [extension bytes](artifacts/document-semantic.wasm), [browser receipt](semantic-browser-receipt.json), [native log](native-final-semantic.log), [screenshot](semantic-browser-result.png) |
| **Actual isolated desktop** | **Tao/Wry WebView2 window + Wasmtime48**: Playwright pointer click on rendered guest button, document commit, `semantic world` rendered, own Close button, worker joined/process exit0 | [desktop UI receipt](desktop-ui-receipt.json), [host cleanup receipt](desktop-receipt.json), [successful log](desktop-run-3.log), [screenshot](desktop-result.png) |
| Electrobun selected kit | **Not implemented/proved.** Installed npm package is bootstrap, not SDK; public export throws devkit preparation instruction. Exact cached SDK/runtime exists; tool availability is not the claimed blocker | [attempt1](desktop-electrobun-attempt-1.log), [attempt2](desktop-electrobun-attempt-2.log), [input](desktop-electrobun-probe.ts) |
| TS guest / ComponentizeJS0.22 | Complete TS guest transpiles to JS, but actual document-world generation panics at `bindgen.rs:720:47: not yet implemented`; no Component bytes | [complete TS input](js-guest/guest.ts), [driver](js-guest/componentize.mjs), [pinned failure](js-guest-componentize-pinned.log) |

Desktop above is **not Electrobun, not Polyengine inside WebView2, not an installed/packed desktop acceptance pass**. Native nonvisual results alone were not relabeled desktop. Browser execution is actual Chrome, not Bun/Node substitution. Neither uses old sync notes imports, JS RecordingSurface or a transpiled TS app as Component proof.

## Byte identity and tools

| Artifact | SHA-256 |
| --- | --- |
| [document v1](artifacts/document-v1.wasm) | `9b459aba2977774a5c119898bee6a82884f61e9299ca44d43141468aeaffe88b` |
| [document v2](artifacts/document-v2.wasm) | `4f93cbd53f2303634b1fdd62f8d1d2bad50c0bac7a5226bc89b4810a4458c9a1` |
| [separate document+semantic](artifacts/document-semantic.wasm) | `e8a5aa7730b6060d6b00cbbffade98e68588b76619365ba220567ae048b3af3d` |

The three retained copies are never build outputs and were not overwritten on reruns. [Final artifact hashes](final-artifact-hashes.log) also identify the tested native executable: `e12828c537bfb7476a3f6c48882fa94bd67be8eb35fcff47fae57788042780e8`. [Source/evidence inventory](inventory.json) hashes complete authored source files, manifests, locks, WIT, bundles, receipts and logs. [Tool inventory](tool-inventory.json) hashes actual compiler/runtime executables and installed compiler/translator assets. Cargo locks carry the distinct transitive registry checksums, not an ABI digest. [Generated guest bindings](bindings/document-guest.rs) are retained as compiler output.

Actual versions: Rust `1.98.0 (88d9e12ae 2026-08-18)`, Cargo `1.98.0`, installed `wasm32-wasip2`, wit-bindgen `0.61.1`; nightly-2026-09-08 installed but unused. Cargo-component `0.21.1` was inspected, **not needed by the successful plain cargo build**. Wasmtime crate **48.0.0** was built offline; installed Wasmtime CLI **33.0.0** is not that runtime and was not used. Bun **1.3.14**, Node **24.14.1**, Chrome **156.0.8078.80**, Playwright **1.61.1**, Polyengine runtime/translator **0.6.7**, protocol **0.3.1**. Actual desktop: Tao **0.37.0**, Wry **0.56.1**, WebView2 **156.0.4314.58**. Installed Electrobun bootstrap **2.0.3-beta.26** was not prepared or launched. No wasm-tools executable was on PATH. [Version log](versions.log) records the probes.

The installed translator SHA-256 is `ddb2e0144a9c5a1d65ff6ba05c45f913cc4111bc92a11624a44ae49486260e13`.

## Exact world / actual import profile

[Authored G1 WIT](guest/wit/document.wit) retains `loop:document-tool/documents@0.1.0`, host-owned nominal resource `document`, async `read` / CAS `write`, and async export `replace-text(borrow<document>, string, string) -> result<string,failure>`. Failure cases are denied/revoked/conflict(snapshot)/invalid-source/cancelled/unavailable. The proposed example's `from` is a WIT keyword: this input uses **`%from`**, the same identifier escaped for the parser. No filesystem path, document lookup/open, arbitrary asset ID or owner dispatcher is granted.

[Actual full v1 import/export/type profile](profile.json), [v2 profile](profile-v2.json), [extension profile](semantic-profile.json) record async flags, own/borrow and error types. Polyengine world digest for v1/v2: `sha256:9d978bf670230e8d972ba5c359a5be6227b9b313c037e298318422eeadc72e0c`. Extension world digest: `sha256:8f91fe49f2e999c6c9ff4d89146d7fa2b84eabe5c09a802c32290e3c1cfa99e1`. These runtime-produced world digests are distinct from source/artifact hashes; no compiler-independent canonical ABI equivalence is claimed.

Actual emitted WASI interfaces, **all @0.2.9**:

- `wasi:io/poll`: pollable type, pollable.block, poll.
- `wasi:io/error`: error type.
- `wasi:io/streams`: input/output-stream types; output-stream.subscribe/check-write/write/blocking-flush.
- `wasi:clocks/monotonic-clock`: subscribe-duration.
- `wasi:cli/exit`: exit; stdin/stdout/stderr: get-stdin/get-stdout/get-stderr.
- `wasi:cli/environment`: get-environment.
- `wasi:cli/terminal-input`, terminal-output: nominal resource types; terminal-stdin/stdout/stderr: get-terminal-stdin/stdout/stderr.

Every emitted WASI function has an **explicit denying provider** in both probe adapters, with inert nominal resource classes/types. No filesystem/network/environment grants were added to fix linking. Successful browser receipts record **zero calls** to these deny stubs; native success also establishes no denied import was invoked. Wasmtime type inspection additionally shows root type aliases `document` (and extension `surface`), not extra authority.

[Separate extension WIT](semantic-guest/wit/world.wit) imports original document identity plus exact public `loopkit:ui/surfaces@0.1.0`; [copied public UI WIT](semantic-guest/wit/deps/ui/surfaces.wit) is byte-identical to the inspected public contract. The actual added imports are surface type, synchronous `surface.render(string)` and **async** `surface.next-event() -> option<string>`; unused `open` is eliminated, not granted. Export is async `run(borrow<document>, borrow<surface>)`. This does not widen G1.

## Authority, suspension, revision and disposal evidence

- Both G1 hosts delay **read and write 35ms each**; guest awaits actual Component resource imports. Chrome call is observed still pending at15ms, then logs read-enter/read-resume/write-enter/write-resume/commit. Final Chrome v1/v2 calls were ~77ms; final native ~87/86ms. No synchronous import shim or synchronous ABI substitute.
- Viewer write denies without mutation; retained resource after revoke denies; browser wrong-principal grant denies. Native forged table ID traps `resource not present`; browser forged host facade object traps on missing private policy. These are host-ingress forgery fixtures, **not a hostile hand-authored guest-handle fuzz corpus**.
- Two distinct instances share one serialized document owner; both read revision0 and race writes. Exactly one commits revision1; the loser receives conflict with winner snapshot, with caller drafts A/B unchanged. Native check+CAS+commit holds one mutex; browser commit is one synchronous JS owner section after await.
- Revoke before read completion and during delayed write, plus cancel before commit: revision remains0. Revoke after completed commit: revision1/result preserved. These finite schedules do not prove arbitrary remote cancellation/reconciliation.
- Host document owners are closed after calls settle; browser live documents/pending host calls reach0. Semantic tests additionally end with surfaces0/listeners0/pending event reads0. Borrow-only entry is tested; guest-owned document destructor and retained-borrow attacks are **not** established.
- Extension guest renders a frame, suspends awaiting event, validates revision/sequence/key/type, then uses granted document and renders frame1. Real Chrome button activates it; actual desktop pointer click activates the same bytes. Browser rejects stale/non-increasing-sequence/unknown-key/disabled/late events, and denies viewer/revoked document or surface render. Closing pending event resolves none → guest cancelled without mutation. Native extension separately checks stale guest event → invalid-source and close-pending/viewer/revoke.
- Browser surface denial is a trap because current public render WIT has no result error case. No claim that trap is a typed denied result. `validateFrame` is the existing public implementation, not a new registry; trusted tiny renderer uses DOM text/accessible labels, no arbitrary HTML.
- Desktop successful run used unique owned WebView2 profile and ephemeral debug port50384; only exact `http://loop-probe.localhost/` bridge origin is accepted and popups/navigation deny. Rendered output was `semantic world`; own Close action joined worker, dropped store/resources and exited0. This happy-path close does **not** establish cancellation at every desktop commit race.
- Chrome contexts were closed in `finally`. Failed desktop attempts stopped only their directly spawned native process; final desktop closed normally. [Cleanup process log](cleanup-processes.log) distinguishes an inspection during the final native test from the final zero-owned-process check. No Station process was opened or terminated.

## Commands, exits and bounded fixes

All commands run with cwd this directory. PowerShell wrappers pipe stdout/stderr to the named log, append `EXIT_CODE=<code>`, and propagate nonzero status. [Machine-readable command ledger](commands.json) contains the attempt commands and log statuses. No install/download step belongs to reproduction.

```powershell
$env:CARGO_TARGET_DIR="$PWD/guest/target"
cargo build --offline --locked --release --target wasm32-wasip2 --manifest-path guest/Cargo.toml
cargo build --offline --locked --release --target wasm32-wasip2 --manifest-path guest-v2/Cargo.toml
$env:CARGO_TARGET_DIR="$PWD/semantic-guest/target"
cargo build --offline --locked --release --target wasm32-wasip2 --manifest-path semantic-guest/Cargo.toml
$env:CARGO_TARGET_DIR="$PWD/native/target"
cargo build --offline --locked --features desktop --manifest-path native/Cargo.toml
bun inspect.ts artifacts/document-v1.wasm profile.json
bun inspect.ts artifacts/document-v2.wasm profile-v2.json
bun inspect.ts artifacts/document-semantic.wasm semantic-profile.json
bun build-browser.ts
node run-browser.mjs artifacts/document-v1.wasm
node run-browser.mjs artifacts/document-v2.wasm -v2 'fresh-v2;'
node run-semantic-browser.mjs
native/target/debug/async-document-native-probe.exe artifacts/document-v1.wasm
$env:PROBE_EXPECTED_PREFIX='fresh-v2;'
native/target/debug/async-document-native-probe.exe artifacts/document-v2.wasm
native/target/debug/async-document-native-probe.exe artifacts/document-semantic.wasm --semantic
node run-desktop.mjs
bun build js-guest/guest.ts --target browser --outfile js-guest/guest.js
bun js-guest/componentize.mjs # expected compiler failure; no Component output
```

Successful guest build exit0 after bootstrap source corrections: [attempt1](guest-build-1.log) exit101 unescaped WIT `from`; [attempt2](guest-build-2.log) exit101 Rust generated module/string argument mismatch; [attempt3](guest-build-3.log) exit101 duplicate generated type aliases; [attempt4](guest-build-4.log) exit0. No unavailable tool was installed. [v2 build](guest-v2-build.log) exit0. [Semantic build1](semantic-build-1.log) exit101 missing `generate_all` for external interfaces; [build2](semantic-build-2.log) exit0.

Native bootstrap: [build1](native-build-1.log) exit101 introspection `.ty` and Wasmtime-vs-anyhow error types; later source build exit0. [Run1](native-run-1.log) exit1 exact variant-label mismatch → explicit WIT case names; [run2](native-run-2.log) exit1 missing WASI resource after linker instance replacement → standalone inert resource types + denial funcs; [run3](native-run-3.log) exit0. Final source no longer depends on wasmtime-wasi. All three [final native logs](native-final-v1.log) passed exit0 on the final executable.

Browser [run1](browser-run-1.log) exit1 loaded ESM bundle as classic script (`import.meta`); [run2](browser-run-2.log) exit0 after module-script load. Original direct-export-target imports were local shortcuts, **not public packed-consumer proof**. Final [build driver](build-browser.ts) uses public source specifiers plus explicit local resolution, records [mapping/hashes](public-resolution.json), and final [v1](browser-public-v1-run.log), [v2](browser-public-v2-run.log), [semantic](semantic-browser-public-run.log) reruns all exit0 against current sources/bundles. UI resolves its checkout's declared public root export: still **unshippable local resolution, not independently installed/packed consumption**.

Desktop [build1](desktop-build-1.log) exit101 Wry requires `Response<Cow<[u8]>>`; [build2](desktop-build-2.log) exit0 with that concrete fix. [run1](desktop-run-1.log) exit1 CDP page awaited creation although existing page navigates from about:blank; [run2](desktop-run-2.log) exit1 stale DevToolsActivePort from prior failed profile. Final driver uses fresh owned profile and waits existing page URL; [build3](desktop-build-3.log) and [run3](desktop-run-3.log) exit0. No further desktop lane fixes were attempted.

Complete TS guest generation: [TS build](js-guest-build.log) exit0. [Initial resolution attempt](js-guest-componentize.log) exit1 selected cached ComponentizeJS0.23 and failed native binding; driver then explicitly reads the installed **0.22.0** package's public export manifest. [Pinned generation](js-guest-componentize-pinned.log) exit1 reproducibly panics `crates/spidermonkey-embedding-splicer/src/bindgen.rs:720:47: not yet implemented`. This is the current complete async document-world compiler gap, not just citation of the old incomplete experiment. No further compiler fixes, helper installation or wasm-rquickjs new-world attempt. wasm-rquickjs remains a distinct possible route, not ruled out by this failure.

## Remaining gates / explicit nonclaims

This receipt establishes bounded same-byte async-resource feasibility and real browser + **Rust desktop** semantic interaction, **not full G1/G2 or HK1 completion**. Still required: production generated nominal facades/profile validation and source currency checks; complete byte-before-decode budgets; grant-generation semantics; retained-borrow/guest-owned-drop conformance; failed-init/late-reply/trap isolation; shrinkable/generated schedules/fuzzing and mutation tests; **measured runaway forced-stop bounds** in dedicated browser workers and native interruption; teardown under arbitrary cancellation/failure; Electrobun/Bun/WebView2 same-byte Component engine/bridge and two isolated instances; installed/relocated desktop packaging; public packed-consumer and repository-wide Rust/TS/Component release gates; Station saved-state/adoption acceptance. No cloud/runtime-host-kit production implementation is implied.

Browser Component executes on the isolated probe page, **not yet a dedicated guest worker**. Revocation checks deny later effects; finite sleeps still settle cooperatively before cleanup. Native fuel/yield limits are configured, but no runaway fixture was run. Scoped targeted commands above were run; repository-wide tests/clippy/formatting and release builds were not run for this experiment and must not be inferred.
