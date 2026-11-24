# Desktop backends: Rust and Electrobun

Research reviewed November 4, 2026. **This is an integration decision/reference,
not a claim that Loop's new kits exist.** The [host-kit spec](../../specs/host-kits.md)
owns proposed contracts; [the implementation lane](../development-alpha/execution-plan.md#host-kit-implementation-lane)
owns work. [Current CLI usage](../cli.md) describes working commands.

## Recommendation

Build the reusable **Rust/Wasmtime Component runtime first**, with explicit policy,
resource ownership and interruption. Use the existing Tao/Wry system-webview path
for the first native presentation adapter. Keep typed TypeScript/Bun composition,
ordinary TS providers and portable public packages; Rust-first does not mean moving
the whole SDK or every application into Rust/Wasm.

**November 7 scope decision:** official kits are Rust desktop and browser only.
Electrobun is not an official backend, required exemplar or dependency. The earlier
required-example recommendation is superseded. Keep the research below as evidence,
not an instruction to spend the implementation mission on a framework integration.

Optional compatibility examples can demonstrate existing public ports across
language ecosystems. Electrobun may be one isolated example if straightforward;
defer it if it needs SDK wrangling, framework patches/forks or new production
services. Do not change the official core, packaging or release criteria for it.
host application's separate Electrobun product remains unchanged.

## What Electrobun actually supplies

The current [documentation home](https://docs.electrobun.dev/) advertises newer
releases than host application's `2.0.3-beta.26`. The following claims use that exact tag,
resolved through [GitHub's tag API](https://api.github.com/repos/blackboardsh/electrobun/git/ref/tags/v2.0.3-beta.26)
to commit `c4bbeca07829d9b1634d31598ef6091fb19ace2a`. A newer release requires a
separate compatibility decision; its documentation is not evidence for the pin.

| Feature | Evidence at the inspected pin | Loop integration consequence |
| --- | --- | --- |
| Rust main process | [Native runtimes](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/docs/src/content/docs/electrobun/guides/native-main-process.mdx) supports `build.mainProcess: rust`, normal Cargo inputs and projected Rust SDK. | Real native support, not merely Bun FFI. It is not a WASM Component compiler/runtime or a Loop grant system. |
| Native SDK reuse | [Rust SDK](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/package/src/sdks/rust/electrobun.rs) loads ElectrobunCore, runs the main-thread event loop and expects adjacent core/packaged preload resources. | Wrap the public SDK as an outer adapter; honor its bundle/thread/callback ownership. Supervise separate processes for independent instances. |
| API parity | [Main API coverage](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/docs/src/content/docs/electrobun/apis/main.mdx) gives Rust windows/views and native APIs, but raw JSON RPC rather than TS typed RPC; some wrappers are TS-only. | Supply Loop's own bounded schemas, exact identities and cancellation/authority checks. Language support does not imply feature parity. |
| Native GPU | [WebGPU](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/docs/src/content/docs/electrobun/apis/webgpu.mdx) uses Dawn; Rust has native view/bootstrap and main-thread configure/acquire/present, not a complete safe wrapper for `webgpu.h`. | Keep GPU an optional separately tested provider. Browser `navigator.gpu`, native Dawn and Rust `wgpu` are different integrations; no universal texture sharing is implied. |
| CEF/system webviews | [CEF packaging](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/docs/src/content/docs/electrobun/apis/bundling-cef.mdx) makes CEF opt-in, with extra libraries/helpers/resources/locales; Linux selects CEF or GTK WebKit per process. | Declare supported profiles and fail a CEF-required target if absent. Do not silently substitute a native webview or promise cross-platform mixing. |
| DOM/native composition | [Webview-tag architecture](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/docs/src/content/docs/electrobun/guides/architecture/webview-tag.mdx) anchors separate native views to DOM geometry; masks/clipping, overlap and input have platform constraints. | These are not ordinary DOM children. Test focus, IME, DPI/zoom, occlusion and event ownership; CSS z-index alone cannot establish correct composition. |
| Auto-update | [Updater](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/docs/src/content/docs/electrobun/apis/updater.mdx) explicitly supports Bun/Cottontail only; native Rust has no update API. Dev channel never reports updates. | Reuse through a Bun-owned shell if selected. Do not promise automatic updates for the native Rust kit, or transplant private updater helpers into a generic Wry executable. |

The [current UI tutorial](https://docs.electrobun.dev/electrobun/guides/creating-ui/)
is useful for understanding host pages and native view anchors, but current
upstream feature/security claims still require version- and platform-specific
acceptance. Loop semantic UI does not become Electrobun UI merely by choosing a kit.

## Toolchain, packaging and trust

The Electrobun-specific notes below apply only to an explicitly selected isolated
compatibility example or host application's existing product. They impose no preparation,
implementation or feature-parity requirement on the official Loop kits.

The installed `electrobun` npm package is a bootstrap shim. Runtime APIs resolve
from the **prepared project devkit**, not that npm export. host application's app-local
projection has the intended beta pin; another workspace projection can be stale.
An adapter must inspect the selected project manifest, core/SDK/launcher/assets
and hashes instead of searching a user's cache and choosing the nearest match.

Upstream Hutch can prepare/download during build/run/dev. Loop's proposed contract
requires a separate explicit preparation operation and offline preflight thereafter.
Config inspection must not trigger downloads, devkit mutation or a package manager.
Missing inputs produce `E_DESKTOP_TOOLCHAIN`, not a false claim that Electrobun is
unavailable or a silent different-backend fallback. Packs must contain required
runtime resources and notices, with no `.hutch`/checkout/user-cache paths.

Electrobun's webview sandbox/RPC switches do not supply Loop authorization.
host application's current Windows integration uses additional native policy patches;
the [pinned Windows wrapper](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/package/src/native/win/nativeWrapper.cpp)
contains security-disabling browser flags that its adapter removes. New foreign-
content support needs pre-effect navigation/download/device/bridge denial tests,
not an assumption that embedding a view isolates it. Keep host application's existing
policy, saved identities, updater and packaged native patch intact.

## Shared ports, different compositions

```text
Typed loop.config.ts / trusted Bun coordinator
          |
          +-- native kit: Rust/Wasmtime + Tao/Wry presentation
          |
Optional isolated compatibility example (not an official kit):
  external shell/client in another ecosystem -> existing public runtime ports
  (Electrobun is one possible example, not a required integration)

Browser kit: semantic DOM renderer + reviewed Component worker adapter
```

Share only proven contracts: runtime invocation/cancellation and inspected artifact
identity, nominal granted resources, revisioned semantic surfaces, explicit desktop
feature availability and owned disposal. Keep OS objects, raw pointers, live grants
and arbitrary callbacks out of the wire. The provider bridge maps reviewed WIT
imports to checked operations; config can request bindings but cannot issue grants.
A process boundary provides supervision, not authorization by itself.

Native Rust first does not require implementing CEF, a GPU library or an updater
from scratch. Advertise missing capabilities as unsupported and keep the existing
manual distribution path until a tested adapter exists. Electrobun is useful
precisely because it can supply richer optional platform services without moving
those dependencies into Loop's portable resolution/contracts.

## Implementation decision gates

1. Freeze one port/protocol/profile contract before splitting native and Electrobun
   writers. Preserve public host/UI/workspace APIs and the old application WIT.
2. Promote the [real same-byte probe](../../experiments/host-kits-2026-11-03/README.md)
   into reusable production adapters: fresh source/byte/import receipts, granted
   async document CAS, semantic event/frame, denial/revoke/races/borrow/drop, quotas
   and measured runaway stop. The probe did not complete those production gates.
3. Run the native kit with actual pointer and keyboard input, two independent
   processes/profiles, failed-start unwind and close/cancel/join. Build and relocate
   a standalone bundle without checkout access.
4. **Optional only:** if an Electrobun compatibility example is selected and cheap,
   build it from its explicitly prepared pinned SDK. Exercise
   the same runtime contract through a supervised Rust provider, not a RecordingSurface
   or fake Component. Verify foreign/stale IPC, independent instances, exact owned
   resources and packaged relocation. A public SDK import failure is a preparation
   boundary to investigate, not a reason to stop at a stub.
5. If selecting CEF/GPU, add a measured platform profile for composition, focus,
   resource budgets, resize/device loss and disposal. A simple window does not
   establish these features. Keep them outside the minimum document-tool release.
6. If claiming updates, use an isolated packaged canary A-to-B feed: wrong identity/
   channel/digest rejection, quit veto, replacement failure/rollback and profile
   retention. Reading updater metadata or running dev mode is not update acceptance.

## When a fork is justified

Prefer the public SDK and an upstream patch. Consider a maintained fork only after
an exact pinned source investigation reproduces a required security/lifecycle/API
gap that no supported extension solves. Record the minimal patch, owner, upstream
issue/PR, rebase/security-update budget, provenance and distribution tests. A local
patch is not permission to fork/publish remotely or migrate host application.

The [pinned MIT license](https://raw.githubusercontent.com/blackboardsh/electrobun/c4bbeca07829d9b1634d31598ef6091fb19ace2a/LICENSE)
permits adaptation with its notices; it gives no support SLA or warranty. CEF,
Dawn and other redistributed artifacts have their own license/update obligations.
Do not inspect/fetch/fork Electrobun as part of the official implementation mission.
A compatibility example that requires a fork is deferred; a future separately
scoped investigation would need its own concrete justification.
