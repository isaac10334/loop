# Cloud build

Status: proposed; selected only after source/build contracts and local runtime
gates pass, October 30, 2026. Covers G4. Outcome: submit one private build, restart
its worker, reconcile the provider job and run the returned verified Component.
Use one API, database, blob store and worker with an existing isolated executor.

## Inputs and authority

Consume public `@loop-kit/workspace` source/build contracts. Pin source closure,
dependencies, literal recipe, toolchain image, target/profile and declared
environment inputs. The request pins issuer-qualified principal, connection,
project, selected executor and idempotency key. Credentials remain server-side;
the recipe carries secret references only where the reviewed executor allows them.
Account switching cannot retarget a submitted job.

Apply [identity rules](../docs/reference/identity-and-distribution.md): API-specific
audience/scope, live project membership and connection status. Recheck mutation
authority at commit. Every blob read checks project access even when a caller
knows its digest. Bound uploads, source files, logs, concurrent jobs, execution
time, output bytes and retention; record configured limits with acceptance.
No stubbed authorization in shared/private staging.

Keep Git as the accepted source stream. Editable cloud drafts pin a Git base and
propose a checked change request. Source and artifacts occupy different records;
a source edit invalidates the derived association. No last-writer-wins dual-main
sync. Dependency-lock changes remain outside the current text projection until
their mapping and conflict rules have a separate accepted contract.

## Jobs and persistence

Persist submission before scheduling and atomically insert its outgoing event.
Use `queued -> running -> succeeded | failed | cancelled` with `reconciling` for
uncertain provider outcomes. Store attempt ID, lease/fence generation, executor
job ID, source identity and terminal receipt. A retry of the same request returns
the same job; a new source/recipe has a new request identity.

Workers claim jobs with a lease/fence. Old workers cannot publish after lease loss.
After restart or lost submit response, reconcile by executor identity before
launching again. If the executor cannot look up/deduplicate a submission, preserve
an unknown outcome and require reconciliation; do not claim one execution.
At-least-once events carry stable IDs/cursors. Consumers deduplicate them.

Cancel records intent, revokes new effects and asks the executor to stop. Resolve
cancel/success races against a transactional terminal transition. A completed
artifact can remain in storage for diagnosis without becoming an accepted result.
Do not erase committed external effects or report that a lost response means the
build never ran. New deliveries cannot reopen a terminal job.

An authorized client can inspect status and consume bounded sequenced logs with
resume/gap behavior. Disconnecting the client does not transfer job ownership or
silently cancel it. Revocation cancels associated work according to the recorded
disconnect/lease policy; offline nodes cannot learn revocation at once.

## Executor and artifact boundary

The executor receives an immutable input image plus selected toolchain, network,
filesystem and secret policy. Keep host/service credentials outside guest reach.
Use a real VM/container boundary appropriate to untrusted builds. A process and
path allowlist alone do not establish hostile-code confinement. Record the
provider's actual isolation constraints and cleanup behavior.

On completion verify output size/hash, expected Component exports/imports/profile,
toolchain/recipe identity and source association before accepting the receipt.
A hash is content identity, not builder authentication or reproducibility proof.
Keep signed provenance separate where available. Run the exact bytes through the
async document fixture. Real-provider receipts cannot come from mock executors.

Reuse host application compiler repair knowledge behind a standalone executor adapter;
keep host application HTTP/session policy and asset mutation in host application. Loop Cloud imports
public versioned Loop packages, not host application server internals or copied SDK source.
Prepare a cloud checkout when this gate is selected; no repository move is needed.

## Git and registry extension

The existing local change-request adapter remains usable without Loop accounts.
For hosted submission use a GitHub App installed on selected repositories, with
server-held installation credentials and project/repository/path mapping. Verify
base commit and before-file hashes; reconcile deterministic branch/draft PR by
request identity. No auto-merge. Check webhook signatures/delivery IDs; verify CI
commit bytes and advance heads by CAS. Preserve provenance to stop feedback loops.

The first private registry indexes one official publisher's pinned manifests,
docs and artifacts. Download, install, grant and activation remain separate.
Third-party native plugins, commerce, visual workflows, a VM scheduler, overnight
agents and persistent game hosting require later slices.

## Acceptance

Run one real submit/build/download/invoke path and crash the worker before submit,
after executor acceptance, during logs, before receipt commit and after commit.
Replay deliveries and stale fences; prove no duplicate accepted result, lost event
or cross-project fetch. Test wrong tenant/audience, revoked membership/connection,
quota exhaustion, secret-free diagnostics, cancel races and corrupted output.

Use model/property tests for state-transition sequences and request idempotency;
fuzz bounded request/log/artifact decoders. Inject provider failures/lost replies
to prove reconciliation rather than a happy-path mock. Run the local profile's
acceptance on returned bytes. Public deployment remains gated on configured
identity and tenant tests; retain explicit missing gates if only local work passes.
