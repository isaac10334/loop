# Engineering plan

## Host-kit implementation in progress — current checkout

Substantial implementation and real runtime evidence exist, but the mission is **not
complete**. Browser Component CLI execution and the latest relocatable crate inventory
now pass. The material release blockers are Polyengine 0.6.7's missing canonical
pre-lift allocation budget, published registry `loop-host 0.1.0` lacking the native
kit, and remaining installed-release/client-discovery acceptance. Do not infer full
HK-06/G1/G2 completion from package builds or a passing ordinary run.

- Source now includes typed plan/factory resolution, opt-in trusted Bun config,
  static vs evaluated inspection, explicit create/dev/run/build/stop/restart/skills
  commands, pinned coordinator/adapter integrity, native/browser kits, and source
  generation foreground replacement. The canonical contract and golden framing corpus
  remain in `contracts/host-kit-v1.json` and `contracts/host-kit-protocol-golden.json`.
  Legacy `loop.toml` behavior remains separate.
- Real custom-kit evidence is positive: a materialized, no-workspace-link five-tarball
  consumer previously ran the evaluated custom coordinator/provider through the CLI
  in Chrome; pointer/Enter/Space advanced 0→3, hooks ran, and stop cleared the surface.
  After strict Bun-lock validation, the offline fixture generator creates both locks.
  Tested CLI SHA `eb2673118fb19b81a67102949552a89ef50c996b572ff2d6ad540f3afb9a3bed`
  re-evaluated the fresh fixture under the consumer (`target/custom-provider-fixture-2/consumer`)
  as plan `724e12cee4fb24a2cd3515b8e2a2c485f4947578404d947f601513bc9fc9c74b`; see
  the final plan receipt (`target/custom-provider-fixture-2/evaluated-plan-final-eb267.json`).
  Chrome pointer/Enter/Space, lifecycle hooks and `dev` replacement were subsequently
  exercised on that tested CLI; see the detailed receipts below. An earlier static
  build correctly refuses live callbacks (`E_NONPORTABLE_CALLBACK`). This is
  trusted TS, not a guest sandbox or Component grant.
- Native Wasmtime conformance: 28 tests pass in the latest locked workspace run;
  `target/host-native-conformance-final.log` retains the earlier 26-test detailed
  receipt. Same-byte v2 output, nominal retained-borrow denial, owned-drop isolation,
  cancellation and runaway controls were exercised. Public `Store::set_hostcall_fuel`
  bounds aggregate encoded lifting at 2,097,664 bytes per call/result; oversized
  invalid UTF-8 and results trap before decode/allocation. This is aggregate encoded
  work, distinct from each field's 1 MiB UTF-8 policy limit. Outside-checkout native
  evaluated-config run/stop passed on CLI `322124fd16c2051a2c6a2dafa385168ae58c2015dc4846d30badf2c0e4753a71` (exit 0); production Tao/Wry pointer/keyboard UI remains in
  `target/host-native-ui-20261107-1935/receipt.json`. Final pipe EOF regression
  `target/native-eof-final/receipt.json` closes event reads (69.7 ms pending, 1,091 ms
  partial start; exit 1 by fail-closed contract).
- Browser Polyengine actual-engine tests prove retained borrowed handles trap and
  owned resource drop closes only its own resource. The measured receipt
  `target/host-browser/1794128070319/receipt.json` explicitly says
  `fullComponentConformance: false`: a 2,097,665-byte invalid input/result reaches
  TextDecoder before the adapter's post-lift checks. EmbedderOptions 0.6.7 exposes only
  `jspi`/`verifyHash`, not a pre-lift budget. Runtime `cabi/strings.js` derives lengths at
  lines 83-104, then has only a 2^28-1 default guard before decode/conversion (106-120):
  UTF-8/UTF-16 use TextDecoder, while Latin-1 uses a custom decoder. A prototype guard
  would miss Latin-1 and does not provide reliable canonical aggregate accounting.
  Required upstream hook: count encoding-derived bytes across each entry and reject above
  2,097,664 before decode/conversion, covering every string encoding. Per-field
  facade/message bounds, worker deadline and post-decode result cap do not close that
  gap. The worker rejects decoded revisions over 128 UTF-8 bytes before posting a
  write request and avoids re-encoding overlong error details; the session independently
  rejects oversized decoded results before re-encoding and preserves an uncertain outcome
  after a committed write. Both sides now validate bounded failure-variant shape and
  data-only fields; malformed worker failures fail closed and remain uncertain after a
  committed write. Controlled-worker tests cover malformed and valid cases. In real-engine
  headless Chrome, a hostile guest's 129-byte ASCII and 130-byte multibyte revisions both
  returned `revision-rejected` with zero observed host write frames
  (receipt (`target/host-browser/1794306420327/receipt.json`)). Wasmtime ran the same hostile
  guest; its revision-budget cases also passed. Browser decoded success results match
  native's 1 MiB + 256 byte ceiling while source remains 1 MiB. Real Chrome and artifact-enabled
  Wasmtime each committed a 1 MiB source and returned a 1,048,594-byte metadata result
  (native evidence (`target/same-byte-headless-round88.json`)). Invalid-source details now share
  the native 64 KiB cap. The browser validates exact data-only variants and individual field
  bounds instead of applying an unrelated JSON size limit to structured-clone messages; a
  real-engine conflict with a 530,000-byte newline source passed even though JSON encoding
  would exceed the old limit. These post-lift checks do not close the pre-lift budget gap.
  Strict ordinary-TS official CLI browser acceptance
  passed earlier on A70C at `target/host-browser-cli/1794134069659/receipt.json`. The
  current debug CLI (`345e5714ee4620092f99e539cd7b57875e7dba5474f0a04430f6cfd82d7a14b5`)
  passed headless Component-profile CLI acceptance at
  `target/host-browser-cli/1794362563714/receipt.json` (plan
  `31abef9e42cc2dff01be19d1c4123335f1c7113937f0d744de0f45586c1c746c`): relocated static interaction,
  two Component launches, stop-A/B-survival, fresh-epoch restart, and cleanup to zero
  workers, pending host calls and live grants, with no console/page/request errors. A prior
  run (receipt (`target/host-browser-cli/1794308720235/receipt.json`)) saw readiness 500 and
  a page error. A controlled held-hook test reproduced that failure on the prior CLI
  (receipt (`target/host-browser-stop-ready/37eae580-2707-41dd-93a6-36df0a445bb5/receipt.json`)).
  The server now acknowledges cancellation with `{state:'stopping'}` and the generated
  client disposes and acknowledges it; a real headless browser passed this controlled
  schedule without console/page errors (receipt (`target/host-browser-stop-ready/f33793d6-deea-4e0f-aceb-90806e3bcf37/receipt.json`)).
  Genuine hook failures still report failure; arbitrary schedules are not exhaustively proven.
  Development replacement also aborts the old ready hook's generation-scoped signal,
  publishes `replacing`, and joins that hook before promotion. A controlled Chrome run
  reproduced the former overlap/409 failure (receipt (`target/host-browser-replace-ready/b308fd82-4b9d-4c5e-9359-27d321da0504/receipt.json`))
  and passed with the current CLI (receipt (`target/host-browser-replace-ready/4ce1d0b4-429c-43c9-89e8-425f2a10edd6/receipt.json`)).
  Unit tests cover old-hook failure, late ready, and stop while replacement joins it.
  A hook that ignores cancellation can delay replacement indefinitely; no universal
  termination or all-schedules guarantee is implied.
  Installed optimized CLI and an external Component consumer also passed the same
  headless acceptance in Microsoft Edge 157 (receipt (`target/host-browser-cli/1794149082284/receipt.json`),
  browser identity (`target/host-browser-cli/1794149082284/browser-context.json`)). Edge
  and Chrome both use Chromium; this is not a distinct engine, WebView2 or hostile-budget
  conformance proof. An installed optimized CLI also passed a headless Component `dev`
  source-only replacement against an external fixture: both old guests wrote before the
  edit, disposal acknowledgements preceded reload, new documents started fresh, and
  stop-A/B-survival and restart passed (summary (`target/host-browser-cli/1794149528816/dev-replacement-summary.json`)).
  Old-generation worker counters were not captured before reload. A prior diagnostic
  attempt observed a replacement UI/API active while `launch.json` still contained the
  old plan (receipt (`target/host-browser-cli/1794149469328/receipt.json`)); the passing
  harness waited for the persisted record. The live supervisor now sends launch records
  through the [ordered atomic publisher](crates/loop-cli/host-tools/launch-record.ts):
  snapshots are serialized at submission and replaced through same-directory temporary
  files, with bounded Windows sharing-violation retries and no delete-then-rename fallback.
  Four focused tests pass, and a live Component dev replacement with 2,082 concurrent
  record reads had zero parse errors (receipt (`target/host-browser-cli/1794150608750/receipt.json`)).
  Readiness is now single-flight, checks the client and generation around asynchronous
  hooks, publishes active before exposing it in memory, and stop joins in-flight ready
  hooks before quiescing. Three deterministic direct-supervisor HTTP tests cover duplicate
  ready, stop during a held hook, old-client replacement and hook failure; disposal was
  simulated, not a full browser race. Stop now publishes `stopping` before cleanup and
  releases reservations only after that publication and successful quiescence; failed
  starts record `failed`. A quiesce-only plugin previously never obtained a context and
  its cleanup was skipped; the supervisor now registers hook ownership before optional
  prepare. Direct success/failure tests and opt-in relocated-CLI regressions verify a
  quiesce-only hook, two concurrent stops, exactly one seven-second cleanup, and failure
  retaining its reservation with a recovery-required retry. Startup plus cleanup failures
  now retain bounded nested messages in CLI diagnostics and the launch record; null and
  unprintable thrown values no longer prevent cleanup or crash protocol error reporting.
  Three relocated-CLI startup-failure regressions passed on a prior binary. Aggregate
  text is depth/width/size bounded and may omit later nested errors. Development disposal
  rejection is observed immediately: an isolated direct-supervisor test injected a rejecting
  development owner while an HTTP client was registered, observed no unhandled rejection,
  acknowledged disposal, and verified later plugin cleanup, failed record and retained lock.
  The development owner was mocked; this is not a full dev-build or browser fault injection.
  The earlier slow and quiesce-failure CLI
  tests used the prior debug binary and copied local package builds, not a published
  release. Direct tests hold
  a ready hook while checking the persisted
  state and exclusive lock, and inject stopping-publication, quiesce and profile-unlock
  failures. Exclusive lock creation now records ownership immediately on successful open,
  closes on write failure and preserves both write/close errors. Unit fault injection and
  a real profile-contention test passed; actual OS write/close failure cleanup has not been
  exercised. Lock removal can still leave a partial set after an unlink failure. An
  already-submitted active write may still appear briefly before `stopping`.
  An in-process non-cooperative hook can still hold cleanup indefinitely. The foreground
  CLI now allows ten seconds after observing `stopping`, then fails and attempts to
  terminate its owned process tree; this may interrupt slow legitimate cleanup and cannot
  roll back trusted external effects. An actual async never-resolving ready hook produced
  the expected timeout, process exit and retained `stopping` record/lock in that scenario
  (receipt (`target/noncooperative-cli/1794154349649/receipt.json`)). The separate stop
  client now waits up to twelve seconds rather than six: a seven-second cooperative hook
  previously caused a false stop failure (receipt (`target/slow-cleanup-cli/1794154268968/receipt.json`))
  but now succeeds (receipt (`target/slow-cleanup-cli/1794154343441/receipt.json`)); the
  non-cooperative case still fails closed. A second stop issued after `stopping` is now
  persisted waits for the same epoch instead of falsely reporting `E_INSTANCE`; two real
  CLI stop clients both succeeded after seven-second quiescence (receipt (`target/slow-cleanup-cli/1794154944441/receipt.json`)).
  Selection fails closed on multiple stopping epochs or a failed epoch retaining its lock;
  stale records can still create conservative ambiguity, and same-target active selection
  does not prove an older stopping epoch's external effects completed. A Windows relocated
  CLI test observed one ordinary worker-spawned descendant alive before the stop timeout
  and absent afterward, before its 25-second self-exit; that scenario retained its lock
  (receipt (`target/process-tree-test/a8ef2927-6fc9-478f-aa61-150d894e656a.json`)). PID
  probing is best effort and does not prove termination of escaped or all descendants;
  lock retention and descendant termination are not guaranteed in every race.
  Live-inspection responses now have a separate ten-second
  receive deadline; a real synchronous `Atomics.wait` block produced `E_PROTOCOL_TIMEOUT`,
  owner exit and a retained `awaiting-browser` record/lock (receipt (`target/syncblock-cli/1794155376933/receipt.json`)).
  This can also terminate a legitimately unresponsive worker; pipe writes and process-tree
  termination are not proven wall-clock bounded, and Ctrl-C uses separate deadlines.
  Final publication follows
  lock release, so a final-write failure leaves a `stopping` record
  after successful cleanup and release. A Windows test held the actual record open to
  force that failure: stop rejected, in-memory inspection now reports `failed`, disk
  retained `stopping`, and a new epoch started. With `LOOP_TERMINAL_TEST_CLI` set to the
  current debug CLI, real CLI `stop` selected and stopped the new epoch despite the stale
  old record. This exercised a direct supervisor plus CLI, not an installed release. Stop
  requests now interrupt `replacing` and abort guards prevent late promotion/resumption.
  A direct-supervisor test and a headless two-instance CLI test with an intentionally
  held disposal acknowledgement passed (receipt (`target/host-browser-cli/1794152436033/receipt.json`));
  the stopped instance retained its old plan while its sibling promoted and remained usable.
  An earlier attempt had the same functional outcomes but logged one unclassified browser
  `ERR_CONNECTION_REFUSED` (receipt (`target/host-browser-cli/1794152386337/receipt.json`));
  the subsequent run did not reproduce it. The publisher's terminal fence remains unused.
  Launch epochs now require 1–128 lowercase ASCII letters/digits/hyphens, starting with
  a letter/digit and excluding Windows device names; exclusive epoch-directory creation
  rejects reuse. Direct supervisor tests cover traversal, reserved names, concurrent
  same-epoch creation and preservation of stopped records. This restricts the previously
  opaque worker-protocol epoch input; the Rust CLI's generated epoch remains compatible.
  This is not protection against malicious same-user directory replacement.
  The earlier `E_IMPORT_CLOSURE` was a false positive from `import(...)` prose inside
  Polyengine comments. Syntax-aware Bun parser probing now ignores comments/literals
  while still rejecting computed imports. Full canonical ABI conformance remains false
  until an upstream pre-lift budget exists.
- The current Rust gate passed `cargo fmt --all --check`, locked workspace/all-features
  tests (CLI 20, host 28, doctest 1), and all-target/all-features Clippy `-D warnings`.
  The ordinary Rust run did not set `LOOP_DOCUMENT_ARTIFACT_DIR`, so artifact-dependent
  cases can return early while still counted as passed. A separate run explicitly set the
  six-artifact directory: all 28 host tests passed, including actual guest execution,
  canonical budget traps, borrowed-handle lifetime and measured runaway interruption
  (receipt (`target/same-byte-headless-round88.json`)). The same receipt links the
  136,476-byte guest SHA-256 `632af23fc28546ff5c319fb23c26eede7404ac15fbe2b9eb8f24a261c070ea38`
  to the current debug CLI's earlier headless browser bundle and Wasmtime tests. This is not a native
  window/CLI interaction or browser pre-lift conformance proof. Current debug CLI SHA-256 is `345e5714ee4620092f99e539cd7b57875e7dba5474f0a04430f6cfd82d7a14b5`;
  embedded worker SHA-256 is `39deb784687b25d679964ec86cf4fa5f8d16ffaa31616c9a49d4f0a688c29aa5`.
  The optimized ZIP and custom-provider evidence below use earlier binaries and predate
  the browser readiness cancellation change.
  Pipe-EOF receipt `target/native-eof-final/receipt.json` used the prior CLI
  `322124fd16c2051a2c6a2dafa385168ae58c2015dc4846d30badf2c0e4753a71`; it closed
  pending event reads at 69.7 ms and partial-start cancellation at 1,091 ms, both
  fail-closed exits with no partial-start ready frame. Native runtime implementation was
  unchanged afterward; the artifact conformance test was later extended.
- The current broad `bun run verify` passed package builds, typechecks and tests,
  215 tooling tests and 19 tooling skips (15 opt-in CLI cases and four isolated fixture
  entrypoints, whose parents run those fixtures), and external Bun/Node packed consumers.
  The held-ready stop and replacement browser cases were separately exercised as recorded
  above; earlier startup-stop cases used the prior binary as recorded below.
  The Component package passed 20 tests, with its isolated fixture entrypoint skipped in
  direct discovery but exercised by its parent. `bun run typecheck` passed after the initial
  startup-stop changes; the changed nested supervisor tests also passed explicit TypeScript
  checking after typed native cancellation. Isolated decoded-value tests mock the engine; the separate
  Chrome probe exercises real Polyengine. The crate inventory audit is not a registry
  compatibility gate.
  A starting record is now published after instance/profile reservations and before
  prepare hooks; an explicit stop aborts startup but joins hooks before unlocking.
  Relocated prior-CLI tests stopped a held browser prepare hook
  (receipt (`target/host-config-start-stop/36b1de24-8085-4c88-9f21-be658d31f708.json`))
  and a held native readiness hook against a headless fake backend
  (receipt (`target/native-headless-cli/7088affa-45f4-4af4-9044-96ab69bb6d5c.json`)).
  Both observed locks until hook completion; a separate fake-backend run stopped before
  native handshake (receipt (`target/native-headless-cli/d1a2a51c-2596-4e36-a290-278d571bdc17.json`)).
  Cancellation before native readiness is typed `E_CANCELLED`; none of the native tests
  exercised Tao/Wry or a Component guest. Noncooperative trusted hooks can still delay cleanup. A stop before
  the starting record is published cannot yet be delivered. If lookup observes an instance
  lock whose epoch has no matching live record, it now fails closed instead of reporting
  an older stopped epoch as success (receipt (`target/host-config-unrecorded-lock/15012ea7-d0c8-411a-bd89-43a855b41361.json`)).
  Lock and record reads are not an atomic snapshot: a later lock acquisition or concurrent
  transition can still race the lookup, and a conservative error may require a retry.
  Four opt-in CLI tests subsequently passed on the prior relocated debug CLI:
  scaffold/inspect/trust/build/run/idempotent-stop/restart, concurrent slow quiescence,
  descendant termination and failure retaining its reservation. The general smoke test
  now writes a uniquely named receipt with the binary hash and scope limits
  (receipt (`target/host-config-smoke/a5d51120-83d0-43cd-8b3d-b274f52ef9d3.json`));
  its HTTP probe does not execute browser UI or a Component. The quiesce-only direct test
  also verifies its owner is disposed while the instance lock is
  held, then the lock is released. Current focused evaluator tests pass 8/40; tooling
  typecheck passes. The tested CLI
  re-evaluated the lock-hardened custom fixture to plan
  `724e12cee4fb24a2cd3515b8e2a2c485f4947578404d947f601513bc9fc9c74b`, then passed a
  headless Chrome `run` acceptance with two instances: isolated provider state (both
  start at zero), pointer/Enter/Space activation, stop-A leaves B usable, and awaited
  prepare/ready/quiesce plus root disposal; zero browser errors. Receipt
  `target/custom-provider-fixture-2/final-cli-provider/1794143842127/receipt.json`
  records CLI SHA `eb2673118fb19b81a67102949552a89ef50c996b572ff2d6ad540f3afb9a3bed`.
  The same checks passed in that CLI's `dev` mode without editing source; receipt
  `target/custom-provider-fixture-2/final-cli-provider-dev/1794144877318/receipt.json`.
  A separate offline fixture then passed one valid source replacement: both dev
  browsers automatically displayed the changed heading and became active under plan
  `ba1b5a627298150f73f69913688d4f140d5feb2a8080028fdf4b0bf44e21c22a`, followed by
  independent input and stop-A/B-survival; see
  `target/custom-provider-reload-round16/results/1794145019838/receipt.json`.
  A further isolated run introduced a new import: both instances reported
  `E_DEV_RESTART_REQUIRED`, retained the original active plan and accepted input;
  replacing it with a valid heading edit then reloaded both and reset their counters
  from 2 to 0. Receipt `target/custom-provider-dev-reject-round17/results/1794145158247/receipt.json`.
  A separate malformed-source test produced `E_DEV_BUILD: Unexpected ;` in both
  instances, which kept their original plans active and usable; a corrected source edit
  subsequently reloaded both. Receipt
  `target/custom-provider-dev-failure-round18/results/1794145294977/receipt.json`.
  This syntax failure may occur during import scanning and does not prove downstream
  bundler-failure recovery or exhaustive cleanup. Static `build` still correctly
  rejects live callbacks (`E_NONPORTABLE_CALLBACK`). The strict Components-profile CLI
  passes actual headless Chrome run/build/stop/restart acceptance; no computed-import
  exemption was added.
- Skills passed 38 tests/268 assertions; CLI smoke passed 23 commands and 19 zero-write
  checks. Current CLI `skills list --json` returned `status: ok` with payload digest
  `05f7f1be23d33b4e19f3521bf724627c44e1116d5f002a12d7e7f8c59ee485a7`. Codex CLI 0.116.0
  app-server `skills/list` discovered the optimized installed Loop CLI's skill as enabled
  and repo-scoped in a disposable external project; see
  `target/codex-skill-discovery-round26/receipt.json`. The skill and temporary CLI
  installation were removed afterward. No model invocation or published release was tested.
  An isolated `CODEX_HOME` did not prevent scanning OS-user skill roots; unrelated
  metadata was omitted from the receipt. The current `cargo package --no-verify` archive
  `target/host-kit-archive-round88/package/loop-cli-0.1.0.crate`, SHA-256
  `f8e7e2f3982d2ae355f1000676c9b635f4784d1bb8d233a6952fd8585af2682b`, passed inventory:
  26 files, 12 embedded hashes, 119 current-source hashes, zero unlisted targets.
  The current extracted CLI and host archives passed offline `cargo check --locked
  --all-targets --all-features` for the CLI, using an explicit local patch to the extracted
  host and a newly generated lock (receipt (`target/paired-crate-round88.json`)). The reusable
  [paired verifier](tooling/host-kit-verification/paired-crates.ts) rejects unexpected local or
  non-checksummed/non-crates.io lock dependencies; it uses trusted archives, ambient Cargo
  configuration and a reused cache. The current host archive has 22 files and SHA-256
  `a529c00d920586888081e0f1b423061992ecec8ef2f43be470387973c93059c3`.
  Independently, the extracted host passed offline locked `cargo check --all-targets
  --all-features` using its packaged lock (receipt (`target/extracted-host-round52.json`));
  the lock has one local package (the host) and 397 registry packages. These checks used
  local Cargo caches and do not prove CLI registry-only resolution or installed UI. The reusable [registry crate verifier](tooling/host-kit-verification/registry-crate.ts)
  extracts an archive outside the workspace, generates an offline lock, rejects
  non-root path/git dependencies and checks the exact crates.io host source. On the
  prior round-84 archive it resolved 424 dependencies including registry `loop-host 0.1.0` (checksum
  `19cf2b0624b1251e213b0bd03b29bd7915b714553a080587f3bf776cf93a86b9`), then failed
  CLI compilation with four `E0433` references to missing `loop_host::native_kit`
  (`run_surface`/`SurfaceOptions`, `run_component`/`NativeOptions`); see
  the prior registry-only compile receipt (`target/registry-crate-round84.json`). The
  round-88 archive has not repeated that registry-only gate.
  Nine focused tests cover path aliases, lock-graph validation and structured errors for
  missing arguments, missing archives and invalid archives. The verifier accepts
  trusted local archives only, uses ambient Cargo config/compiler and may reuse a target;
  registry source replacement and caches can affect provenance, decompression is not
  resource-bounded, and it checks default targets/features only. It is not a hostile
  archive sandbox or a complete future release matrix.
  Current CLI calls those APIs from `crates/loop-cli/src/main.rs`; published
  `loop-host 0.1.0` omits the module in `target/package/loop-host-0.1.0/src/lib.rs`, while
  workspace `loop-host/src/lib.rs` exports it. `desktop` enables Tao/Wry only. There is
  no safe CLI-local shim: the prerequisite is an upstream host release with `native_kit`,
  a synchronized CLI dependency update, then an extracted-archive `cargo check --locked`
  with registry-only resolution. No publish/deploy occurred.
- The current source-built debug CLI passed the legacy Rust headless release-smoke
  script offline outside the checkout: create, run (counts 0/1/2), build with cached
  registry `loop-host 0.1.0`, and relocated generated bundle (guest count 2). See
  the smoke receipt (`target/release-smoke-round20.json`). The CLI itself was not
  installed or relocated; this does not prove the new native host-kit or registry-only
  CLI crate compilation, and no visible desktop UI was opened.
- A separate release-format ZIP containing a prior debug binary passed isolated
  install/upgrade/checksum-refusal/uninstall tests without PATH or registry changes.
  The temporary installed binary listed skills, evaluated the custom-provider plan,
  and passed two-instance headless browser interaction and stop-A/B-survival; see
  the archive/install receipt (`target/release-round21/receipt.json`) and
  the browser receipt (`target/custom-provider-fixture-2/final-cli-provider/1794146108890/receipt.json`).
  The install was removed. This was a local debug archive and the consumer stayed under
  checkout `target`; it is not a published/optimized release or native UI acceptance.
- A prior optimized CLI SHA-256 `103b1e6940acc1d787ac4cf06845395fb254cf5a4a10206807f6d6ab4a417503`
  was packaged as an unpublished ZIP SHA-256 `39d2c9bb0e0015d38315dba7b6fc76cf9c1edfc18bf3471b36d5d6b8bf9d9442`.
  In an isolated directory with no PATH, registry or Rust installation changes, it passed
  install, same-byte upgrade, checksum refusal, direct-manager uninstall and user-file
  preservation (receipt (`target/release-isolated-round86/receipt.json`)). The installed
  executable passed headless Component browser lifecycle acceptance
  (receipt (`target/host-browser-cli/1794359283410/receipt.json`)); readiness was explicitly
  acknowledged before stop. The same optimized bytes passed native starter/provider,
  pending-handshake stop and held-readiness stop with a trusted headless fake backend
  (provider (`target/native-headless-cli/667433c0-3d21-46ac-ab17-18c12fba3ce4.json`),
  handshake (`target/native-headless-cli/748a8b10-7532-42f8-bcbd-2f269baa749d.json`),
  readiness (`target/native-headless-cli/eefcd5af-0f95-4dda-92eb-7eaf0712a556.json`)).
  Window avoidance depends on the reviewed CLI honoring the test-only spawn interceptor;
  no Rust native backend, Tao/Wry UI, Component guest in native UI, published artifact,
  signature, or CLI-delegated uninstall was exercised in these gates. The same optimized
  CLI also created and ran the legacy Rust template headlessly, built it offline, and ran
  a copied bundle headlessly (receipt (`target/release-legacy-round86/receipt.json`)); that
  fixture is under `target`, uses cached registry crates and is not new native-kit UI.
- A prior optimized CLI (`1102ff6b6de9fc67dc7aa85a760f633a007f3a28e4f81ed24f65e00be387f008`)
  was packaged and passed the same isolated installation lifecycle. Its temporary
  install listed skills, ran the existing external legacy Rust app headlessly (counts
  0/1/2), and passed Component-profile browser build/run/stop/restart, including
  stop-A/B-survival and zero worker/pending-host-call/live-grant cleanup counts; see
  the release-format receipt (`target/release-round22/receipt.json`) and
  the Component browser receipt (`target/host-browser-cli/1794146561190/receipt.json`).
  A later run used a fresh offline installation of the same optimized CLI and a copied,
  offline-installed Component consumer outside the checkout; relocated static build,
  two concurrent launches, stop-A/B-survival, restart and measured cleanup passed with
  no browser errors (receipt (`target/host-browser-cli/1794146921584/receipt.json`)).
  Installs were removed without PATH or registry changes. The ZIP was not published;
  these results do not prove native UI, registry-only CLI compilation or Polyengine
  pre-lift conformance.
  A subsequent temporary install of that optimized CLI passed the custom-provider
  two-instance headless run against a separately prepared offline-tarball consumer
  outside the checkout, including pointer/Enter/Space, independent state, lifecycle
  hooks, stop-A/B-survival and cleanup; see
  the external-consumer receipt (`target/custom-provider-fixture-2/final-cli-provider/1794146740071/receipt.json`).
  The install was removed. This trusted TypeScript test is not a guest-security proof.
  A later installed optimized CLI built the existing external legacy Rust project
  offline; a copy of its generated bundle ran headlessly from a second external
  directory and reported guest count 2 (receipt (`target/release-round22/relocation-round25.json`)).
  This reused source/build cache and does not establish new native host-kit or UI behavior.
  A separate installed-CLI, external native starter was prepared from public tarballs
  offline. Static inspection did not execute config, untrusted evaluation returned
  `E_CONFIG_TRUST`, trusted evaluation resolved `loop:kit/native` / `native-ts`, and
  a modified stored plan returned `E_PLAN_DIGEST`; see
  the summary (`target/native-plan-round27-summary.json`) and plan (`target/native-plan-round27.json`).
  The durable [relocated CLI verifier](tooling/host-kit-verification/relocated-cli.ts)
  now repeats this native starter/trust/plan-tamper gate with offline tarballs and an
  execution marker: static and untrusted inspection leave it absent, trusted evaluation
  creates it. A deliberately stale native dependency then returns `E_PREPARE_REQUIRED`
  without another marker write. All 16 checks passed against the optimized CLI
  (receipt (`target/relocated-cli-round30.json`)) and again against the prior debug CLI
  with freshly packed local tarballs (receipt (`target/relocated-cli-round53.json`),
  tarball hashes (`target/relocated-cli-round53-tarballs.json`)). The verifier passed explicit
  TypeScript checking. No native backend, Wasmtime guest, window or run/stop was exercised
  in these native plan gates.
- Final docs/site tests and docs build passed: 10 tests/64 assertions, 38 canonical
  pages, 39-page link/anchor check. Headless Chrome then passed 29 checks across 12
  routes with zero console/page/request errors; the content digest is recorded in
  the browser receipt (`target/docs-browser-check/receipt.json`).
  No deployment/publication occurred.
- Native coordinator startup now owns and terminates its spawned backend if connection
  setup throws, rejects pre-aborted startup before spawning, and handles abort during setup.
  A no-window real fake backend and isolated unit faults exercised those paths. Native stop
  caches disposal before calling either owner, aggregates synchronous disposer failures,
  and bounds graceful exit, forced exit and stdout-reader joins separately. Tests covered
  failed kill/stdin, stuck reader, a real headless child and one-shot close notification.
  An isolated integration test also ran the actual public native bridge through a real
  headless fake backend process: framed ready, render, activation event, close, scope
  disposal and backend exit passed. Separately, a relocated prior debug CLI ran the
  official native TypeScript starter with its real status provider; a trusted fixture hook
  intercepted native process spawn and redirected it to a headless Bun protocol fake. The
  ready/render/activation/render/close sequence, profile release and child exit passed
  (receipt (`target/native-headless-cli/ae46e581-28bd-40d7-b7dd-1710516cbf4a.json`)); it requires
  both `LOOP_TEST_CLI` and `LOOP_TEST_NATIVE_FAKE_CLI=1`; avoiding a window depends on the
  reviewed CLI honoring the inspected prepare hook and spawn interception. A separate
  relocated-CLI readiness race (receipt (`target/native-headless-cli/22ad044c-3da5-4daf-b1ff-27999ec9ed27.json`))
  observed both reservations while the aborted ready hook was held; after the hook finished,
  the CLI exited 130 with `E_CANCELLED`, recorded failure and released both. These
  fake-backend gates do not exercise the Rust native backend, Tao/Wry, or a Component guest.
  Isolated mocked-startup supervisor tests reproduced reservation release during startup
  and on marked incomplete cleanup. A second isolated test used the real supervisor and
  native adapter with headless fake backend processes: a held application or ready hook kept
  both locks through backend closure until scope disposal, while a throwing coordinator
  disposer left both locks reserved and recorded its failure. Synchronous ready-hook closure
  and held active-record publication were also fault-injected. Abort closes surface reads
  immediately but joins held setup and readiness before disposing host scopes; launch checks
  cancellation again after active-record publication before installing its stop timer.
  Noncooperative trusted setup or disposal can delay settlement; a deadline does not prove
  process or descendant termination. Current Tao/Wry UI was not rerun.
- Native evaluated-config run/stop passed outside checkout on prior CLI
  `322124fd16c2051a2c6a2dafa385168ae58c2015dc4846d30badf2c0e4753a71` with exact
  profile ownership; the subsequent CLI change only updated embedded evaluator code.
  Final native EOF and backend evidence are recorded above. No visible native desktop
  window was started by the lead after the CS2 request.

- Browser direct-engine conformance remains partial: public Polyengine 0.6.7 has no
  pre-lift aggregate byte budget; actual 2,097,665-byte hostile input/result values were
  decoded before post-lift policy checks. This is not fixed by worker deadlines or
  message bounds. The [same-byte headless verifier](tooling/host-kit-verification/same-byte-headless.ts)
  links prior browser CLI evidence to current Wasmtime artifact-enabled tests but executes
  trusted fixture code and does not verify native-window interaction. Full same-byte
  browser/native CLI execution, upstream budget API,
  release-install/bootstrap acceptance, real agent discovery and registry-only CLI
  compatibility remain open.
- At an earlier checkpoint, Station status matched the start snapshot and PID 46204
  owned port 43157; those are historical observations, not a current live-status claim.
  No Station edits/data/profile/process changes were made by these gates. Nothing was
  published, deployed or globally installed.
- Published registry CLI compatibility remains unresolved: published `loop-host 0.1.0`
  lacks `native_kit`, so an unmodified extracted CLI archive cannot resolve that
  registry dependency. A current source-lock-seeded extracted CLI+host compilation
  and exact inventory/currentness receipt are pending; previous compilation used a
  temporary root-only local patch with unchanged extracted manifests.


## Official kits narrowed to Rust desktop and browser, 2026-11-07

The latest user decision supersedes the November 4 required Electrobun exemplar:
only our Rust desktop host and browser host are official implementation/release
requirements. [Prompt 2](C:/Users/ijhar/Desktop/station/docs/explorations/loop-host-kits-dsh-prompts.md#prompt-2-implement-the-integrated-host-kit-system),
[HK1](specs/host-kits.md), active cards and website guidance now agree. Keep the
substantial end-to-end implementation bar; remove Electrobun from its critical
path, required worker split, official package graph and default config/CLI presets.

Electrobun can remain one small isolated compatibility example alongside other
language/runtime consumers. It cannot drive core abstractions, SDK/fork/patch
work, extra production services or an official support commitment; defer it if
complex without making the official mission partial. Keep unique desktop research
and historical examples labeled as optional evidence, not active instructions.
Station's existing application, packaging and updater remain untouched. This is
a prompt/spec/docs scope revision, not host-kit implementation or deployment.

## Integrated implementation mission and docs site, 2026-11-04

The revised [Prompt 2](C:/Users/ijhar/Desktop/station/docs/explorations/loop-host-kits-dsh-prompts.md#prompt-2-implement-the-integrated-host-kit-system)
requires the usable config→CLI→plugin→browser/native Component spine, a working
Electrobun provider exemplar, skill manager, packed/boundary checks and the docs
website. HK-01 is the first task, not the mission's finish line. The existing
[execution lane](docs/development-alpha/execution-plan.md#host-kit-implementation-lane)
(the historical prompt-2 cards have been retired) now states that bar;
no new roadmap or runtime implementation is introduced by this revision.

[Desktop source research](docs/reference/desktop-hosts.md) confirms Electrobun's
real Rust SDK and richer native services, but its pinned Rust runtime lacks Updater
API and typed TS RPC parity. Prefer reusable Rust/Wasmtime execution plus Wry
presentation first, and a Bun-owned Electrobun shell supervising the same provider.
Keep optional CEF/GPU/update claims profile-specific; no fork or nested framework
is a default requirement. Station's pinned packaging/security policy stays intact.

New canonical [current CLI usage](docs/cli.md), [planned system guide](docs/host-kits.md),
backend evidence and proposal routes are registered in the docs site/navigation/
search. Current and proposed commands remain separate. This revision updates only
Station's prompt document, Loop documentation and website sources/generated output;
production host-kit implementation is still the next run. Nothing is deployed.

Verification completed November 5: `bun test site` passed 7 tests/44 assertions;
`bun run docs:build` built 32 pages and checked links/anchors across 33 pages.
An isolated Chrome 156.0.8078.81 run exercised landing→CLI, current/proposal badges,
system TOC, keyboard search→desktop research, Escape/focus, theme/code copy and
390px mobile navigation/overflow, with no console/page/request errors. The first
browser attempt exposed a missing favicon and an overly exact test heading selector;
we added the static brand favicon and corrected the selector, then rebuilt/reran.
`bun run repo check` passed (5 packages/16 edges, no violations/exceptions), and
`git diff --check` passed. Local receipts/screenshots live under the generated
`target/host-kit-prompt2-review/`; they are not deployment or runtime-kit evidence.
Fingerprint checks cover all 330 Loop and 948 Station baseline paths: only the
intended documentation/site owners and Station's prompt changed; all Station
application/policy/packaging code remains untouched. No commit, install, fork,
publication or deployment occurred.

## Host-kit design and implementation handoff, 2026-11-03

[HK1](specs/host-kits.md) is the canonical proposed contract for typed CLI host kits,
trusted TS configuration, instance ownership, package/crate boundaries and bundled
skill delivery. [Two complete project/help proposals](specs/host-kits-examples.md)
and [source-backed audit/feasibility receipt](docs/development-alpha/host-kits-evidence.md)
accompany it. Four read-only configured-Codex audits reviewed actual dirty trees,
not HEAD-only worktrees. Shared contracts stayed with one integrating owner;
subsequent payload/probe writes have disjoint scopes.

This run changes design/docs/repo skill assets and isolated experiments only. It
does not implement a unified runtime/config CLI, install skills, publish, commit or
migrate Station. New integration candidates: browser/Bun and Electrobun/Bun;
existing Rust desktop releases and Station React/Electrobun behavior remain active.
The existing [alpha sequence](docs/development-alpha/execution-plan.md#host-kit-implementation-lane)
integrates the work. First safe implementation: HK-01, pure plan resolution inside existing host,
with no config execution or product-state change. Runtime G1/G2 remains independent
acceptance, even when a disposable feasibility probe succeeds.

Observed baseline: five repo-context commands and TS architecture check passed
(five packages, sixteen edges, zero violations/exceptions). Final probe, link,
catalog, skill-forward-test and preservation results belong to the linked receipt.
Station remains the owner of consumer acceptance and its engineering ledger; no
Station ledger/source/profile was modified by this design run.

## Proposed development alpha, 2026-10-30

[Specifications, execution gates and agent prompts](docs/development-alpha/README.md)
define the next candidate mission: one async document Component across native and
browser hosts, followed by foreground tooling, safe generation replacement and
bounded cloud/docs/Station adoption. This turn produced documentation only; no
runtime, daemon, identity service or managed cloud implementation is claimed.
The initial gate establishes reviewed baselines of the dirty checkouts before
parallel worktrees. Station's existing engineering plan remains the integrated
ledger; this repository records its own implementation evidence after each gate.

## Selected portable-development follow-up, 2026-10-28

User authorized an independently developed package proof and concrete contract/build
repairs. Loop owns the new workspace source/build/change contracts, WIT provenance,
official codegen/content mapper and explicit GitHub adapter. Station owns the
integrated living plan and concrete browser/compiler acceptance. See
[portable development](docs/portable-development.md) and Station's
`docs/independent-package-proof.md`. Existing dirty work and Rust release code remain
independent; this does not authorize a managed cloud service or publication.

Acceptance: immutable source/change identities and denial tests; actual TS7.1 WIT
type errors; independent package build/types/tests; identical compiled editor document
in Station and standalone; checked saves/reload; fresh Rust source-to-bytes-to-output;
full upstream packed consumers and Station typecheck/build/Component gates. Remote
GitHub submission and installed desktop acceptance are recorded as separate limits.

Completed local gate: package architecture and development automation foundation (2026-10-19). Station's `docs/engineering-plan.md` is the canonical integrated mission plan; this file records this repository's local evidence. Runtime, UI redesign and cloud milestones are outside this task.

## Completed source milestones

- Audited four public TypeScript manifests, root exports and source dependency graph; retained independent optional Rust host/CLI and experimental WASIP3 ownership.
- Added compiler-resolved policy, owner declarations, inward layer rules, type-only cycle detection, exact exception budget and intentional rejection fixtures.
- Added one repository CLI for graph/check/affected/verify/context/watch; consolidated the repeated root build sequence into dependency ordering.
- Standardized meaningful ui/scripting test scripts. Preserved Windows release/installer scripts because existing release workflows call them.
- Added frozen-lock CI installation and outside-workspace packed consumer verification.

## Verification gate

The integration task records final command results. Required: full TypeScript build/typecheck/tests; architecture fixtures; external tarball consumer; affected dependency fixture; linked Station consumption through generated dist/declarations and restoration; Station browser acceptance for any affected product UI. Rust code was not changed by this foundation slice, so existing Rust release workflows remain the native verification owner. Do not infer native acceptance from TypeScript checks.

## Remaining migrations and next slice

- Station integrating owner must confirm authoritative source resolution, optional local links, compatibility entrypoints and its policy exceptions separately.
- Existing public package modules mix contracts and implementation within cohesive single files. Introduce explicit role modules only when a real responsibility change warrants it; no directory shuffle is required now.
- Keep the no-exception Loop baseline. New temporary exceptions need an owner/reason and explicit budget review.
- The AST browser-global check is a conservative syntactic guard, not a security sandbox. Runtime grants remain Station policy and actual platform adapters remain separate.
- Follow-up only when explicitly selected: review package public TSDoc completeness and decide whether reusable domain/application extractions are proven portable. Do not start runtime/UI/cloud milestones automatically.

## Verified evidence, 2026-10-19

Frozen installation, four builds/typechecks, tooling typecheck, 20 package tests,
21 architecture fixtures and four external tarball imports/private-path denials
passed. Three source and three manifest edges, zero violations, zero cycles,
zero exceptions. Station independently proved optional root/nested links, a watched
upstream edit, emitted JS/types, public consumption, embedded guest resources,
production rejection and exact restoration. Coupling is unchanged; no existing
Loop source violation was found. Root build ordering is consolidated. Existing
PowerShell/Rust release scripts remain active; native runtime was not changed.

## Explicitly selected host follow-up, 2026-10-20

The user selected resource/lifecycle expansion after the package architecture gate.
Implementation is owned by `packages/host`; [LIFECYCLE.md](packages/host/LIFECYCLE.md)
is the semantic authority. `examples/lifecycle-monitor` is an independent packed
consumer with explicit injected ports. No host-to-ui/scripting/Station dependency
was added; native/Rust release ownership remains separate.

Full upstream verification passed: four package builds/typechecks, 46 host tests
(including 29 new ownership/lifecycle cases), the other three package tests,
21 architecture fixtures and an external four-package consumer/private-path gate.
Root tooling typecheck passed. Station's corresponding full gate passed 287 tests,
its production build/typechecks and six external packed consumers. The source
snapshot receipt records matching upstream/vendor bytes.

The monitor setup uses content-addressed tarballs and compares all installed dist
bytes with the current builds. Bun 1.3.14, Node 25.9.0 headless and the built-in
browser passed eight real timer readings, shared state, replacement, cancellation
and complete cleanup. Browser console warnings/errors were empty. These runs do
not establish installed-native, sandboxed scripting or other-browser acceptance.
