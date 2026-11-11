# Host-kit design audit, November 3, 2026

Status: design and disposable feasibility only. No production migration, publication,
commit, skill installation or Station source change belongs to this run.
The [host-kit specification](../../specs/host-kits.md) owns the proposed contract;
the [execution plan](execution-plan.md) owns sequencing.

## Reviewed baseline

The integrator reviewed both repositories' AGENTS, status, tracked diff statistics,
staged diff statistics and active CLI/instruction diffs before selecting the current
working trees. No worktree, checkout, stash or reset occurred. HEAD alone omits the
active TypeScript packages and specifications in Loop and current UI work in Station.

| Repository | HEAD | Working-tree baseline |
| --- | --- | --- |
| Loop | `4fd90622a43700a027f3da2d06ab44ffc2e33361` | Active untracked packages/contracts/tooling/specs/docs; tracked CLI template include relocation; old root starters/docs deleted; Windows workflows and site edits. Preserve all. |
| Station | `9e77015798805f71da25078520391840d51d7ced` | Active docking/shortcuts/themes/settings and page-presentation changes, new tests and local artifacts. Read-only consumer throughout this run. |

The integrator fingerprinted 260 Loop and 948 Station tracked/untracked paths
(excluding ignored files), including missing tracked paths. Temporary baseline
manifests were retained as [Loop fingerprints](../../experiments/host-kits-baseline-2026-11-03/loop-baseline.json)
and [Station fingerprints](../../experiments/host-kits-baseline-2026-11-03/station-baseline.json)
for the final preservation check. They are local receipts, not portable build
inputs or clean Git revisions.
A dirty source hash does not identify remotely fetchable source.

Four independent read-only audits used DSH subagents through authenticated
`openai-codex/gpt-6.1-sol`: CLI/Rust packaging (high), TS/runtime/Component
feasibility (xhigh), Station parity (high), skills/documentation (medium). The
configured transport exposed no cheaper model. Audit instructions named current
dirty baselines, cwd, exact read scopes, public dependencies, forbidden writes,
source-reference requirements and uncertainty. The integrator owns shared types,
terminology, dependency graph and entrypoint integration. A separate bounded
probe owns only `experiments/host-kits-2026-11-03/`.

## Direct observations

- `bun run repo context host|ui|scripting|workspace|capabilities --json` each
  succeeded. All five public packages expose their package root; host depends on
  capabilities, scripting on capabilities/UI. No package-context violation appeared.
- `bun run repo check` passed: five packages, sixteen source edges, zero violations,
  zero exceptions. This checks the current TS graph, not the proposed Rust graph.
- Tools: Bun `1.3.14`, Node `v24.14.1`, Rust/Cargo `1.98.0`, installed active targets
  `wasm32-wasip2` and `x86_64-pc-windows-msvc`, cargo-component `0.21.1`.
  Installed Wasmtime CLI is **33.0.0**, distinct from Loop's pinned crate **48.0.0**.
  No `wasm-tools` command appeared on PATH.
- [Current CLI parser](../../crates/loop-cli/src/main.rs) implements
  create/add/run/build/doctor plus upgrade/uninstall. [Manifest loading](../../crates/loop-cli/src/dev.rs#L79-L85)
  reads the explicit directory's `loop.toml`; it has no upward or nested-project resolver.
  `loop.config.ts` and the proposed commands in the host-kit spec do not exist yet.
- [Source snapshot tooling](../../tooling/workspace.ts#L8-L38) reads
  `loop.package.json` as literal version-1 data and never evaluates source. It is
  separate from Rust CLI project loading.
- [Rust runtime](../../crates/loop-host/src/lib.rs#L193-L244) links the existing
  application dispatch world. Its note resource methods are synchronous;
  [the Rust starter](../../crates/loop-cli/templates/rust/lib.rs) has an async
  dispatch/timer. This does not prove the proposed async document/CAS profile.
- [Public UI](../../packages/ui/README.md) supplies semantic descriptions,
  revisions/events and controllers, not Station's React shell or a native renderer.
  [Public scripting](../../packages/scripting/src/index.ts#L19-L55) keeps callbacks
  inside each guest SDK instance; it does not serialize closures through JSON.

## Station source outranks old proposals

Station's [architecture](C:/Users/ijhar/Desktop/station/docs/architecture.md),
[semantic UI contract](C:/Users/ijhar/Desktop/station/docs/semantic-ui.md),
[dependency workflow](C:/Users/ijhar/Desktop/station/docs/loop-kit-packages.md) and
[design route](C:/Users/ijhar/Desktop/station/DESIGN.md) remain consumer owners.

- Current Action Button already invokes an authored surface. The old
  [adoption Gate A](../../specs/station-adoption.md#gate-a-adopt-one-authored-widget)
  is an acceptance obligation, not evidence that a new parallel widget is needed.
- [Rich text](C:/Users/ijhar/Desktop/station/apps/station/src/ui/components/ui/rich-text-editor-engine.tsx#L65-L89)
  implements 500ms debounced autosave, conflict retention and pagehide/unmount
  flush. Dated prose saying compact notes do not autosave does not describe this
  dirty baseline. Preserve this source behavior; verify slow-commit/newer-typing/
  unmount and workspace-switch races before any adapter replacement.
- [Electrobun configuration](C:/Users/ijhar/Desktop/station/apps/station/electrobun.config.ts#L15-L42)
  selects Bun main process and per-profile identity; the
  [manifest](C:/Users/ijhar/Desktop/station/apps/station/package.json#L86-L96)
  pins Electrobun `2.0.3-beta.26`. This supports selecting Electrobun for the new
  Bun desktop kit; it does not establish that the kit exists.
- [Component worker](C:/Users/ijhar/Desktop/station/apps/station/src/providers/component-worker.ts)
  verifies artifact/translator hashes and invokes a fixed greeting `run` export.
  [Import inspection](C:/Users/ijhar/Desktop/station/apps/station/src/providers/component-plan.ts)
  rejects imports outside that profile. A document/UI adapter requires its own
  reviewed profile, not a bypass of this verifier.

## Read-only audit results

The CLI, Station and skills auditors completed without writing files or running
builds/tests. They identified these implementation hazards:

- Legacy `--host-source` changes generated packaged hosts, not the runtime compiled
  into the CLI's generated-host `run` path. `add component` defaults to Rust and
  creates an independent child manifest; it does not inherit parent language or
  enumerate child projects. See [CLI run](../../crates/loop-cli/src/main.rs#L101-L145)
  and [add/build](../../crates/loop-cli/src/dev.rs#L338-L354).
- Current trusted-local builds do not use Cargo `--locked`; TS build freezes only
  an existing Bun lock. New pinned-plan behavior must not be described as a current
  reproducibility guarantee. [The process adapter](../../crates/loop-cli/src/dev.rs#L363-L460)
  also owns one process-global cancellation flag. New instances must receive their
  own cancellation owner without retroactively claiming singleton-free legacy code.
- [Rust release](../../.github/workflows/release.yml),
  [published-host test](../../scripts/test-release.ps1) and
  [embedded manager](../../crates/loop-cli/src/manage.rs) remain active.
  npm/TS verification cannot replace installed/released-host acceptance.
- Station's authored view currently dispatches named callbacks without enforcing
  a session-owned event revision/sequence. Finish that seam before claiming a
  revision-aware authored-action adapter. The Action Button file has an invalid
  UTF-8 line according to the read tool; search exposed its surrounding authored
  view call, but the auditor did not normalize the file or claim it compiles.
- A rich-text save pending during newer typing followed by unmount/pagehide may
  strand the newer draft: flush returns while `inFlight`, and no mounted debounce
  remains. This is static risk reasoning, not a reproduced failure. Preserve the
  current implementation and add a focused regression in an authorized Station run.
- No repository skill or skill manager existed at baseline. Creator guidance favors
  a repo-owned payload separate from mutable installed destinations. Inspection and
  dry-run must not create directories, caches, locks or journals.
- `bun run docs:build` builds packages, removes/recreates generated documentation
  and writes an installer asset. It is not a read-only link check. This run uses
  a focused Markdown target/fragment check instead. Local link success cannot prove
  GitHub fallback URLs for files that have not been committed or published.

## Station parity inventory (static audit, not a fresh pass)

All paths in this table point to the independent consumer. The next Station run
must re-read the then-current dirty baseline before selecting exact files.

| Behavior | Existing checks/source | Required new observation before replacement |
| --- | --- | --- |
| Asset edit/autosave | [SourceEditor](C:/Users/ijhar/Desktop/station/apps/station/src/ui/components/workspace/source-editor.tsx#L69-L127), [rich source recovery](C:/Users/ijhar/Desktop/station/apps/station/tests/rich-authoring.test.ts#L12-L38), [storage failure](C:/Users/ijhar/Desktop/station/apps/station/tests/platform.test.ts#L210-L219) | 500ms coalescing, slow commit/new edit/close, readonly/revoke, source-mode roundtrip, conflict draft and original workspace/asset binding on switch. |
| Dock and widget state | [panel layout](C:/Users/ijhar/Desktop/station/apps/station/tests/panel-layout.test.ts), [desk interactions](C:/Users/ijhar/Desktop/station/apps/station/tests/desk-interactions.test.ts), [toolbar identity](C:/Users/ijhar/Desktop/station/apps/station/tests/toolbar-widgets.test.ts#L26-L109) | Actual mount/session counts and draft/selection survive move/float/focus/dock; rejected/cancelled moves leave one owner. |
| Theme/properties/actions | [theme modes](C:/Users/ijhar/Desktop/station/apps/station/tests/theme-modes.test.ts), [property editors](C:/Users/ijhar/Desktop/station/apps/station/tests/property-editors.test.tsx), [theme input](C:/Users/ijhar/Desktop/station/apps/station/tests/theme-input.test.tsx), [semantic UI](C:/Users/ijhar/Desktop/station/apps/station/tests/semantic-ui.test.tsx) | Two authored Action Buttons, separate config, confirmation/busy/denial/cancel, stale/duplicate event rejection, fork/edit/Apply/reload and missing-definition recovery. Theme preview/commit/undo keeps last valid per-asset values. |
| Keyboard/focus | [shortcuts](C:/Users/ijhar/Desktop/station/apps/station/tests/shortcuts.test.ts), [widget navigation](C:/Users/ijhar/Desktop/station/apps/station/tests/widget-navigation-policy.test.ts) | Actual browser/native key traversal, retained focus after nested modal/peek/menu/dock, editors/games/IME own overlapping input, forced-colors focus remains visible. |
| Permissions/denial | [command policy](C:/Users/ijhar/Desktop/station/apps/station/tests/command-policy.test.ts#L71-L205), [retained method checks](C:/Users/ijhar/Desktop/station/apps/station/src/services/widget-grants.ts#L12-L56), [AI lifetime checks](C:/Users/ijhar/Desktop/station/apps/station/tests/ai-capabilities.test.ts) | Revoke while edit/autosave/script action is pending; no late effect or success; rendered UI and agents use the same checked operation. |
| Reload/undo | [layout history](C:/Users/ijhar/Desktop/station/apps/station/tests/layout-history.test.ts), [page presentation](C:/Users/ijhar/Desktop/station/apps/station/tests/page-presentation.test.ts), [asset migration](C:/Users/ijhar/Desktop/station/apps/station/tests/asset-migration.test.ts) | Adapter on/off serialized fixtures preserve `unit-workspace.v4`, IDs, grants, drafts and old widget/legacy-script recovery. Layout undo does not revert source or manufacture authority. |
| Agent control | [MCP](C:/Users/ijhar/Desktop/station/apps/station/tests/control-mcp.test.ts), [sessions](C:/Users/ijhar/Desktop/station/apps/station/tests/control-sessions.test.ts), [owner contract](C:/Users/ijhar/Desktop/station/docs/agent-control.md) | Exact instance discovery plus paired commands.list/state.inspect; no silent headless/new-profile fallback. Command success still requires rendered observation. |
| Browser/native packaging | [bootstrap](C:/Users/ijhar/Desktop/station/apps/station/tests/root-bootstrap.test.ts), [packaged resources](C:/Users/ijhar/Desktop/station/apps/station/tests/station-server.test.ts), [updates](C:/Users/ijhar/Desktop/station/apps/station/tests/desktop-updates.test.ts), [native owner](C:/Users/ijhar/Desktop/station/docs/native-browser.md) | Current production browser and separately verified managed-native bytes; retained page focus/revoke, zoom, tray/quit, installer resources and A-to-B update. Preserve Electrobun and profile ports 43157/43158/43159. |

Station tests/builds were not run. Even root typecheck invokes resource preparation;
these commands are not read-only audits. Dated tests/screenshots cannot establish
acceptance of today's dirty source. The invalid UTF-8 Action Button line and
possible autosave close race remain consumer findings, not changes authorized here.

## Contract review and skill forward test

After the four audits, the integrator froze HK1 before assigning the skill/catalog
writer. That writer owned only the new payload/catalog; the probe owned only its
experiment. The integrator alone edited shared specs, owner links and ledgers.
An independent read-only contract reviewer found four concrete design defects;
the integrator corrected them before handoff:

1. Cancellation must abort provider registration activation **before** joining
   scopes, as [implemented host disposal](../../packages/host/src/runtime.ts#L487-L499)
   does. A scope-first unwind could deadlock a cooperative pending activation.
   Surface/bridge pending reads also need pre-join cancellation on failed start.
2. Provider conflict keys are ID+serviceId within an explicit host, with exact
   version matching at acquisition. Registration declarations now belong to runtime
   contributions, include exact host ownership, and discriminate renderer surface
   profiles. Cross-realm coincidence cannot satisfy a local dependency.
3. Runtime setup returns void; kit-owned before/after instrumentation records the
   registration receipt. The complete provider examples no longer contradict a
   supposed mandatory return value.
4. Semver applies to kits/plugins/profiles/packages. Existing opaque capability
   versions such as `1` retain exact-string identity and are not normalized.

A separate read-only skill forward test exercised two configured targets,
non-React rendering, a Bun/React inward-dependency + authority-metadata trap, and
outside-checkout use. It correctly distinguished current CLI grammar from proposed
commands, used public UI/controller/lifetime routes, retained Station policy and
requested a selected checkout for the unimplemented HK1 evaluator while allowing
current public-provider work. It found no broken routed reference. The reviewer
loaded more owner prose than the route required; this is not an installed-client
or runtime pass. Actual automatic discovery remains unverified.

The payload/catalog author verified the complete file set, per-file bytes/hashes,
portable routes and exact framed payload digest
`af251bd2e3a9cb75bce2600ef8425b7c8f48eb8efa91562b7ce5f63a9b95798b`.
The upstream creator's `quick_validate.py` could not run because local PyYAML is
missing (`ModuleNotFoundError: yaml`). No package was installed to bypass that
limit. Dependency-free frontmatter/inventory/UTF-8/whitespace checks and behavioral
forward review are separate observations, not a claim that the creator validator
passed. No skill manager or installation was implemented.

## Feasibility and final validation

The [disposable probe receipt](../../experiments/host-kits-2026-11-03/README.md)
owns replay commands, source/tool inventories, full imports/exports, timings,
failed attempts and cleanup details. The integrator also read the retained native
logs, browser JSON receipts, source worlds and semantic screenshot.

| Actual artifact | SHA-256 | Observed result |
| --- | --- | --- |
| [Document v1](../../experiments/host-kits-2026-11-03/artifacts/document-v1.wasm) | `9b459aba2977774a5c119898bee6a82884f61e9299ca44d43141468aeaffe88b` | Same bytes in Wasmtime crate 48 and actual Chrome 156. Delayed async read/CAS write, viewer/wrong-principal or forged-resource rejection, retained revoke, one-winner CAS and cancel/revoke commit schedules. |
| [Changed-source v2](../../experiments/host-kits-2026-11-03/artifacts/document-v2.wasm) | `4f93cbd53f2303634b1fdd62f8d1d2bad50c0bac7a5226bc89b4810a4458c9a1` | Fresh changed bytes produce the `fresh-v2` marker in both native and browser runs; preserved independently of mutable Cargo output. |
| [Separate semantic extension](../../experiments/host-kits-2026-11-03/artifacts/document-semantic.wasm) | `e8a5aa7730b6060d6b00cbbffade98e68588b76619365ba220567ae048b3af3d` | Same bytes in Wasmtime/Chrome and an isolated Tao/Wry/WebView2 desktop. Actual rendered button clicks resume guest event reads, mutate only the granted document and render frame 1. Desktop uses Wasmtime, not Polyengine/Electrobun. |

The Rust bootstrap uses Rust 1.98, wasm32-wasip2 and wit-bindgen 0.61.1.
Polyengine runtime/translator 0.6.7 executes the browser path; the pinned translator
hash is `ddb2e0144a9c5a1d65ff6ba05c45f913cc4111bc92a11624a44ae49486260e13`.
The document profile's actual generated WASI interfaces use `0.2.9`; the hosts
provide explicit deny functions/inert nominal resource types, with no successful
path calling those denied functions. Linking imports does not grant filesystem,
network or environment access. [Actual profile](../../experiments/host-kits-2026-11-03/profile.json)
and [semantic profile](../../experiments/host-kits-2026-11-03/semantic-profile.json)
record the complete generated import/export shapes, distinct from source hashes.

The semantic extension keeps the document interface identity and separately imports
public `loopkit:ui/surfaces@0.1.0`. It passes borrowed document/surface resources and
uses bounded JSON frames/events; it does not widen G1's world or serialize callbacks.
[The browser receipt](../../experiments/host-kits-2026-11-03/semantic-browser-receipt.json)
records stale/unknown/disabled/late events, close-pending cancellation and zero host
document/surface/event/listener counters. Its surface-render denial traps because
the existing WIT render import has no result error; do not mislabel that as a typed
WIT denial result. Browser exit/host object cleanup is distinct from production
runaway-worker interruption and full borrow/resource conformance.

Early browser harnesses imported installed public export target files by absolute
path. The final harness resolves **public specifiers** through a disposable local
resolver and records those mappings; it remains a local checkout/tool-cache proof,
not the independent packed-package consumer required for Station adoption.
No code or dependencies were copied into Station.

Electrobun's public npm import was attempted and returned an explicit Hutch SDK
projection requirement. A cached SDK is not evidence of a working standalone kit;
no prepare/install/global-cache mutation was performed. A separate **actual native
window** using Tao 0.37/Wry 0.56, WebView2 `156.0.4314.58` and Wasmtime 48 then
ran the identical semantic artifact. [The desktop receipt](../../experiments/host-kits-2026-11-03/desktop-ui-receipt.json)
records an actual Playwright pointer click and rendered `semantic world`;
[the screenshot](../../experiments/host-kits-2026-11-03/desktop-result.png)
is the WebView output. The owned unique profile/ephemeral CDP port served only
this probe. Closing its own button joined the worker, closed the store/resources
and exited the native process. This proves Rust desktop feasibility, **not** an
Electrobun kit, desktop Polyengine, installed package or updater transaction.

A complete TypeScript guest compiled to JavaScript, then actual pinned
ComponentizeJS `0.22.0` async-document generation failed at
`spidermonkey-embedding-splicer/src/bindgen.rs:720:47` (`not yet implemented`):
[retained failure](../../experiments/host-kits-2026-11-03/js-guest-componentize-pinned.log).
No Component resulted. An initial accidentally resolved cached `0.23` missing-
binding error is recorded separately and is not the pinned failure. The working
bootstrap is Rust; host composition/tooling remains TS/Bun. The cached wasm-rquickjs
P3 generator remains a distinct possible JS route, not a proven document compiler.

No result here closes production G1/G2 conformance, proves hostile guest confinement
or replaces Station's React UI. Forced runaway stop, complete malformed-input/
byte-budget/borrow conformance, independent packed adapters and selected Electrobun
integration remain implementation gates. Successful host-resource cleanup in these
fixtures does not establish all those properties.

## Final design checks and handoff

[The dependency-free validation receipt](../../experiments/host-kits-baseline-2026-11-03/validation.json)
checks local Markdown targets/fragments, TS/JSON fenced-example syntax, catalog
inventory/digest and both original fingerprint sets. It does **not** typecheck the
proposed APIs, prove external URLs, install/discover a skill or run production
packages. Initial link checks failed only while the probe README did not yet
exist; the final run passes after receipt creation.

The final preservation comparison covers all 260 baseline Loop paths and 948
Station paths. Only the 14 intended existing documentation/instruction owners
changed in Loop; no unexpected baseline path changed. **All 948 Station paths
remain byte-identical**, including its dirty sources. New files are the host-kit
spec/examples, repo skill/catalog, this receipt and the two isolated experiment
areas. The original CLI/Rust/package/release/site dirty work remains unchanged.

`bun run repo check` passes: five packages, sixteen source edges, zero violations
and exceptions. `git diff --check` passes; untracked new deliverables additionally
receive actual syntax/whitespace checks. Production full TS/Rust/installed/native
release regressions were not run because no production implementation changed.
The disposable Rust/Chrome/Wry commands above are their own scoped execution
receipts. The integrator independently reran the probe receipt checker (three
immutable hashes, current browser results, actual desktop output/close/join,
public UI WIT and 66 receipt links) and verified all 110 declared inventory
file sizes/hashes with zero mismatches. The probe owner collected its jobs and
confirmed no owned Chrome/WebView2/native processes remained. No commit,
publication, global installation, home-skill write or Station migration occurred.

Use the existing [execution lane](execution-plan.md#host-kit-implementation-lane)
and [prompt-2 cards](prompts.md#host-kit-prompt-2). First safe implementation is
HK-01: pure plan contracts/resolution in the existing host package, with no config
execution, process/window launch or persisted product-state change. Finish the
existing authored Action Button seam later through public packed UI artifacts and
an independent consumer. The [questions owner](../../QUESTIONS.md) keeps remaining
SDK/version/discovery/durability/distribution choices with recommendations.

