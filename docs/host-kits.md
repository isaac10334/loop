# Host kits and provider integrations

**Source implementation; integrated runtime/release acceptance in progress.**
The source-built CLI has config inspection, explicit trusted config selection and
browser/native starters. The public kit packages describe their implemented
factories and bootstrap APIs. This page keeps the proposal badge until the
integration owner records the complete CLI/runtime receipts. Use the
[CLI guide](cli.md) for legacy application commands and
[the package READMEs](../packages/host-browser/README.md) for public signatures.

## The model

| Part | What you configure |
| --- | --- |
| Host kit | A versioned integration that creates runtime composition, owns startup/build/shutdown and declares supported target profiles. |
| Host plugin | Trusted providers, renderer adapters or lifecycle hooks within that integration. |
| Template | Initial source files. The installed versioned kit, not the template, supplies runtime behavior. |
| Target / instance | A selected named composition / one launch with its own epoch, endpoints, profile and mutable ownership. |
| Guest Component | Verified bytes with declared imports/exports and only host-granted resources; separate from trusted kit/plugin code. |

A kit starts Loop composition before application entry. Ordinary TS providers stay
supported. A renderer maps portable semantic frames/events to DOM or another
platform; React is optional. Selecting a kit does not isolate trusted host code,
authorize guests or require all tooling/product code to become WASM Components.

## Browser and desktop wiring

The **two official kits** are our own **Rust desktop host** (Wasmtime execution,
Tao/Wry presentation) and the browser host. Bun remains config/tooling and an
explicitly selected TS-provider bridge, not an external framework underneath the
desktop host. Electrobun is not a dependency, official kit or completion gate.

Cross-language/ecosystem compatibility belongs in small isolated examples using
existing public ports. Electrobun may be one optional example; skip it if it needs
SDK wrestling, patches, forks or new services. Do not expand the official design
merely to accommodate a third-party framework.

The implemented factory defaults select ordinary TypeScript host profiles.
This configuration shape requires an explicit source inventory and installed,
frozen-lock dependencies before evaluation:

```ts
import { defineConfig } from '@loop-kit/host';
import { browser } from '@loop-kit/host-browser';
import { native } from '@loop-kit/host-native';
import { semanticDom } from '@loop-kit/renderer-dom';

export default defineConfig({
  schemaVersion: 1,
  source: { manifest: './loop.package.json' },
  targets: [
    { id: 'web', kit: browser(),
      application: { specifier: './src/app.ts', export: 'start' },
      plugins: [semanticDom({ key: 'dom', root: '#app' })] },
    { id: 'desktop', kit: native(),
      application: { specifier: './src/app.ts', export: 'start' } },
  ],
});
```

The native application entry runs as trusted Bun-side composition with a semantic
surface bridge to Rust presentation. The browser entry uses browser-safe modules.
Do not bundle a Bun-only provider into a static browser page or serialize a closure
between these realms. Runtime modules export `setup({host, scope, signal, options,
ports})`; application modules export `start({host, scope, surface, signal})` and
borrow the composed host/surface rather than creating a second host.

`browser()` also accepts `profile: 'loop:profile/browser-components@0.1.0'` and
`listen: {hostname: '127.0.0.1', port: 0}`. `native({profile: 'components'})` selects
the native Component profile. These options do not load an artifact or issue guest
grants. Consult the [browser](../packages/host-browser/README.md),
[native](../packages/host-native/README.md) and
[Component adapter](../packages/component-polyengine/README.md) READMEs for their
artifact, transport and worker inputs. This TS example does not configure a guest.
The same-byte Component gate still needs its own ABI/grant/runtime receipts.

## Source-build CLI workflow

The parser accepts the following new-mode operations. Runtime launch/build success
also requires the selected project's dependencies, lock and adapter inputs; parser
availability alone does not close the end-to-end gate.

| Operation | Source-build grammar |
| --- | --- |
| Create | `loop create <path> --kit browser|native --yes [--json]` |
| Static inspect | `loop inspect <root> [--config loop.config.ts] [--json]` |
| Verify inert plan | `loop inspect <root> --plan <file> [--json]` |
| Evaluate | `loop inspect <root> --evaluate-config --trust-local-config [--config loop.config.ts] [--target <id>] [--json]` |
| Run/dev | `loop run|dev <root> --config loop.config.ts --trust-local-config [--target <id>] [--instance <id>] [--port <n>] [--profile <name>] [--json]` |
| Build | `loop build <root> --config loop.config.ts --trust-local-config [--target <id>] [--release] [--json]` |
| Stop | `loop stop <instance> --root <root> [--json]` |
| Restart | `loop restart <instance> --root <root> --trust-local-config [--json]` |

`create --kit browser` names its target `web`; `create --kit native` names it
`desktop`. Create writes source and dependency metadata but does not install
packages or invent a frozen lock. Review and prepare those inputs yourself before
evaluation. Do not combine `--kit` with legacy `--template`, `--language`, `--host`,
`--host-source` or `--template-dir` options.

```powershell
loop create document-tool --kit native --yes --json
loop inspect document-tool --json
# After reviewing the project and preparing its dependencies/lock:
loop inspect document-tool --config loop.config.ts --evaluate-config --target desktop --trust-local-config --json
```

Choose a target when several exist. Run and dev remain foreground commands; their
active-instance line goes to stderr, and their JSON result follows shutdown.
Choose an instance ID yourself with `--instance` so another terminal can address
it with `loop stop <instance> --root <root>`. Restart requires fresh config trust
before it stops the old instance. `--port` and `--profile` request instance
resources; neither grants document or filesystem authority. After reservations are acquired,
the launch publishes a `starting` record before prepare hooks. A stop request then aborts
startup and waits for hooks and owned cleanup before locks are released. Noncooperative
trusted hooks can delay cleanup; a request before that record exists cannot yet be delivered.
If lookup observes a reservation with no matching live record, it fails closed rather than
reporting an older stopped epoch as success. Lock and record reads are not atomic, so a
concurrent transition can require a retry. If a registered browser is stopped while its
ready hook is pending, the coordinator acknowledges `stopping`; the generated client
then disposes and acknowledges its own shutdown. Development replacement aborts the old
ready hook's generation-scoped signal and joins it before promotion; a noncooperative
hook can prevent promotion indefinitely. An unrelated hook failure remains a failure
rather than a successful readiness acknowledgement. A controlled headless replacement
passed without browser errors (`../target/host-browser-replace-ready/4ce1d0b4-429c-43c9-89e8-425f2a10edd6/receipt.json`).

The local browser CLI smoke exercised a relocated executable: create, zero-write
static inspect, trust refusal, evaluated plan, inert-plan verification, browser
build, HTTP serving, stop/repeated stop and fresh-epoch restart. It recorded 18
assertions in [the CLI smoke test](../tooling/host-config/cli.test.ts) and a local receipt under
`target/host-config-smoke`. HTTP 200 proves file serving, not runtime setup or a
rendered Component. Browser readiness acknowledgement, the native integrated
launch/build path, failed-start cases and installed-release behavior require their
own current receipts.

The browser runtime fixture also records two independent launches, stop-A-leaves-B,
relocated static output and a real pointer event through the Component document
profile. The native fixture records production Tao/Wry/Wasmtime windows, pointer
and keyboard events, zero pending reads on close and independent epochs. Those
package/backend receipts do not replace the CLI integration gate.

## Current acceptance limits

These observations cover different paths. A passing backend or package fixture does
not repair a failing evaluated-config CLI run.

| Path | Observed result and remaining limit |
| --- | --- |
| Custom ordinary-TS kit | Tested CLI SHA-256 `eb2673118fb19b81a67102949552a89ef50c996b572ff2d6ad540f3afb9a3bed` passed a headless Chrome `run` acceptance on plan `724e12cee4fb24a2cd3515b8e2a2c485f4947578404d947f601513bc9fc9c74b`: two concurrent instances each began at count 0; pointer click on A and Enter/Space on B changed only their own provider state; stopping A left B active and usable; both app roots disposed and both providers ran prepare/ready/quiesce; zero page/console/request errors (Chrome 156). Receipt: `../target/custom-provider-fixture-2/final-cli-provider/1794143842127/receipt.json`; temporary driver: `../target/custom-provider-fixture-2/verify-final-cli-provider.mjs`. The custom plan was also inspected with that tested binary (`../target/custom-provider-fixture-2/evaluated-plan-final-eb267.json`). In a separately prepared offline fixture, that tested binary also passed a `dev` source-replacement check: editing the application heading with unchanged imports caused both browsers to reload to the changed heading and become active under new plan `ba1b5a627298150f73f69913688d4f140d5feb2a8080028fdf4b0bf44e21c22a`, then independent input and stop-A/B-survival passed without browser errors (`../target/custom-provider-reload-round16/results/1794145019838/receipt.json`). A second isolated run introduced a new import: both instances reported `E_DEV_RESTART_REQUIRED`, kept their old plans active and accepted input. A subsequent valid edit reloaded both, resetting their counters from 2 to 0 (`../target/custom-provider-dev-reject-round17/results/1794145158247/receipt.json`). Another fixture introduced malformed syntax: both instances reported `E_DEV_BUILD`, remained usable on their original plans, and reloaded after a valid correction (`../target/custom-provider-dev-failure-round18/results/1794145294977/receipt.json`). This does not prove downstream bundler-failure recovery or exhaustive replacement cleanup. An earlier static `build` correctly rejected live hook callbacks with `E_NONPORTABLE_CALLBACK`. The consumer uses public packages without workspace links; this is not an outside-checkout security or Component proof. |
| Official browser CLI | Strict ordinary-TS evaluated CLI receipt `target/host-browser-cli/1794134069659/receipt.json` passed relocated static build, two origins, pointer/keyboard interactions, stop-A/B-survival and restart with zero console/page/request errors (CLI SHA-256 `a70c3b6109f3e504ba276d68a8879cc5daea244759c32159a8e4d2b55088ace6`). |
| Browser Component CLI/worker | Headless Chrome Component-profile CLI acceptance passed on current debug CLI SHA-256 `345e5714ee4620092f99e539cd7b57875e7dba5474f0a04430f6cfd82d7a14b5`: relocated static interaction, two concurrent guest launches, stop-A leaves B usable, fresh-epoch restart, zero errors, and cleanup counts `workers=0`, `pendingHostCalls=0`, `liveGrants=0`; receipt `target/host-browser-cli/1794362563714/receipt.json` (plan `31abef9e42cc2dff01be19d1c4123335f1c7113937f0d744de0f45586c1c746c`). A controlled headless browser test reproduced a stop-during-ready 500 on the prior CLI (`target/host-browser-stop-ready/37eae580-2707-41dd-93a6-36df0a445bb5/receipt.json`); the current CLI acknowledges cancellation and disposes without page or console errors in that schedule (`target/host-browser-stop-ready/f33793d6-deea-4e0f-aceb-90806e3bcf37/receipt.json`). Decoded revisions over 128 UTF-8 bytes are rejected before host forwarding; a hostile real-engine guest confirmed ASCII and multibyte cases with zero host write frames (`target/host-browser/1794306420327/receipt.json`). Browser and native decoded success limits both allow 1 MiB + 256 bytes; each returned a 1,048,594-byte result after committing a 1 MiB source. Failure variants are shape- and size-checked on both sides, with 64 KiB invalid-source detail. A real guest returned a bounded newline-heavy conflict without the prior JSON-escaping rejection. These checks are not pre-lift decoding enforcement. A locally installed optimized CLI and external Component consumer passed the same headless acceptance in Edge 157 (`target/host-browser-cli/1794149082284/receipt.json`). Edge shares Chromium with Chrome; this is not an independent-engine or WebView2 proof. An installed optimized CLI also passed a Component `dev` source-replacement run in an external fixture: both clients acknowledged disposal and reloaded fresh documents, then stop-A/B-survival and restart passed (`target/host-browser-cli/1794149528816/dev-replacement-summary.json`). Old-generation worker counters were not directly captured before reload. One diagnostic attempt observed the replacement UI/API active while `launch.json` still held the prior plan (`target/host-browser-cli/1794149469328/receipt.json`); the passing harness waited for persistence. The supervisor now uses ordered atomic launch-record snapshots; a live Component dev test observed 2,082 complete concurrent reads with no parse errors (`target/host-browser-cli/1794150608750/receipt.json`). Readiness is now single-flight and fenced by client and generation; stop waits for an in-flight ready hook before quiescing. Direct-supervisor HTTP tests cover duplicate ready, stop during a held hook, old-generation replacement and hook failure. Hook ownership is also registered for quiesce-only plugins; relocated CLI regressions verified exactly one seven-second quiesce across two concurrent stop requests and a failing quiesce that retained its reservation and required recovery. Startup and cleanup failure messages are reported together with bounded nesting; unusual null or unprintable throws no longer prevent cleanup or protocol reporting. An isolated supervisor test injected a development-disposal rejection with an HTTP client connected and verified later cleanup and retained reservation; the development owner was mocked, not a full dev/browser fault injection. Launch epochs are restricted to portable lowercase letters, digits and hyphens and cannot be reused; this narrows the previously opaque worker-protocol input. Stop publishes `stopping` before releasing reservations and retains them when stopping-record publication or quiescence fails; direct-supervisor tests cover those paths. Lock creation now records ownership after exclusive open and preserves write/close failures; actual OS write/close failure cleanup remains untested. A headless two-instance test passed CLI stop during replacement with a deliberately delayed disposal acknowledgement (`target/host-browser-cli/1794152436033/receipt.json`); a prior attempt logged one unclassified `ERR_CONNECTION_REFUSED` (`target/host-browser-cli/1794152386337/receipt.json`). A Windows locked-record test verified final-write failure after cleanup and lock release: inspection reports failure, the prior disk record remains `stopping`, and the real CLI can select and stop a subsequent epoch. The foreground CLI attempts process-tree termination after ten seconds of observed `stopping`; an async non-cooperative hook test left a `stopping` record and lock (`target/noncooperative-cli/1794154349649/receipt.json`). The separate stop client now waits up to twelve seconds; two concurrent stop clients both acknowledged a seven-second cooperative cleanup (`target/slow-cleanup-cli/1794154944441/receipt.json`). Ambiguous stopping epochs fail closed, and stale records can require explicit recovery. Slow legitimate cleanup may also time out, Live inspection now has a ten-second response deadline; a synchronous blocked-hook test produced a protocol timeout and retained its lock (`target/syncblock-cli/1794155376933/receipt.json`). On Windows, one worker-spawned descendant was observed gone after an owner timeout, before its self-exit (`target/process-tree-test/a8ef2927-6fc9-478f-aa61-150d894e656a.json`); escaped or other descendants remain unverified. Pipe writes and Ctrl-C use different limits, and termination/lock retention are not guaranteed in every race. Durable final-record recovery remains open. The earlier `E_IMPORT_CLOSURE` was a scanner false positive from `import(...)` text inside dependency comments; syntax-aware parsing now ignores comments/literals but still rejects computed imports, with regression tests. **Full canonical ABI conformance remains false**: Polyengine 0.6.7 has no public pre-lift allocation limit, and a hostile 2,097,665-byte encoded input/result reached TextDecoder before post-lift checks. A worker-scoped `TextDecoder.prototype` patch is not a complete workaround: UTF-8/UTF-16 use TextDecoder, while the runtime's Latin-1 path uses a custom decoder, and decode calls are not a reliable canonical aggregate accounting boundary. The required upstream hook belongs after encoding-derived byte-length calculation and before decode/conversion, with an aggregate per-entry budget across encodings. Facade/message limits do not close that gap. |
| Native runtime/backend | An artifact-enabled locked Wasmtime run passed 28 native-host tests, including aggregate predecode budgeting, retained-borrow denial, owned-drop, partial-start cancellation and runaway interruption. The 136,476-byte guest used by one native test matches the payload in the current debug CLI's headless browser build (`../target/same-byte-headless-round88.json`); this is not native-window interaction or proof of browser pre-lift budgeting. Without `LOOP_DOCUMENT_ARTIFACT_DIR`, artifact-dependent tests can return early while counted as passed. The native coordinator now terminates its backend on connection-setup failure and bounds separate process and stdout joins; synthetic faults and a real headless fake child exercised these paths. An isolated test exercised the public native bridge over a real fake process: framed render, activation event, close and scope disposal passed. A relocated prior debug CLI also ran the official native TypeScript starter and its status provider against a headless protocol fake via a trusted test-only spawn interceptor (`../target/native-headless-cli/ae46e581-28bd-40d7-b7dd-1710516cbf4a.json`); this did not exercise the Rust native backend, Tao/Wry or a Component guest, and window avoidance depends on the reviewed CLI honoring the prepare hook and spawn interception. During native startup, closure cancels startup without releasing reservations ahead of cleanup; explicitly incomplete cleanup retains both instance and profile locks. A relocated prior CLI accepted a stop during a held readiness hook while retaining both locks until the hook finished (`../target/native-headless-cli/7088affa-45f4-4af4-9044-96ab69bb6d5c.json`), and stopped a pending native handshake (`../target/native-headless-cli/d1a2a51c-2596-4e36-a290-278d571bdc17.json`). These used a headless fake backend, not Tao/Wry or a Component guest. Isolated supervisor/adapter tests and a relocated-CLI readiness race (`../target/native-headless-cli/22ad044c-3da5-4daf-b1ff-27999ec9ed27.json`) exercised these boundaries against fake backend processes. Abort closes surface reads before joining in-flight setup and readiness hooks and disposing host scopes; cancellation is checked again after active-record publication. Timeout still reports incomplete cleanup rather than proving termination, and noncooperative trusted setup or disposal can delay settlement. Production Tao/Wry UI rendered pointer/keyboard events and sibling survival. Native EOF harness on CLI `322124fd16c2051a2c6a2dafa385168ae58c2015dc4846d30badf2c0e4753a71` closed pending reads at 69.7 ms and partial start at 1,091 ms, fail-closed exit 1 with no partial-start ready frame (`target/native-eof-final/receipt.json`). Outside-checkout evaluated-config native run/stop also passed on that prior CLI with real WebView, exact profile and public tarballs. The installed optimized CLI has since resolved an external offline-tarball native starter, refused untrusted evaluation, and rejected a tampered plan (`../target/native-plan-round27-summary.json`); the durable relocated CLI verifier repeats those checks offline and uses a side-effect marker to confirm that stale dependency preparation is rejected before config executes. It passed on the prior debug CLI with freshly packed local tarballs (`../target/relocated-cli-round53.json`). These inspection gates did not launch a native backend, Component or UI. |
| Releases and clients | An unpublished prior optimized ZIP (`39d2c9bb0e0015d38315dba7b6fc76cf9c1edfc18bf3471b36d5d6b8bf9d9442`) passed an isolated install, same-byte upgrade, checksum refusal and direct-manager uninstall while preserving a user file (`../target/release-isolated-round86/receipt.json`). Its installed CLI passed headless Component browser lifecycle acceptance (`../target/host-browser-cli/1794359283410/receipt.json`); this did not exercise native UI or CLI-delegated uninstall. The same optimized binary passed native provider and startup-stop tests against a headless protocol fake (`../target/native-headless-cli/667433c0-3d21-46ac-ab17-18c12fba3ce4.json`, `../target/native-headless-cli/748a8b10-7532-42f8-bcbd-2f269baa749d.json`, `../target/native-headless-cli/eefcd5af-0f95-4dda-92eb-7eaf0712a556.json`). This fake is not the Rust native backend or Tao/Wry. The optimized CLI also created and built the legacy Rust template offline, then ran a copied bundle headlessly (`../target/release-legacy-round86/receipt.json`); it used cached crates and is not new native-kit UI. The current `bun run verify` passed workspace builds/typechecks/tests and external Bun/Node packed consumers; 19 opt-in or isolated tooling entrypoints were skipped (isolated fixtures run through parents). The current local CLI crate archive passes its embedded/source inventory audit. Extracted current CLI and host archives also passed offline all-target/all-feature compilation using an explicit local host patch (`../target/paired-crate-round88.json`); that is not registry compatibility. The reusable offline `registry-crate.ts` verifier resolved 424 dependencies against registry `loop-host 0.1.0`, then the prior round-84 extracted archive failed with four `E0433` references to missing `loop_host::native_kit`; see `../target/registry-crate-round84.json`. The current round-88 archive has not repeated that registry-only gate. The verifier reports early failures as structured JSON and rejects path/git dependencies in its generated lock, but accepts only trusted local archives; decompression is not resource-bounded. Ambient Cargo source replacement, compiler and reused caches can affect provenance, and only default targets/features are checked. The CLI calls `run_surface`/`run_component`; published `loop-host 0.1.0` omits the module. Its `desktop` feature only enables Tao/Wry and cannot restore it. There is no safe CLI-local shim without duplicating native-kit ownership or dropping native commands. Registry compatibility requires an upstream host release containing `native_kit`, a synchronized CLI dependency update, then compiling an extracted CLI archive with a registry-only lock and no path patch. A relocated prior debug CLI passed scaffold, trust, build, HTTP, stop and restart checks against copied local packages (`../target/host-config-smoke/a5d51120-83d0-43cd-8b3d-b274f52ef9d3.json`); that probe did not run browser UI or a Component. Codex app-server discovered the skill installed by the locally packaged optimized CLI in a disposable project (`../target/codex-skill-discovery-round26/receipt.json`); model invocation and published-release behavior remain unverified. The current source-built debug CLI passed an offline, outside-checkout legacy Rust create/run/build smoke whose generated bundle ran headlessly after relocation (`../target/release-smoke-round20.json`); the CLI itself was not relocated or installed and this is not native host-kit acceptance. A separate locally packaged debug ZIP passed isolated install/upgrade/uninstall tests and its installed CLI passed a two-instance headless custom-provider run (`../target/release-round21/receipt.json`). A locally built optimized ZIP also passed the isolated install lifecycle; its installed CLI ran an external legacy Rust app headlessly and passed Component-profile browser build/run/stop/restart (`../target/release-round22/receipt.json`). A subsequent temporary install of the optimized CLI also passed a two-instance custom-provider browser run against an offline-tarball consumer outside the checkout (`../target/custom-provider-fixture-2/final-cli-provider/1794146740071/receipt.json`). A subsequent installed-CLI Component browser run also passed against an offline-installed consumer outside the checkout, including relocated static interaction, two launches, stop-A/B-survival, restart and cleanup (`../target/host-browser-cli/1794146921584/receipt.json`). The installed optimized CLI also built an existing external legacy Rust project; a copy of its generated bundle ran headlessly from another external directory (`../target/release-round22/relocation-round25.json`). Neither archive was published and no current native UI was exercised. Published-release relocation, host application acceptance and complete hostile/all-engine conformance still need their own receipts. No result here authorizes a consumer migration or publishes anything. |

Use the [Component adapter reference](../packages/component-polyengine/README.md)
for its exact worker inputs and predecode limitation, and the
[native reference](../packages/host-native/README.md) for Windows-only initial
presentation and its supported semantic subset. The official kits do not require
Electrobun, CEF/GPU parity or a native updater.

## Configuration is executable trusted code

`loop.config.ts` imports local functions and runs with same-user host authority.
Static inspect does not import it. Evaluation requires `--evaluate-config` plus
`--trust-local-config`; run/dev/build in config mode require the trust flag too.
Without it, the command returns `E_CONFIG_TRUST` and exit 3. The CLI delegates
trusted evaluation to its bundled Bun worker; coordinator callbacks stay there.
A subprocess and a JSON schema control lifecycle, not hostile-code authority.

New-mode `--json` success includes schemaVersion 1, operation, executedConfig,
selected target/instance, result, diagnostics and status. Errors include status
`failed` and diagnostic code/message; do not depend on success-only fields in an
error. Recognized new-mode pre-dispatch failures also use a diagnostic envelope
with `--json`; Clap syntax/help processing can exit before that handler. Legacy
execution failures retain stderr/exit 1. Kit errors use exit 2 for invocation/schema,
3 for trust, 4 for tool/runtime/build,
5 for conflict/busy/stale and 6 for protocol. Preserve the exact code in diagnostics
when deciding whether to reconcile or retry; cancellation cannot roll back a commit.

`loop.toml` continues to describe the existing CLI application; `loop.package.json`
is the literal source snapshot inventory. The [canonical compatibility contract](../specs/host-kits.md#2-existing-formats-discovery-and-compatibility)
defines selection rather than silently merging all three files.

## Choosing native or Electrobun

[Desktop backend research](reference/desktop-hosts.md) explains the evidence and
tradeoffs. Electrobun really supports Rust native mains, native GPU and optional
CEF, but their availability differs by platform/runtime. Its pinned native Rust
SDK lacks an updater API; use a Bun-owned shell when reusing that updater. Views
anchored to DOM remain native views, with clipping/focus/input constraints.

This research is for optional compatibility, not an official backend choice.
The native kit need not recreate CEF/GPU/updating for parity. Declare unsupported
capabilities and keep the first release focused. Do not add an Electrobun package,
Hutch preparation or a fork to official builds. A compatibility example that needs
substantial framework integration should be deferred.

## Extending the system

The [custom browser kit and TS provider example](../examples/host-kits/custom-provider/README.md)
uses public package roots, its own `example:kit/counter-browser@1.0.0` identity and
pinned coordinator export. Prepare its explicit local tarball consumer first, as
its README describes. Then select the source-built CLI:

```powershell
loop inspect examples/host-kits/custom-provider/.artifacts/consumer --evaluate-config --trust-local-config --target counter --json
loop dev examples/host-kits/custom-provider/.artifacts/consumer --config loop.config.ts --trust-local-config --target counter --instance custom-counter --json
```

The November 8 observed run rendered count 0→1 by pointer, 1→2 by Enter and 2→3 by
Space through the named provider. It recorded prepare/ready/quiesce callbacks,
CLI stop/exit 0 and cleared surface content. This proves ordinary trusted TS browser
composition with an external kit identity; it does not prove Component execution,
native hosting, hostile-code isolation or physically outside-checkout conformance.
The five-tarball consumer used installed packages without workspace links.

Add integrations through typed factories and public coordinator/runtime exports,
not framework-name branches in the portable resolver. Optional ecosystem examples
remain independent of official browser/Rust-native release requirements.

The source-built CLI's [bundled skill manager](reference/skills.md) implements
`loop skills list/inspect/install/update/remove/recover` against the existing
repo catalog and payload. Local verification exercised every verb through the
Rust bridge with project/user fixture roots. Mutations plan unless you pass `--write`; ordinary
create/run/build/doctor do not alter skills or user instructions. The reference
records its parser, tested filesystem behavior and trusted-local durability limits.
Release relocation and real agent discovery remain separate gates. The
[skill-manager contract](../specs/host-kits.md#8-repo-skill-and-optional-data-driven-installation)
owns the broader acceptance requirements.

## Implementation and evidence

- [Canonical host-kit contract](../specs/host-kits.md): typed identities/keys, lifecycle, protocol, boundaries and compatibility.
- [Existing implementation lane and cards](development-alpha/execution-plan.md#host-kit-implementation-lane): required integrated mission, not completion after HK-01.
- [Disposable feasibility receipt](../experiments/host-kits-2026-11-03/README.md): actual same-byte Chrome and Rust desktop tests, compiler gap and production limits.
- host application adoption remains product-owned: preserve product policy, saved identities, React UI and packaging; a working kit does not authorize migration.
