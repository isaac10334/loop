# Foreground development

Status: proposed; follows the async document gate, October 30, 2026. Covers G3.
Outcome: edit a file-first tool, build a snapshot, replace its running generation
and retain the editor, selection and unsaved source through success or failure.
Local operation works offline without accounts or a background service.

## Core and clients

Use one development core behind injected source/build/run/inspect ports. CLI,
host application, docs and agent adapters invoke those ports through the same policy owner;
the CLI need not run as a subprocess inside host application. Begin in the foreground with
stdio for a parent process. Background mode, tray UI and MCP can adapt that core
later. Reuse the existing harness instead of creating another conversation system.

Candidate entrypoints: `loop dev <workspace>` and JSON inspection of source,
build and run identities. Existing `loop create/add/run/build/doctor` grammar and
embedded starters remain compatibility contracts. Inspect their parser/templates
before selecting flags; do not assume a new `build --provider` grammar exists.

Input: explicit `loop.package.json`, selected file root, pinned dependencies and
one literal build recipe. Output: immutable source snapshot, build receipt,
candidate/active generation IDs and bounded operation events. Reuse current
`@loop-kit/workspace` snapshot/change contracts. Paths are projections, not asset
identity. Keep `.loop` derived data ignored and dependencies read-only until an
explicit fork/checkout. Fetch the selected closure; offline prefetch is separate.

## Build and replacement

1. Advance draft revision and invalidate its old build association.
2. Snapshot exact files/dependencies; record toolchain, recipe, target/profile and
   environment inputs. Run the selected trusted-local compiler provider.
3. Verify receipt and bytes. Keep the last working execution during compilation.
4. Instantiate a candidate with read-only/staged effects; run its health check.
5. Quiesce old writes. Transfer versioned state only through a declared adapter;
   incompatible state requires a visible restart.
6. Switch active generation under one owner. Revoke old handles, cancel tasks and
   join cleanup; route new invocations only to the selected generation.
7. Keep editor/draft state in its sibling scope. Report build/activation/migration
   failures there; do not replace the last good generation on failure.

Candidate and old generations cannot both write shared resources during health
checks. State transfer is optional. After activation performs external writes,
rollback may require compensation and can fail. Prevent stale builds and late
results from winning after a newer edit, cancellation or owner replacement.

Local compiler commands execute selected project/build code with host authority.
Call this a trusted-local provider, not an untrusted build sandbox. Keep secrets
out of recipes/receipts. Untrusted build code uses the isolated cloud/VM profile.
Publish outputs only after success and digest checks. Cancel stops the executor
and blocks late artifact promotion. No paid-provider fallback on local failure.

[HK1](host-kits.md#5-trusted-config-evaluation-and-rustbun-protocol) now owns the
proposed trusted-local TS evaluator and Rust/Bun plan protocol. It does not exist
yet. Static inspection never executes config; explicit trusted evaluation retains
coordinator callbacks in Bun and sends only validated descriptors across JSON.
HK1 evaluation is uncached. A future task Component receives only granted
snapshot/log/output/executor resources, with no ambient process or credentials.
These contracts remain separate from executable host config's same-user authority.

## Native and browser access

Apply the [machine grant contract](machine-access-and-references.md). Windows
multi-client automation may use a named pipe with logon-SID DACL, remote clients
rejected and collisions failing closed. This does not attest the client binary
or exclude malicious processes in the same user session.

For a browser, first serve the client from the dev server's own loopback origin.
Require exact-origin checks, authenticated upgrades and reviewed pairing. Proposed
defaults: two-minute single-use pairing requests and five-minute access sessions,
bound to origin, server epoch and granted operations/root resources. Check each
operation; restart invalidates sessions and renewal cannot widen grants. Reject
null/foreign origins. Keep credentials out of URLs and source. Hosted HTTPS clients
need separate local-network/mixed-content acceptance. Account login is not pairing.

## Acceptance

Exercise source edit, failed build, cancelled build, two out-of-order builds,
candidate failure, successful replacement and unsupported migration. Assert exact
generation/source identity, preserved editor/draft and no late writes/promotions.
Compare a fresh run with a replaced run for supported state semantics.

Test revoked/expired/wrong-origin pairing, restart epochs, unauthorized root access,
pipe collision and process cleanup. Generate path/case/OS-name boundary inputs;
include symlink/junction escapes and conflict races. Production packages omit
devtools and development-only connection credentials unless the user selects an
explicit development distribution. Native executable packaging still uses the
existing host/template/update trust path; changing a guest is not a host update.

Adopt the tool through public contracts in host application and a small standalone client.
Use existing editor and semantic UI adapters; keep a document picker, two text
fields and Run in an authored definition. Do not widen the G1 world to hide a new
surface API. Observe browser save/reload/denial and native execution. Run affected
repository checks and retain receipts. The server owns children on Ctrl+C/close.
