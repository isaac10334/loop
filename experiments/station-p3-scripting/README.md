# Station P3 scripting gate

Experimental; not a public runtime, SDK, permission membrane or production UI API.

**Selected path:** wasm-rquickjs v0.4.13, explicitly selected by the user on
October 18, 2026. Continue the lifecycle proof below. The original compiler and
its potential Wasmtime workaround remain in
[componentize-qjs-fallback.md](componentize-qjs-fallback.md).

`evaluate-only.wit`/`.js` compile a reusable QuickJS evaluator. The caller passes
newly transpiled JavaScript and JSON per invocation; the compiler is not run per
edit. Separate Component instances isolate globals; repeated calls to one
instance demonstrate retained state. No imports are exposed by this control.

`probe.wit`/`.js` add the required async service import and owned surface resource
with rendering and asynchronous events. componentize-qjs v0.4.5 fails to compile
this world, both with and without `--stub-wasi`, at the custom async import:
`instance export invoke has the wrong type: type mismatch with async`.

This matches [upstream issue 89](https://github.com/andreiltd/componentize-qjs/issues/89).
Compiler source is pinned to v0.4.5 commit
`e563c6d6ae50b087980414015663ca9c948c09bb`. On October 16, 2026 the maintainer
reported waiting for Wasmtime 50 to obtain fixes 13821 and 14396.

Station's `apps/station/scripts/probe-p3-scripting.ts` verifies the official
Windows x64 compiler executable hash, compiles these fixtures into ignored
`target/`, inspects the control's actual imports, and exercises real bytes on its
pinned Polyengine 0.6.7 runtime. Run that driver from the Station root, bundled
for Node/V8; Bun 1.3.14's JavaScriptCore rejects the control's multi-memory Wasm.
The Node control passes TypeScript evaluation, repeated changed-source calls and
retained/fresh instance checks, but the full probe remains blocked. The driver
prints provenance, stage-specific errors and timing samples, and exits nonzero
for the observed failure. It never substitutes an execution engine.

The original compiler remains blocked. No upstream host/capability API changes
depend on this experiment.

## Authorized alternative: wasm-rquickjs

October 18, 2026: Wasmtime stable is 49.0.3. The published 50.0.0-rc.1
contains fix 14396, but stable 50.0.0 and a newer componentize-qjs release are
not published. Rebuilding componentize-qjs against the release candidate is a
possible separate experiment; replacing the installed Wasmtime CLI cannot update
the compiler's embedded dependency. That rebuild has not been tested here.

`rquickjs-probe.js` implements the same `probe.wit` world using wasm-rquickjs
v0.4.13, commit `f8da7c102cb2a81c7f0b2365be24150c387f3f8b`.
Official Windows x64 archive SHA-256:
`582e356e2820c48f3dbc81e59eb395ddc552a48792f373ad8fa9e660c1aba7f5`.
Executable SHA-256:
`bc9d5aa48905e55760f18cb92ed988a34534ff0ce8824a71d6650464f8a68c63`.
`prepare-rquickjs-probe.ps1` verifies the executable, generates a P3 wrapper,
copies the retained dependency lock and builds actual Component bytes.

Two configuration requirements were observed:

- Bare `--features p3` panics during initialization because `NativeTextDecoder`
  has no constructor. Adding `encoding` avoids it; the probe does not enable
  the default logging/crypto feature set.
- The generated wit-bindgen 0.58.0 `inter-task-wakeup` feature traps on a delayed
  async import in Polyengine 0.6.7:
  `stream.cancel-read: synchronous cancel on an end that is in a waitable set`.
  Removing that feature from the generated manifest permits the same-thread
  async executor to pass. The `async` and `async-spawn` features remain enabled.
  This is an experimental compatibility setting, not a general fix for
  cross-task wakeup semantics or proof of all future/stream combinations.

Even this minimal build links WASI HTTP/socket imports. The isolated Station
probe supplies throwing denial shims for those exact interfaces; it installs no
network implementation. Baseline WASI uses captured stdio, empty filesystem
preopens and no inherited arguments/environment. These shims are not production
profiles or a general grants implementation.

The resulting reusable evaluator passes on Station's unchanged Polyengine 0.6.7
under Node 25.9/V8 and in the in-app Chromium browser worker:

- TypeScript transpilation followed by evaluation returning `42`, including a
  genuinely delayed async host service call;
- ten changed-source evaluations without re-componentizing;
- retained globals `1,2` versus `1` in a fresh Component instance;
- surface render, delayed event delivery and explicit resource disposal;
- session state `7,10`, explicit Stop and session disposal;
- rejection of an unwired service binding.

The report prints component/translator hashes, inspected import leaves and timing
samples. It deliberately reports `fullAcceptanceComplete: false`. Cancellation
and revocation with in-flight subscriptions, hard execution/memory/output bounds,
retained-handle authority, DOM/recording adapter parity, UI interaction and installed
desktop acceptance remain unproven. The surface in this probe records text; it is
not a portable DOM renderer. A successful compatibility probe does not authorize
production activation or broaden existing Component profiles.

From this directory:

```powershell
./prepare-rquickjs-probe.ps1 -Compiler <absolute-wasm-rquickjs.exe> -Profile compatibility
```

From Station's repository root:

```powershell
bun build apps/station/scripts/probe-rquickjs-scripting.ts --target node --outfile "$env:TEMP/station-rquickjs-probe.mjs"
node "$env:TEMP/station-rquickjs-probe.mjs" C:/src/ilt/loop/experiments/station-p3-scripting/target/rquickjs-wrapper/target/wasm32-wasip2/release/probe.wasm
bun build apps/station/scripts/probe-rquickjs-browser.ts --target browser --outfile "$env:TEMP/station-rquickjs-browser.js"
bun apps/station/scripts/serve-rquickjs-probe.ts C:/src/ilt/loop/experiments/station-p3-scripting/target/rquickjs-wrapper/target/wasm32-wasip2/release/probe.wasm "$env:TEMP/station-rquickjs-browser.js"
```

Open `http://127.0.0.1:3021/` for the isolated browser-worker report. The server
serves only four known fixtures and has no workspace/profile access. The worker
is terminated after the result or a 60-second watchdog; that watchdog is test
harness cleanup, not guest cancellation acceptance.

Without `-Profile compatibility`, preparation selects the lifecycle profile below.

## Bounded lifecycle proof (selected)

`lifecycle.wit` and `rquickjs-lifecycle.js` use a separate experimental WIT package
with async subscription creation and owned subscription/surface resources. The
preparation script defaults to `target/rquickjs-lifecycle`, pins Rust
`nightly-2026-09-08`, disables the incompatible inter-task-wakeup feature, limits
the QuickJS heap to 16 MiB and the Wasm linear memory to 64 MiB. The separate
inspector checks the actual embedded core memories for explicit maxima; it does
not infer a limit from build flags. Source, generated source/WIT, dependency lock,
build recipe, compiler hash and resulting bytes are recorded at build time.
Invocation rejects stale source/dependencies instead of attaching a fresh source
hash to old bytes.

Station's `scripts/scripting-proof` contains a fixed worker and external host
fixture, shared by Node and Browser. User source is evaluated only in the verified
QuickJS Component. The parent owns fixture services, grants, resource handles,
pending reads and cancellation. Stop clears them synchronously and terminates the
worker, including when the guest loops forever. Failed guest calls also dispose
the session. Late replies are discarded after closure. Sync surface updates are
queued over the private transport and their authorization failures are checked
before accepting an export result.

Wire schemas bound source to 32 KiB, JSON/result/host payloads and logs to 4 KiB,
live resources to eight, host calls to 512 and pending worker RPCs to sixteen.
No network implementation, real filesystem, inherited environment or application
store is installed. This is an isolated local proof, not a hostile-marketplace
isolation attestation or a production API. The original Component verifier and
legacy profiles are unchanged.

Reproduce from Station after the preparation command:

```powershell
# First, from the Loop experiment directory:
./prepare-rquickjs-probe.ps1 -Compiler <absolute-wasm-rquickjs.exe>
# Then, from Station:
bun build apps/station/scripts/scripting-proof/node-worker.ts --target node --outfile "$env:TEMP/station-rquickjs-lifecycle-worker.mjs"
bun build apps/station/scripts/probe-rquickjs-lifecycle.ts --target node --outfile "$env:TEMP/station-rquickjs-lifecycle.mjs"
node "$env:TEMP/station-rquickjs-lifecycle.mjs" C:/src/ilt/loop/experiments/station-p3-scripting "$env:TEMP/station-rquickjs-lifecycle-worker.mjs"
bun build apps/station/scripts/scripting-proof/browser-worker.ts --target browser --outfile "$env:TEMP/station-rquickjs-lifecycle-browser-worker.js"
bun build apps/station/scripts/probe-rquickjs-lifecycle-browser.ts --target browser --outfile "$env:TEMP/station-rquickjs-lifecycle-browser.js"
bun apps/station/scripts/serve-rquickjs-lifecycle.ts C:/src/ilt/loop/experiments/station-p3-scripting "$env:TEMP/station-rquickjs-lifecycle-browser-worker.js" "$env:TEMP/station-rquickjs-lifecycle-browser.js"
```

The Node driver verifies build identity and writes an inspected proof manifest
used by the browser fixture at `http://127.0.0.1:3021/`. The browser uses a
same-origin-only CSP and the same behavioral suite. Reports retain stage timings,
zero-resource cleanup snapshots, source/byte/import hashes and explicit remaining
acceptance. Fixture bindings named `source.read` and `metadata.write` are denied;
these tests do not claim integration with real Station asset policy.

Portable semantic UI, DOM/recording renderer parity, production profiles and
editor/agent integration, shared real services, packaging and installed desktop
acceptance remain separate work. `fullAcceptanceComplete` stays false.

### October 18 lifecycle acceptance

Twenty real-byte checks pass in Node 25.9/V8 and the in-app Chromium browser,
including bounded logs/resources, service revocation during a pending call and
ending pending subscription reads on service Stop. Five focused Bun tests cover
wire bounds, memory inspection and host cancellation. An additional CLI negative
test temporarily edited the evaluator source, confirmed stale-build rejection
before invocation, then restored the source byte-for-byte. Browser console
warnings/errors were empty. Station typecheck, build and the existing Component
build/run check pass independently.

Diagnostic samples, not performance guarantees:

| Measurement | Node | Browser |
| --- | ---: | ---: |
| Worker startup through inspected instantiation | 226 ms | 416 ms |
| TypeScript transpilation through async result (15 ms service delay included) | 203 ms | 326 ms |
| Ten warm changed-source evaluations | 4.6 ms | 6.1 ms |
| Stop through host-resource cleanup/rejection | 0.15 ms | 0.5 ms |

These Stop timings measure host cleanup, not OS thread reclamation. The runaway
case uses a 150 ms execution deadline outside the worker. The accepted engine
sample is 5,788,773 bytes, SHA-256
`0c492049e179e6d8564a452006bc7a86d673c3172c00de0fb2e063b519c1b706`.
Build-time provenance and each report remain authoritative for later rebuilds.
