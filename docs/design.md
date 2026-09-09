# The implemented slice

Two crates: **loop-host** embeds Wasmtime and supplies concrete notes and desktop/headless integrations; **loop-cli** contains a small development module that invokes existing tools. There is no runtime registry or backend abstraction. `loop-dev` is unnecessary until another consumer needs the development operations.

## Packages and providers

`crates/loop-host/wit` is the editable `loopkit:app@0.1.0` contract: scoped notes, semantic UI, async application and synchronous compatibility worlds. `wit/signals` is a small local shared types package. `wit/probe` imports it plus pinned WASI random definitions and demonstrates async imports/exports, `future<T>` and `stream<T>`.

A provider is a role. `Notes` is a native Rust provider of the WIT notes interface; the generated Rust and TypeScript guests provide application dispatch. The probe's host supplies an event, delayed future and finite stream. Generated host bindings and guest bindings share WIT definitions, not implementation code. Native providers are compile-time dependencies.

The WIT namespace is `loopkit`: Wasmtime 48.0.0's generated bindings for `loop:app` failed with `expected type, found keyword loop`. Renaming this initial contract avoided an upstream patch. Probe root functions don't generate that namespace path and retain `loop:probe`.

## Grants and lifecycle

Each notes resource retains exactly one host-issued scope. Acquire never elevates rights. Every read/write checks revocation and rights under the same mutex as the operation. This lock is the linearization point: a committed operation remains complete; revocation rejects later operations through existing handles. There are no asynchronous note commits in this version. Dropping a resource releases that handle, not other handles; dropping the store releases all its resources. Revocation is permanent, even if native policy subsequently changes rights.

No filesystem preopens, inherited environment, or network addresses are granted. Memory is capped at 256 MiB per Wasm memory and fuel is replenished per action with cooperative yielding. A dispatch has a ten-second timeout. Cancelled or trapped instances are poisoned and must be dropped/reloaded. This is a development host, not a multi-tenant service.

## UI semantics and routing

The guest returns a bounded tree (1–128 nodes) encoded as a flat parent-index list. Parents precede children. Only rows/columns contain children. Text is literal text content, never HTML. Buttons carry typed actions. CSS flexbox implements rows/columns, gaps in CSS logical pixels, start/center/end/stretch cross-axis alignment, natural content sizing, and wrapping rows. Text wraps within the window. Gap is bounded to 64 pixels; text/status are bounded to 4096 bytes. The first renderer adds fixed visual styling to the starter hierarchy; this is not a full theme/widget engine.

The main window thread renders and routes a small JSON action enum. A dedicated worker owns the runtime/store and handles actions sequentially through a bounded queue. The renderer disables buttons while waiting; the busy animation remains on the UI thread. Close drops the work future and store, discards queued actions and joins the worker. Fuel yields permit interruption of CPU-bound guest execution. Headless dispatch uses exactly the same contract and validation.

Windows uses Tao + Wry + installed WebView2. The sole bundled custom-protocol document (`loop://localhost/`, mapped by Wry to `http://loop.localhost/` on Windows) is the only bridge origin. Navigation away and new windows are denied. CSP denies network, frames, form actions and external scripts; only bundled inline style/script runs. Messages are size-limited, typed and accepted only for this document. No general filesystem/process/evaluate-script guest API exists. Host rendering uses JSON serialization and DOM textContent. WebView2's process architecture is an implementation detail, not a loop isolation guarantee.

## Future direction (not implemented)

DOM plus WebGPU regions need explicit bounds, clipping, scale, focus, pointer and IME ownership. A later webview package may support browser iframe, system webview and CEF providers with capability reporting and navigation/bridge lifetime rules. Neither component generation nor a JS-authored guest gives automatic DOM access. Browser hosting needs its own Jco proof against the same contracts. Defer CEF, GPU APIs, browser VMs, wRPC and DLL loading.

## Glossary

- **Workspace**: editable development directory, including source components and local tools.
- **Application**: runnable composition using a supported guest world and selected host.
- **Component**: implementation in WebAssembly Component Model format.
- **Provider**: implementation supplying an interface; native and component are implementation forms.
- **Package**: named versioned unit of contracts or source; WIT definitions are not executable providers.
- **Grant**: host policy authorizing scoped operations, checked at use time.
- **Task**: structured local work (Rust/JS/host build or packaging); not necessarily a component.
- **Execution platform**: where tools run; **output target**: what they produce.
- **Product**: prose description of a user offering; no second runtime schema.

## loop-cloud (documentation only)

A registry should identify immutable artifacts and provenance separately from mutable discovery names. Artifacts include components, source packages, executables and data assets with platform requirements. Remote execution must name its executor, inputs, output target and authority; a Wasm caller never magically sandboxes a native build. Application hosting must resolve concrete contracts, isolate state and tenant authority, and define cancellation, quotas and revocation at runtime. Reuse ecosystem locks and registries where they fit; don't invent a universal solver or distributed task graph. Signing, artifact trust, tenancy and revocation propagation remain open design work.
