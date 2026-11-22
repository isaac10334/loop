# Roadmap and current limits

Loop Kit's next goal is a dependable path from a small application to a composed browser or Windows tool—not a larger package inventory.

## Next user-facing outcomes

1. **Install the demonstrated implementation.** Coordinate a new host crate and CLI release, then publish the reviewed npm packages so examples no longer need local tarball overrides.
2. **Make Component limits explicit and enforceable.** Close the browser canonical ABI pre-decode allocation gap before describing hostile-guest budget conformance as complete.
3. **Grow from real applications.** Use a small shell/input/UI specification to identify missing semantic behavior, with independent instances and disposal acceptance.

## Limits today

- Initial native presentation is Windows-only and supports a subset of semantic elements.
- Browser Component evidence is Chromium-family evidence, not Safari, Firefox or every WebView.
- The async document profile is a reviewed profile, not arbitrary-world execution or proven language parity.
- Trusted TypeScript configuration/providers are not sandboxed by scopes or process framing.
- No cloud marketplace, universal capability registry, voxel engine, multiplayer stack or GPU platform is included.

## Two demanding applications

**Wizard Tower** is intended to become a multiscale microvoxel simulation game. Its current planetary experiment uses a browser host kit, an import-free simulation Component and application-owned WebGPU shaders. That demonstration is not a microvoxel engine or a GPU-authoritative solver. Loop's experimental browser GPU session helper owns device acquisition, tracked buffers and canvas cleanup; it does not supply a rendering engine, spatial fields or adaptive simulation scheduling.

**Jettbot** is intended to become a Discord voice AI participant with independently labeled incoming audio streams. Its requirements include overlapping speakers, addressee inference, interruptible output and restrained turn-taking. A headless runtime is only its execution foundation: Discord transport, consent/retention policy, speech recognition and synthesis, conversation inference and model integration need their own implementations and acceptance tests. They are not supplied by the generic capability host.

The [capability matrix](support.md) distinguishes reusable Loop implementation from application-owned behavior and planned work for browser, Rust desktop and headless hosts.

## GPU integration direction

Shader composition, native GPU execution and guest GPU imports are separate layers:

- [WESL](https://wesl-lang.dev/) adds shader imports, conditional compilation and packages on top of WGSL. It is a candidate for reusable shader libraries, not a device allocator or permission system.
- [wgpu](https://github.com/gfx-rs/wgpu) is a candidate for native Rust compute/rendering providers. Its backend support does not establish Loop's native GPU support.
- [wasi:webgpu](https://github.com/WebAssembly/wasi-webgpu) describes GPU imports for WebAssembly Components. The upstream README identifies it as a Phase 2 proposal and excludes window presentation.
- [wasi-gfx](https://wasi-gfx.dev/) supplies a related ecosystem of WIT interfaces, native runtime and browser shims for graphical Components. It is an integration candidate, not a dependency or supported Loop profile today.

Before exposing GPU work to a guest, pin the interface and implementation, define resource/queue budgets and per-use grants, and verify cancellation, device loss and independent-instance disposal. Browser WebGPU access from trusted application code is not evidence that these guest or native contracts are implemented. GPU floating-point results also need their own reproducibility policy before they can become simulation authority.
