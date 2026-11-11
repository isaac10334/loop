# Contract catalog and workflow

Use WIT for portable callable interfaces. Keep metadata for effects, authorization
selectors, documentation and editor presentation adjacent to its owning contract;
metadata never grants access. Existing identities remain compatibility contracts.

| Contract source | State and owner |
| --- | --- |
| [Native application](../crates/loop-host/wit/application.wit) | Implemented scoped Rust host/starter profile; not a generic TypeScript host adapter. |
| [Scripting engine](../packages/scripting/engine/world.wit) | Fixed engine imports/exports; dynamic script methods use this engine ABI. |
| [Scripting services](../packages/scripting/wit/services.wit) | Engine service bridge; concrete hosts enforce access. |
| [UI surfaces](../packages/ui/wit/surfaces.wit) | Surface protocol; support depends on the actual host/profile. |
| [Async document runtime](../specs/async-document-runtime.md) | Proposed new profile; requires parser, resource and real-host acceptance. |

Tool-only WIT lives in [tooling fixtures](../tooling/fixtures/wit/README.md), not
the standard-surface catalog. WIT/world profiles can stay beside their owning
package/crate; this index does not require copying them into one directory.

1. Write the problem, proposed interface/world, lifetime/authority/error rules and
   executable acceptance in an owning spec. Put unresolved choices in QUESTIONS.
2. Reuse pinned WASI interfaces where they fit. A renamed or extended interface is
   a different import identity; field similarity does not make an existing WASI
   guest link to it. Document explicit adapters instead of claiming TS-style
   structural interchangeability. Third-party namespaces are valid contracts too.
3. Pin dependencies and generators. Inspect actual imports/exports and generated
   resource conventions; preserve separate source and ABI/profile identities.
4. Supply a minimal provider per supported target. Mark unsupported targets rather
   than adding a shim that claims functionality it cannot supply.
5. Prove valid calls, denial/revocation, cancellation/drop, version mismatch and
   one independent consumer before calling the interface supported. Record the
   runtime/toolchain and artifact identities; regenerate/check bindings in CI.

The standard surface is modular. A world imports only what it needs. Privilege
comes from host-issued authority and enforced operations, not from shipping a
provider as a Component, DLL, sidecar or ordinary JavaScript package.
