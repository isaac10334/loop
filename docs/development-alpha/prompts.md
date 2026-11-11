# Development task prompts

Use these with a named outcome and owned files. The
[agent workflow](../reference/agent-workflow.md) owns roles, task inbox handling and
skill policy; [specs](../../specs/README.md) own implementation requirements.

## 00 Integrator

```text
Work in C:/src/ilt/loop. Read AGENTS.md, ARCHITECTURE.md, ENGINEERING_PLAN.md,
docs/README.md, specs/README.md, the relevant specs and the alpha execution plan.
Confirm the workspace root; the DeepSeek Harness checkout is a separate project.
Review existing dirty changes and preserve them. Inspect public APIs before
proposing package moves. Current source and observed receipts outrank old plans.

Deliver G0 then G1: freeze the smallest async document resource contract and prove
one Rust Component through a real native host, including denial, CAS conflicts,
revocation, cancellation and runaway interruption. Preserve existing synchronous
SVG contracts. A web editor, synchronous fixture or native application starter is
not a substitute for this gate. Report an unsupported async ABI honestly.

Coordinate one shared-contract owner. Delegate only bounded files/adapters with
public dependencies, forbidden changes, acceptance and handoff artifacts. Make
tradeoffs and unresolved choices visible in QUESTIONS.md. Working directory and
metadata do not grant authority. Do not move Station state or policy into Loop.

After the contract gate, progress to browser/Station and foreground development.
Preserve editor/drafts and local offline account-free use. Reuse existing editor
and widget/property machinery; extract portable mechanisms only with real
two-consumer proof. Cloud work requires an accepted build contract and explicit
connection/tenant selection. Follow authorization for external actions.

Record actual source/artifact hashes, host profiles, checks, failure evidence,
remaining gates and one next action in the existing engineering ledgers.
```

## 01 Bounded implementation task

```text
Outcome: <one observable result and relevant spec section>.
Workspace and reviewed baseline: <exact root/revision/dirty changes>.
Own only: <files/packages>. Public dependencies: <exports/contracts>.
Forbidden changes: <other agents' files, wire identities, product policy/state>.
Acceptance: <real success plus relevant denial/failure/recovery scenarios>.

Read applicable AGENTS, package README and repo context. Reuse the accepted
contract. Propose a shared-contract change to the integrator before editing it.
Keep generated outputs traceable to pinned inputs. Test realistic faults and
state transitions, not assertions that restate the implementation. Run required
package/runtime checks. Handoff changed files, API effects, artifact references,
observed evidence, unresolved issues and the next action. Do not claim unrun
browser/native behavior or leave the task at a plan when implementation is owned.
```

## 02 Independent review

```text
Read-only review of <exact diff/artifacts> against <spec sections>. Verify that
the actual bytes/world implement the claimed async resource behavior. Inspect
authority at every call and commit, resource lifetimes, revoke/cancel races,
runaway interruption and cleanup. Check failed replacement preserves drafts.
For cloud work check tenant isolation, stale lease fencing, unknown executor
outcomes and immutable terminal state. Distinguish observed browser/native
acceptance from compilation. Report concrete defects with paths and evidence;
do not rewrite code, expand architecture or grant authority during review.
```

Cloud tasks consume [the cloud spec](../../specs/cloud-build.md) after G1 and the
selected executor lane. Station tasks also read Station's AGENTS, consume public
Loop artifacts and preserve its existing editor, grants and installed sessions.

## Host-kit prompt 2

Use this section for the later **implementation** run. This design run does not
execute these cards. Read [HK1](../../specs/host-kits.md), the
[example proposals](../../specs/host-kits-examples.md),
[audit/probe receipt](host-kits-evidence.md) and the existing
[gate sequence](execution-plan.md#host-kit-implementation-lane). Current source and
new observed receipts outrank this dated file map. A new run reviews both dirty
trees before choosing a baseline/worktree; do not recreate it from the recorded
HEAD alone.

**November 7 mission bar:** these cards partition one substantial implementation
run; HK-01 alone is not a completed assignment. Deliver the actual CLI/config/
plugin/process spine, the official browser and Rust-native kits, real same-byte
Component integration and a generic optional-use skill manager. External ecosystem
examples are isolated and non-blocking; Electrobun is not an official kit or gate.
Retain packed/boundary gates and the [docs website](../../site/README.md). See the
[desktop decision](../reference/desktop-hosts.md) for scope, source evidence and
optional-feature limits. The [full implementation prompt](C:/Users/ijhar/Desktop/station/docs/explorations/loop-host-kits-dsh-prompts.md#prompt-2-implement-the-integrated-host-kit-system)
sets the completion bar; this local path is not a published site dependency.
Keep HK-08's ordinary UI work independent of Component/skill-manager lanes; only
its Component variant waits for HK-06. A blocked required lane yields a partial
mission, not a license to report resolver-only success.

Every card uses the bounded-task handoff above: actual cwd/revision/dirty changes,
owned paths, public dependencies, forbidden changes, checks, artifacts and next
slice. No commit/publication/global install or Station migration without a new
scope. A named command below is either an existing verification command or an
explicit **new executable to add in that card**; do not report it passing before
it exists. The integrator serializes root manifest/lock/policy/shared-schema/CLI
parser changes and freezes new contracts before dependent writers.

### HK-01: first safe slice, portable plan resolution

- **Outcome/dependencies:** after new baseline review, implement HK1 sections 2–3
  as inert config/target/plugin descriptor validation and deterministic resolution
  in the existing host package. No Bun evaluation, module import, processes,
  listeners, profiles, guests or Station code. Resolve one explicitly selected
  target; two hosts/registrations retain existing semantics.
- **Owned paths:** `packages/host/src/kits/contracts.ts`, `resolve.ts`,
  `packages/host/test/kits.test.ts`, host public export and type tests. Integration
  owner alone edits export/manifests/policy if another card is active. Introduce
  no new package merely for contracts. Confirm exact internal modules after context.
- **Public contracts:** existing Host/Scope/Provider/ResourceOwner, capability
  identity, HK1 JSON plan schema. Keep wire/capability names and lifecycle APIs.
- **Difficulty/model:** hard contract, strong reasoning model. A bounded cheaper
  model may inventory cases only if the configured transport exposes one; it
  currently exposes only Codex `gpt-6.1-sol`.
- **Executable exit:** add `bun test packages/host/test/kits.test.ts`; cover
  deterministic order/digest, duplicate ID+service conflict despite different
  versions, opaque capability version compatibility, cross-host false matching,
  renderer surface-profile mismatch, exact-version dependency, missing key/cycle path, ambiguous
  target, unknown schema/key, unsafe module references, function/accessor/cyclic/
  oversized data rejection. Sentinel fixtures assert **zero module evaluation or
  side effects**, not merely returned data. Existing host lifecycle tests plus
  `bun run repo verify host`, `bun run typecheck`, `bun run repo check` pass. An
  outside packed host consumer typechecks imports without Bun/DOM/React/native
  tools. Removing conflict/target checks must make the relevant fixture fail.
- **Stop boundary:** propose interface changes to the integrator; do not add a
  temporary callback JSON encoding or execute config to make examples work.

### HK-02: explicit trusted config and supervised process boundary

- **Dependencies:** HK-01 plus one integrator-approved framed JSON/schema corpus.
  Independently implement Rust/Bun ends only after that freeze.
- **Owned paths:** CLI-owned `host-tools/{worker,evaluate,supervise}.ts`,
  `tooling/host-config/*.test.ts`; Rust `config_process.rs`,
  `crates/loop-host-plan/{Cargo.toml,src/*}` only when consumed. Integrator owns
  root Cargo/lock and shared fixtures; do not concurrently edit CLI parser.
- **Contracts:** HK1 section 5; workspace source/build identities; existing host
  ownership. No hidden `.env`, package auto-install or project replacement worker.
- **Difficulty/model:** high, strong model for launch/protocol/security/lifetime;
  bounded inventory/log classification can use cheaper configured models.
- **Executable exit:** add `bun test tooling/host-config` and matching
  `cargo test --locked -p loop-host-plan` plus process integration tests. Parse
  one golden accept/reject corpus in both languages. Actual child tests cover
  stdin/stdout/stderr separation, raw stdout corruption, oversized/truncated/
  duplicate-key frames, wrong nonce/schema/epoch, pending-count limits, hung import,
  bad tool version, missing frozen dependency, child exit, parent EOF and cancellation.
  Prove source mutation invalidates the plan, no late result promotes and the
  owned process tree exits by the measured shutdown budget. Sentinel static inspect
  leaves files/locks/environment unchanged. Report Windows Job Object behavior,
  not only a mocked process port.

### HK-03: compatibility CLI, templates and embedded evaluator

- **Dependencies:** HK-02; reserve sole parser/manifest/package include ownership.
- **Owned paths:** `crates/loop-cli/src/{main,commands}.rs`, compatible narrow
  `dev.rs` dispatch, `crates/loop-cli/templates/*`, crate include/build inputs and
  focused CLI tests. Integration coordinates evaluator/catalog assets and root locks.
- **Contracts:** HK1 precedence/discovery/help and complete proposed projects;
  retain legacy loop.toml v1, add child projects, user/generated headless grants,
  human output, manager and `--host-source` meaning. No implicit migration.
- **Difficulty/model:** high compatibility/integration; inventory/help snapshot
  updates are bounded medium work after contracts freeze.
- **Executable exit:** add a golden CLI suite covering legacy help/defaults,
  interactive/noninteractive selection, explicit directory/no parent search,
  config-only opt-in error, dual-format selection/conflict, multiple targets,
  wrong legacy flags and static/evaluating inspection. Existing `cargo fmt --all
  --check`, `cargo test --locked --workspace --all-features`, and `cargo clippy
  --locked --workspace --all-features --all-targets -- -D warnings` pass. Test
  `cargo package --list` and an unpacked/offline-checkout-free CLI asset fixture:
  embedded starter/evaluator/catalog inputs exist, no machine-local host path,
  public project modules resolve from project cwd and old templates still build.

### HK-04: ordinary TS browser kit and semantic DOM adapter

- **Dependencies:** HK-01; HK-02/03 for CLI-selected launch. Component runtime not
  required for ordinary TS-provider proof.
- **Owned paths:** new concrete `packages/host-browser/src/*`,
  `packages/renderer-dom/src/*`, their tests/READMEs and outside-consumer fixtures.
  Integrator owns root manifests, package policy and shared contracts. Separate
  runtime bootstrap and renderer writers, disjoint directories.
- **Contracts:** public host/UI Surface/UiFrame/UiEvent/controllers, HK1 module
  setup/start descriptors. Kit creates host before app entry and closes pending
  event reads on cancellation before joining app tasks. React is optional.
- **Difficulty/model:** high for bootstrap/lifetime; medium for bounded DOM maps
  and fixtures, with independent accessibility/event review.
- **Executable exit:** `bun run repo verify host-browser`, `bun run repo verify
  renderer-dom` (new registered package names), public tarball consumer and strict
  browser bundle import checks. Materialize/compile browser example and its
  reviewed lock from explicit artifacts. In actual Chrome, activate button by
  pointer and keyboard, observe frame/count, reject stale/duplicate/disabled events,
  retain visible focus and show no console errors. Two launches use independent
  counts/origins; explicit port collision fails without touching first. Stop with
  a pending nextEvent joins tasks/listeners and produces zero owned resources.
  Static build excludes Bun/native/React dependencies. No RecordingSurface-only
  proof or Component claim.

### HK-05A: native Rust kit and shared Component provider

- **Dependencies:** HK-01/02/03 and the frozen nominal runtime/protocol corpus;
  HK-04 for browser conformance comparison. Coordinate runtime/WIT with HK-06.
- **Owned paths:** concrete `packages/host-native/src/*`, focused tests/README,
  narrow runtime/surface modules in `crates/loop-host/src/*` and installed CLI
  backend dispatch; integrator alone edits shared DTOs, WIT, parser, manifests
  and locks. Reuse current crate/API compatibility before introducing a new crate.
- **Contracts:** runtime artifact inspection/invocation/cancel/dispose through ports;
  per-use grant/CAS ownership, public semantic UI, Bun-side ordinary TS providers
  and native surface bridge. Wasmtime and Wry stay outside portable plan resolution.
  Any optional external consumer uses public ports; it cannot own or alter the
  official Wry event loop or drive new abstractions.
- **Difficulty/model:** high ABI/platform/lifecycle/authority; strong model, with
  independent denial/resource/forced-stop review.
- **Executable exit:** implement focused native-kit verification and the shared
  native runtime conformance command; run documented Rust gates. CLI-created
  browser/native examples must use the same fresh Component bytes and real
  pointer/keyboard→guest→document→frame path, not just fixed old dispatch. Prove
  two processes/profiles, endpoint collision, stop A preserving B, partial init
  unwind, foreign/stale IPC denial, pending-event pre-join cancellation and fresh
  restart. Build and relocate outside the checkout; report exact native resources
  and runtime hashes. New optional GPU/CEF/updater APIs remain unsupported unless
  separately selected/tested; do not recreate those frameworks to finish this kit.

### HK-05: concrete Electrobun integration

**Superseded as a required card on November 7; optional compatibility examples only.**
Keep this heading for inbound links. Do not create an official Electrobun package,
assign a required framework worker or make any official kit depend on this card.

- **Dependencies:** completed official spine; already available public APIs/tools.
  No runtime/Component/release gate depends on this optional example.
- **Owned paths:** only `examples/compatibility/*` and example documentation/tests.
  No core/official manifest, default starter, Station or home changes.
- **Contracts:** a small cross-language/ecosystem consumer of existing public ports,
  explicit grants, bounded messages, cancellation and disposal. Electrobun is one
  possible illustration, not a preferred framework or support commitment.
- **Difficulty/model:** bounded example/verification work; escalate a contract gap
  instead of patching core for the example. Defer SDK wrestling, forks, patches or
  new services; they are out of this mission.
- **Executable exit if selected:** run the real interaction and relevant denial/
  stale/cancel/disposal checks with exact versions, report narrow coverage, and
  prove official browser/native builds work without the example dependencies.
  If not selected, report deferred without marking official completion partial.

### HK-06: production async document + semantic Component bridge

- **Dependencies:** G1/G2's nominal document contract; HK-04/05A for the official
  browser/native kits only, never optional HK-05. Start with the disposable receipt but
  independently rebuild/verify. Implement dedicated workers/native interruption
  and real quotas; the existing probe does not establish production isolation.
- **Owned paths:** integrator-selected `contracts/document-tool/*`, generated
  binding receipts, actual native/browser adapter modules and conformance fixtures.
  One owner controls WIT/profile changes. Separate optional semantic-surface
  extension; preserve old application/sync/editor/scripting worlds.
- **Contracts:** async-document-runtime plus HK1 section 7, capabilities and existing
  UI surface WIT. Per-use policy/atomic CAS, real suspension, exact error mapping,
  scope/worker ownership and measured interruption.
- **Difficulty/model:** hardest ABI/authority/race work, strongest available model
  plus independent read-only security/evidence reviewer.
- **Executable exit:** add native/browser conformance commands documented with
  their source fixtures; full repo Rust/TS/Component/packed gates. Rebuild changed
  source, record compiler/source/bytes/world hashes and **same bytes** in Wasmtime
  and actual browser. Run delayed read/CAS, viewer/wrong-resource/revoked/forged
  denial, one-winner writes, cancel at commit boundaries, borrow/drop/owner-close,
  trap/runaway isolated instances and resource/task counts→0. Separately render a
  real semantic button whose event crosses the Component ABI and mutates only its
  granted document in browser and isolated desktop. Node/Bun or headless native is
  not desktop/browser UI acceptance. State any unsupported ABI and stop that lane;
  ordinary TS/config/catalog work can continue. Rust bootstrap is explicit while
  TS/Bun hosts lead; keep the ComponentizeJS/new TS guest gap visible.

### HK-07: optional generic bundled skill manager

- **Dependencies:** HK1 section 8/catalog contract; serialize CLI parser work with
  HK-03. Payload source already exists, manager/discovery do not.
- **Owned paths:** CLI `skills` command/manager modules, bundled data inventory and
  `tooling/skills/*.test.ts` (or Rust equivalents selected by integrator), tests
  rooted only in disposable fixtures. Skill author owns payload edits; manager
  owner cannot silently rewrite content. Integrator coordinates catalog digest.
- **Contracts:** catalog IDs/version/compatibility/inventory/digest, destination
  adapter and scope-local ownership receipt/journal. No per-skill command branch,
  network, auto-install, home instruction edits or implicit force/adoption.
- **Difficulty/model:** high filesystem/transaction/security review; medium for
  data-driven inventory/JSON/ordinary CLI plumbing after freeze.
- **Executable exit:** add focused test command and prove filesystem snapshots
  unchanged for list/inspect/dry-run; install exact inventory, same-version noop,
  add/change/delete update, second skill by data alone, explicit project/user
  fixture isolation and no fallback. Test traversal/ADS/case/device/symlink/
  junction/reparse/ancestor swap, unmanaged collision, local/unknown edits,
  corrupt receipt, concurrent/stale plans, offline operation and JSON errors.
  Fault-inject before/after every rename/receipt write; read-only inspect reports
  recovery, explicit recover retains last good generation. Remove only owned
  unchanged files; repeat safe. Separate observed real-client project discovery
  from destination-path fixtures. No actual user skill install is needed for CI.

### HK-08: reversible Station Action Button adapter

- **Dependencies:** newly reviewed Station baseline; independent checksum-pinned
  public UI artifact and second consumer. Ordinary event/controller work can use
  existing public UI; Component-dependent variant waits HK-06. No package-source
  copying or broad host-kit migration.
- **Owned paths (confirm exact source first):** Station
  `apps/station/src/core/authored-surface.ts`, a narrow React-free session adapter,
  thin `ui/components/workspace/authored-surface.tsx` hookup, focused authored-action
  tests and independent public-package consumer fixtures. Action Button's invalid
  UTF-8 input line requires explicit inspection/owner consent before editing it.
  Keep store/docking/permissions/native packaging outside this slice.
- **Contracts:** existing authored definitions and public UI controller/action
  interfaces; Station owns command target resolution, confirmation, grants/CAS and
  saved product state. No new live graph, stored adapter switch or identity change.
- **Difficulty/model:** high behavioral/authority parity and integration, strong
  model for seam; bounded inventory/DOM cases can use medium work.
- **Executable exit:** source-backed parity cases from the audit inventory plus
  focused tests, root Station typecheck/build and required aggregate/Component
  gates for touched runtime. An outside packed UI consumer imports public roots,
  runs the same frame/event fixture with its own count/deny ports and rejects
  stale/duplicate/wrong-target/disabled/busy events, late async denial and disposed
  callbacks. Actual Station two-instance configs, keyboard/focus, fork/edit/Apply/
  reload, dashboard↔toolbar move, undo and source-loss recovery preserve IDs,
  grants and state through adapter on/off. Rollback selects previous adapter with
  the same documents; no persisted switch. Current autosave remains working and
  receives separate slow-save/newer-edit/unmount regression before any editor
  adaptation. Update Station's existing engineering ledger only in that later run.

### HK-09: independent boundary and release gate

- **Dependencies:** producing cards; integrator owns shared manifests/locks/policy.
- **Owned paths:** TS policy/negative fixtures, dedicated Rust manifest/feature
  checker fixtures, release asset inventories and checkout-free consumer tests;
  no production runtime rewrite during review.
- **Contracts:** HK1 section 6; preserve Rust/manual Windows and npm release owners.
- **Difficulty/model:** high for feature/target/build/proc-macro graph checker and
  adversarial fixtures; cheaper configured model for inventories/link checks.
- **Executable exit:** implement the proposed `bun run repo check --rust` and
  `bun test tooling/rust-boundaries.test.ts`, exercise disabled optional and
  forwarded features, inactive target cfg, renamed/workspace/build/dev edges,
  native defaults and cycles. Positive current Rust desktop/headless graphs pass.
  Run full TS verify, tooling typecheck, Rust fmt/tests/clippy and outside tarball/
  crate consumers. Existing packaging/bootstrap/install/published-host relocation
  tests run only in their managed isolated scopes, never publish/install globally.
  Preserve old native evidence and record exact new archive/runtime hashes and
  what installed behavior was actually observed.
- **Required website exit:** canonical CLI/system/custom-kit/provider guides and
  examples match actual parser/help and exercised APIs. Register Markdown in
  `site/content.ts`, preserve public routes/installer links and proposal/current
  status, and include search/navigation. `bun test site` and `bun run docs:build`
  pass. Observe landing/sidebar/TOC, current CLI versus proposed remainder,
  search navigation, keyboard focus and empty browser console on the exact built
  site. Generated `site/docs` is output, not authoring source. Build locally;
  deployment/publication needs separate explicit authorization.

