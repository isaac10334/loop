# Async document runtime

Status: proposed; first implementation slice, October 30, 2026. Covers G1/G2.
Outcome: run identical Rust Component bytes in browser Polyengine and Wasmtime,
changing only a host-issued document through real suspending read/CAS-write calls.
Preserve the existing synchronous tooling fixture at `tooling/fixtures/wit/editor.wit` and its WIT identity.

## Boundary and ownership

Loop owns the new callable profile, generated descriptors/facades, instance
mechanisms and conformance fixtures. Hosts supply document storage and policy.
host application retains asset currentness, grants, editor drafts and concrete worker URLs.
Choose files/packages through `repo context`; do not move the whole grant/store
layer or create an empty runtime package. Both adapters consume one source world.

Candidate WIT, exercised by the November disposable probe but not an accepted
production execution profile:

```wit
package loop:document-tool@0.1.0;
interface documents {
  record snapshot { revision: string, source: string }
  variant failure {
    denied, revoked, conflict(snapshot), invalid-source(string),
    cancelled, unavailable,
  }
  resource document {
    read: async func() -> result<snapshot, failure>;
    write: async func(expected-revision: string, source: string)
      -> result<snapshot, failure>;
  }
}
world tool {
  import documents;
  use documents.{document, failure};
  export replace-text: async func(
    document: borrow<document>, %from: string, to: string
  ) -> result<string, failure>;
}
```

November 3 disposable feasibility compiled this candidate with `%from` (WIT's
escaped spelling of the keyword identifier). The [probe receipt](../experiments/host-kits-2026-11-03/README.md)
records same-byte native/browser results and remaining limits; it does not complete
this production gate. [Host-kit composition](host-kits.md#7-component-profile-and-runtime-gap-matrix)
uses a separately identified semantic-surface extension rather than widening this
world. Preserve the old sync fixture and production consumer profiles.

Resolve the exact package/interface/version identity and inspected signatures,
including async, own/borrow and errors. Structural shape matching alone cannot
authorize or alias another interface. A deliberate adapter has a recorded version
and conformance tests. Do not retrofit async semantics into the old world.

## Imported host APIs

The guest receives a document resource that trusted policy opens. It receives no
filesystem path lookup, arbitrary asset-ID lookup, raw scope or owner dispatcher.
The profile permits `documents` and only runtime essentials emitted by the pinned
compiler. Record every actual WASI import and provider in the feasibility receipt.
Use explicit denial providers for unavoidable unused imports. Do not broaden
filesystem/network/environment access to fix a linker error. Add each useful
interface through a new reviewed profile revision and a consumer test.

The provider binds document identity, principal, read/write rights and grant
generation. Check rights and revocation on each use. Serialize authorization,
expected-revision validation and commit under one owner/transaction. A stale write
returns conflict without replacing the caller's draft. Bound source/input/output
bytes before decoding or committing; freeze the measured values in the profile.

## Lifecycle and completion

Instantiate from verified bytes and a generated runtime-specific facade. Check
source/artifact currency, actual imports/exports and world profile before guest
entry. Metadata/source hashes are distinct from the runtime's ABI/world digest.
WIT/Cargo/npm locks pin separate dependencies. Generated files identify their tools.

Start with serialized entry, one instance per authority/failure lifetime and
bounded pending calls. An async borrow lives for the ABI-defined call lifetime;
retention past it fails. Drop releases the relevant handle, not its siblings.
Revocation denies later use, cancels owned work and waits for cleanup. Cancellation
before the commit linearization point forbids that commit. Committed mutations
remain committed; suppress stale UI/output promotion and report uncertain remote
outcomes. No implicit retry of writes.

The adapter owns forced stop for a guest that cannot yield: terminate its worker
in the browser; use measured Wasmtime interruption/fuel limits natively. Prove a
documented wall-time bound for each. Stop closes host resources even if guest
disposal never runs. Reuse compiled code, not mutable privileged instances.

## Executable acceptance

| Obligation | Evidence |
| --- | --- |
| Fresh source and same bytes | Record source/tool hashes; change source and observe changed output from that artifact in both hosts. |
| Genuine async resource | Delay read and write; show suspension/resumption without a synchronous stub or host reentry error. |
| Authority | Viewer write and wrong/forged resource fail without mutation; retained resource fails after revoke. |
| Revision race | Concurrent expected-revision writes admit one winner; preserve the loser's draft. |
| Cancellation race | Schedule cancel/revoke before, during and after commit; assert the stated linearization rules. |
| Lifetime | Borrow/drop/owner close, late replies and failed initialization leak no live resources/tasks. |
| Failure isolation | Trap/timeout/runaway one instance; another instance's state/grants remain intact. |
| Host integration | Real browser input and native invocation show output; command success alone is insufficient. |

Use generated operation sequences to exercise acquire/read/write/revoke/drop and
shrinking/replayable schedules for races. Fuzz bounded input decoders, malformed
artifacts/import profiles and resource identifiers in an isolated test runner.
Check that removing a grant/revision/generation check makes its test fail; keep
examples that catch distinct faults. Run repository-required Rust, TS, Component
and packed-consumer checks. Record timings by build/translation/instantiate/call.

First deliver a feasibility receipt with actual compiler/WASI/runtime versions,
embedded imports and same-artifact runs. If a host fails, record the exact
ABI gap and keep its gate unfinished (G1 native, G2 browser/host application). Inspect
bounded alternatives; do not relabel a
sync guest, a web editor or the old native starter as this profile's acceptance.
