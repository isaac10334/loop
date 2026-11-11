# Runtime reference

October 30, 2026. Read [Architecture](../../ARCHITECTURE.md) for implemented
ownership and [the runtime spec](../../specs/async-document-runtime.md) for the
next contract. The vocabulary below does not turn a proposed adapter into an API.

| Term | Meaning |
| --- | --- |
| Contract / WIT interface | Versioned callable types, errors, functions and nominal resources. |
| WIT world | A Component boundary's imports and exports. |
| Provider | Implementation in JS, a Component, native code or a remote adapter. |
| Binding | Explicit connection to an implementation and reviewed configuration. |
| Grant | Principal/resource/operation policy with restrictions and lifetime. |
| Resource | Owned/borrowed nominal handle, implemented by host or guest; a host issues scoped access. |
| Scope / instance | Cleanup owner / one execution and mutable-state lifetime. |
| Asset revision / head | Immutable authored content / checked mutable selection of a revision. |
| Package / contribution | Pinned distribution description / declaration targeting an extension point. |

Keep Service as a useful role for a running instance. A provider package does not
need a parallel Plugin lifecycle. Native provider installation has a stronger
trust path than Component or web-content activation.

## Calls, composition and metadata

UI, CLI and agents use the same operation policy. A command exposes a typed method
for discovery and invocation; its transport cannot call private owner dispatch.
Declare effects, resource selectors, retry/idempotency policy and editor metadata
beside qualified WIT identities. Treat those declarations as claims that the host
must enforce. Knowing an interface or holding a diagnostic scope ID grants nothing.

Resolve the complete WIT package/interface/version identity and type profile.
Structural similarity can diagnose incompatibility; it cannot alias identities,
grant access or excuse a version mismatch. An explicit adapter needs its own
identity, provenance and tests. Generate JSON/type views from maintained parsers;
arbitrary resources/streams do not map losslessly to JSON Schema or gRPC.

Static composition creates a new artifact. Host-managed linking retains separate
instances/lifetimes. Record the resolved graph and adapter hashes, reject accidental
cycles, and prove resource ownership across each bridge. Neither form supplies
permissions, parallel CPU execution or durable recovery. Use independent workers
or runtime preemption for forced stop; AbortSignal alone is cooperative.

Cache immutable bytes, translations and compiled modules. Give unrelated
principals fresh mutable instances. A profile must prove reentrant entry before a
host permits it. Request/response, bounded streams, lossy datagrams and durable
jobs each need their own completion/failure contract.

## Current execution paths

[HK1](../../specs/host-kits.md) proposes typed kit composition and a trusted
Rust/Bun config boundary. Kits select reviewed integrations; they do not grant
guest authority, bridge missing ABIs or require all product/tooling code to become
Components. [The November audit](../development-alpha/host-kits-evidence.md) keeps
new disposable feasibility separate from the production runtime gate.

The JS lifecycle host and Rust Wasmtime host remain separate implementations.
The Rust CLI has its existing application world, templates and release path.
The [native proof](../windows-desktop-proof.md) does not establish a general JS
Component-provider adapter. The independent SVG editor is sandboxed web code.

Loop's QuickJS evaluator has static `evaluate/start/dispatch/stop` exports and one
active logical session. Station owns a worker per program instance. Calling
`start` does not create a new realm. Dynamic logical methods do not add WIT exports
or imports. Fresh QuickJS contexts share a runtime heap; separate QuickJS runtimes
inside one Component still share its outer memory and host capabilities.
The pinned upstream engine also contains fresh-runtime execution-job machinery;
Station has not proved or adopted it as a multi-tenant Loop session API.

Keep Component, dynamic-script and sandboxed-web execution profiles distinct.
Each profile needs import inspection, budgets, per-use authority and forced-stop
evidence. Runtime-specific generated bindings matter: jco declarations are not a
Polyengine facade. Direct WIT TS7.1 imports currently have CLI evidence; exact
editor navigation/completion still needs an observed acceptance run.

## Research boundaries

[Polyengine](https://github.com/polymorph-components/polyengine) separates runtime
translation, typed WIT facade generation and Component linking. Verify the pinned
runtime's supported ABI; a source-generator success does not prove execution.
[wRPC's pinned JS implementation](https://github.com/bytecodealliance/wrpc/blob/dcdef4b3e78c4d2581e0b32c46695868dc85c978/js/README.md)
supports dynamic WIT type-tree calls. Observe full invocation/stream completion,
backpressure and failure. Its resource bytes require application-owned authority
and lifecycle mapping; its stream protocol is not an unreliable datagram API.

[Cordis](https://arxiv.org/abs/2608.25512) and its
[primer](https://deepseek-harness.github.io/deepseek-harness/en/reference/cordis-primer)
inform dependency readiness and owned registrations. Paper sections 6.1, 6.3 and
6.6 distinguish external emitted effects, external sandboxing and nominal linking
limits. Local event dispatch is not a durable journal. Cleanup removes a listener
or closes a channel; it does not reverse a committed document or sent message.

Collections, properties, theme aliases and semantic UI build above these boundaries.
Use typed values, stable identities, bounded relations and cycle checks. Keep
measured simulation/audio/GPU data paths separate from reflective document queries.
Portable widget, placement/docking and property mechanisms can be extracted after
a real second consumer proves their contracts. Station retains desks, saved state,
defaults, concrete renderers and product policy during that extraction.
