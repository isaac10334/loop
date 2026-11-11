# Development alpha execution plan

Proposed gates, October 30, 2026. Deliver one working vertical slice at a time.
A fixed completion date is not credible until G1 resolves the async toolchain.

| Gate | Exit evidence |
| --- | --- |
| G0 — baseline | Reviewed Loop/Station changes, public dependency map, toolchain pins and first contract proposal. Preserve existing work. |
| G1 — native async resource | [Core runtime](../../specs/async-document-runtime.md): actual Rust Component awaits document read/write, denies an ungranted document, handles conflict/revocation and terminates runaway work. |
| G2 — browser and Station | Same Component bytes run through a real browser adapter; Station injects its document policy; editor/draft survive failure. Observe the result in the actual host. |
| G3 — local development | [Foreground development](../../specs/foreground-development.md): source invalidation, build receipt, safe generation replacement, offline/account-free operation and failed-build recovery. |
| G4 — private cloud build | [Cloud build](../../specs/cloud-build.md): selected tenant, real isolated executor, persisted job reconciliation, cancellation and verified artifact bytes. |
| G5 — distribution | One private publisher and consumer, explicit installation/grants, revocation and compatibility checks. Use the identity reference; no marketplace expansion. |
| G6 — public demonstration | Sanitized docs and interactive document form; public build/deployment authorization and observed browser acceptance. |

One integrating owner freezes shared WIT, generated metadata and lifecycle rules.
Delegate bounded adapters after G1; cloud work consumes the accepted build contract.
Each task names its owned files, public dependencies, forbidden changes and tests.
Do not create empty packages or a workflow engine to make the plan look complete.

## Host-kit implementation lane

HK1 is the [proposed shared contract](../../specs/host-kits.md), frozen after four
read-only audits on November 3. This adds composition/CLI work to G0/G3; it does not
relax G1/G2 or advance cloud/distribution. Use the [prompt-2 cards](prompts.md#host-kit-prompt-2),
not a separate roadmap. [The audit receipt](host-kits-evidence.md) owns this run's
actual checks and runtime limits. November 7 limits official scope to our Rust
desktop kit and browser kit. Electrobun and other ecosystems are optional isolated
compatibility examples, not implementation or release prerequisites. The
[pinned investigation](../reference/desktop-hosts.md) remains reference only.

**Implementation mission, not just its first task:** HK-01 is a scheduling entry,
not completion. Deliver HK-01→02→03→04→05A, real HK-06 runtime/foreground
integration, HK-07's optional-use manager and HK-09 release/boundary checks, plus
the actual CLI/system docs website. Require create/config→rendered interaction→
build/relocate→stop/restart and two-instance evidence. Descriptor-only code,
scaffolds or a repetition of the disposable probe do not satisfy that mission.
Only genuinely blocked dependent lanes stop; a missing required lane means a
partial result, not a completed host-kit system. Optional GPU/CEF/update features
need their own profiles rather than expanding this minimum document-tool release.

| Card | Dependencies | Observable exit |
| --- | --- | --- |
| HK-01 portable plan, first safe implementation slice | New reviewed dirty baseline; HK1 | Existing host package resolves inert typed kit/plugin descriptors, rejects conflicts/cycles/nonportable data and cannot execute modules or acquire resources. Existing lifecycle behavior stays compatible. |
| HK-02 trusted config/process protocol | HK-01 + integrator-frozen JSON corpus | Explicit opt-in evaluates config in supervised pinned Bun; Rust/TS agree on bounded frames/plans; corruption, cancellation and child failure cannot promote stale results. |
| HK-03 CLI compatibility/templates | HK-02; serialized parser/manifest owner | Legacy modes remain unchanged; new explicit target mode resolves correctly; embedded examples/evaluator survive checkout-free crate/CLI packaging. |
| HK-04 browser kit and semantic DOM adapter | HK-01, HK-02 for CLI launch | Ordinary TS example composes runtime before entry; actual keyboard/button event and teardown work in two isolated launches. No Component claim. |
| HK-05A native Rust kit/provider | HK-03, HK-04; nominal runtime port | Reusable Wasmtime provider plus Wry presentation and Bun-side TS composition, not just old dispatch. Same semantic contract, two instances, denial/cancel/join and standalone relocation. |
| HK-05 optional external compatibility example (deferred) | Official spine complete; existing public ports/tools only | Example-local cross-ecosystem interaction, no core or official package changes. Electrobun may be omitted; SDK/fork/patch complexity is a reason to defer, not block the official kits. |
| HK-06 async document and semantic Component | Existing G1/G2 + HK-04/05A only; no HK-05 dependency | Production conformance, same bytes and all grant/race/lifetime/forced-stop obligations; add explicit UI extension, then browser+desktop interaction. Disposable probe is evidence, not completed production gate. |
| HK-07 optional skill manager | Frozen HK1 section 8/catalog; parser work sequenced with HK-03 | Data-driven bundled install/update/remove and explicit recovery pass zero-write/offline/ownership/fault fixtures. Actual agent discovery is separately observed. |
| HK-08 reversible Station adapter | Independent public UI artifact; then-current consumer baseline | Existing authored Action Button gains checked session event/lifetime seam; standalone packed consumer and Station behavior/reload/undo/denial pass without identity/storage/React/Electrobun migration. Component-dependent behavior additionally waits for HK-06. |
| HK-09 boundary/release hardening | Each producing card; integration owner serializes shared policy/locks | TS and full Cargo-feature rejection corpus plus crate/CLI/npm packed consumers, legacy native release checks and exact distribution resources pass. |

HK-01 and HK-07 fixture design can proceed if the Component compiler/browser lane
blocks. Do not advertise the new Component application path until G1/G2/HK-06 pass.
One integrating owner approves shared-type/manifest/protocol changes before adapters
write dependent code. Assign exact files after context; serialize all edits to root
manifests/locks, policy, shared schemas and CLI parser. Keep Station read-only until
an implementation run explicitly owns its adapter slice.

## Baseline and extraction

Record the actual starting revisions and changed files for each task. A HEAD
revision alone does not describe dirty changes. Preserve existing work instead of
resetting it to an earlier planning baseline.

| Station area | Portable candidate | Keep in Station |
| --- | --- | --- |
| Component worker / scripting evaluator | Artifact inspection, execution adapters, cancellation and disposal contracts | Grant decisions, workspace document resolution, asset currentness and worker composition |
| Cloud Component compiler | Build request/receipt and executor adapter | Product credentials, connection selection, notifications and promotion policy |
| Widget / docking / property systems | Contract-backed widgets, generic placement and typed property mechanisms after a second consumer proves them | Desks, persisted state, product defaults, concrete React UX and policy |
| Package contributions | Declarative contributions, compatibility checks and lifecycle mechanisms | Installation review, permission UI and product extension points |
| Asset development | Immutable snapshots, revisions, checked changes and build inputs | Asset browser, editing UX, storage migrations and user policy |

Extract by public contracts and injected ports. Run a second consumer before
declaring a Station mechanism generic; do not copy internal source into Loop.
Native DLLs/sidecars and in-process JS require distinct execution trust profiles.

The first authored UI is a semantic form with a document picker, two text fields
and Run. Reuse the existing editor workspace. UI selection does not widen the
document world or mint a grant. A hosted HTTPS page connecting to a loopback host
needs its own browser/pairing acceptance; localhost success does not establish it.

## Verification and handoff

Run affected package checks, generated-binding/Component checks and the real host
scenarios required by each spec. Separate compile, download, initialization and
call timings. Record artifact hashes, toolchain/profile, source revision, target
host and denial/failure results; command success alone is not rendering evidence.
Native acceptance uses the managed isolated installation under Station's rules;
do not interrupt the normal installed canary or a user-active acceptance session.

Put implementation results and the next concrete action in the existing ledgers.
Keep contract requirements in specs and unresolved decisions in `QUESTIONS.md`.
Prepare external writes concretely, then apply the user's authorization scope;
this plan does not authorize publication, deployment, purchases or messages.
