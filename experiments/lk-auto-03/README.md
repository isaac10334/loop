# LK-AUTO-03 — DSH automation feasibility

Verified locally on Windows, November 18, 2026. Reader: the Loop/Station integrator deciding how a standalone TypeScript process should drive DSH. This is an isolated spike, not a Loop capability or orchestration framework.

## Recommendation

**Use the SDK stdio surface, one runtime owner per task/session.** It successfully authenticated to Codex, created persistent sessions, restored history in a new process, recovered an interrupted turn, rejected an approval, and exited cleanly. Persist `{ sessionId, home, cwd, provider, model }`; also pin runtime/plugin versions and launch patches. Never treat a session ID alone as portable state.

For this installed Desktop distribution, [probe.ts](probe.ts) is a dependency-free, executable TypeScript proof using the documented JSON-RPC wire and the existing Electron CLI entry. It is deliberately a bounded experiment, not a client library to grow. It uses `gpt-6-luna`, low effort, and a 512-token per-request output cap. Subscription allowance is not free usage; requests still include the profile's several-thousand-token context.

For a maintained application, prefer the official `@deepseek-ai/dsh-sdk-client` high-level `DeepSeekHarness` API with a **matching-version npm DSH runtime**, once adding those dependencies is approved. The client was not installed or executed here; its API recommendation is source-verified, while the installed SDK server/wire was live-tested. The current client launches `process.execPath` with a JavaScript DSH entry: **do not pass the Desktop `.cmd` shim or Electron `.exe` as `dshBin`**. Packaged Desktop runtime discovery is not provided by that client. Do not turn the probe's installation-specific path into a public integration contract.

Headless is syntactically the simplest interface (`--json`, `--session-id`), but **the tested Codex headless composition returned a successful final answer and then remained alive until the 90-second deadline killed it**. That is a failed lifecycle check, not an end-to-end pass. Its root cause remains unresolved. Prefer the SDK path on this installation; retain a deadline and verify actual exit regardless of surface.

## Installed inventory and authentication

- `dsh --version`: **0.2.2-rc.1**; installed Desktop CLI shim resolves the packaged Electron/ASAR runtime. System Node **24.14.1**, Bun **1.3.14**; packaged Electron Node **24.21.0**.
- Existing user profiles: Desktop and Web. Probing the shipped SDK/headless profiles materialized their default profile directories. Profiles are ordered bundle compositions plus user and per-launch patches, not necessarily identical tool/auth deployments.
- Desktop dependencies: Codex **0.6.5**, agents-notch **0.1.9**, better-sidebar **0.30.1**, dsh-plugin **2.3.4**, whale-widget **0.4.2**, and a linked prompt-lab plugin. These are installed dependencies, not a claim that every plugin was exercised.
- Web declares Codex **0.6.3**, agents-notch `^0.1.9`, and dsh-plugin `^2.3.4`. The current CLI **skips Web's Codex 0.6.3 as incompatible**, with no exact-version exemption active. No exemption was granted. Desktop's installed Codex 0.6.5 explicitly supports DSH 0.2.2-rc.1.
- Desktop's configured generic pi-ai provider dictionary is empty; its selected/allowed models use the separate Codex provider. No additional configured provider was inferred from the catalog.

| Route/composition | Live result |
| --- | --- |
| Current GUI Codex status | Signed in; valid expiry reported. No token values read or printed. |
| Stock SDK, `openai-codex` | Initialization rejected: no registered adapter (`-32603`). Having a GUI login does not load the plugin in SDK. |
| SDK + compatible Desktop Codex plugin launch overlay | Real Luna generation, restore, and continuation passed using the existing managed sign-in. Explicit final shutdown verification: process exit **0**, no signal. |
| Stock SDK, `deepseek-official` | Initialization passed, inference ended `MISSING_CREDENTIAL`. Handshake is not authentication/inference proof. |
| Stock headless, default DeepSeek route | `MISSING_CREDENTIAL`, terminal error event and exit **1**. |
| Headless + Codex plugin only | Plugin pending on absent `credentials` service; turn ended `NO_ADAPTER`, exit **1**. |
| Headless + Codex plugin + explicit stored-auth opt-in | Real generation returned `ACK` and completed final reason; process failed to exit within 90 seconds and was killed. |

Stock headless disables managed credentials, authorization, and account consumers. Its key lookup is launch environment → invocation-directory `.env` → DSH-home `.env`; GUI-saved sign-ins/keys are ignored. SDK/ACP retain managed credentials by default: saved store → launch environment → invocation `.env` → home `.env`. An empty exported variable shadows the fallback. Codex's third-party plugin uses its own managed credential reference; the built-in pi-ai OAuth record is a different credential location. Do not assume they are interchangeable.

[codex.patch.yml](codex.patch.yml) reuses the already-installed compatible Desktop plugin by absolute path for this launch only. [stored-auth.patch.yml](stored-auth.patch.yml) explicitly re-enables stored auth for headless. No tokens were copied, no provider configuration or package manifest was changed, and no plugin was installed. The Codex probe used the plugin's default host network mode; it did not independently test forced SSE, forced WebSocket, system proxy, token expiry/refresh, or every advertised model.

## Executable checks

Run from the repository root with Node 24. These commands make small real Codex requests unless marked local-only. Run sequentially; do not drive the same ID from multiple owners.

```powershell
node experiments/lk-auto-03/probe.ts create
# First process fully stops. Identity/home/workspace are saved on disk.
node experiments/lk-auto-03/probe.ts resume

node experiments/lk-auto-03/probe.ts prepare-crash
node experiments/lk-auto-03/probe.ts crash
node experiments/lk-auto-03/probe.ts recover

$env:PROBE_EXTRA_PATCH = 'approval.patch.yml'
node experiments/lk-auto-03/probe.ts approval
Remove-Item Env:PROBE_EXTRA_PATCH

# Local HTTP faults only; no real model endpoint or credential:
node experiments/lk-auto-03/failure-probe.ts
```

Results:

- **Create/stop/restore/continue passed.** Session `session-lk-auto-03-1ad0ea9c-c842-4916-b3ad-a0eab86ebf9c` returned `ACK`, then a separately launched client restored it and returned the earlier marker `LK-AUTO-03-PERSIST-7Q9`. A later explicit exit check also returned process exit 0.
- **Established-session crash recovery passed.** Session `session-lk-auto-03-56310f3e-91bf-4d9c-8571-7fcc36e7535a` was prepared and shut down, resumed, and its runtime killed during the next turn. A fresh client restored and continued it with the marker intact. Its decoded persisted log contains turn 2 ending `interrupted` followed by turn 3 ending `completed`.
- **Earliest crash boundary failed restoration, as a useful limitation.** Killing a newly created runtime immediately at its first `turn/start` notification left no materialized session; resume returned “not found.” The final crash probe instead uses an already persisted baseline and a 250 ms interruption delay. Neither a notification nor a local manifest write establishes server fsync. The raw `session/prompt` implementation queues input and returns a message ID; do not treat that response alone as durable-result confirmation.
- **Missing ID fails closed.** Explicit `session/resume` of an unknown ID returned JSON-RPC `-32603`; it did not create a replacement.
- **Approval rejection passed.** A harmless `plugin_manager list_plugins` request reached the SDK host's `approval/request`. The host returned `rejected`; the tool reported denial and did not list or mutate plugins. The agent then completed normally. Agent completion therefore does not imply a requested privileged action was performed.
- **Quota/rate separation passed with local synthetic HTTP 429s.** `insufficient_quota` became terminal **QUOTA**, one HTTP request, headless exit 1. `rate_limit_exceeded` became **RATE_LIMIT**, two HTTP requests with the explicitly configured one-retry budget, headless exit 1. The persisted raw log contains `llm/retry` and `llm/retry-started`. This is integration-level fault injection, not proof of a real account-exhaustion response or Codex-specific quota wording.
- All three TypeScript files passed `node --check` and Bun's Node-target transpilation; local README links and repository `git diff --check` passed. These are syntax/build checks, not static type checking. Full repository builds/tests and a published SDK-client consumer were not run; no Loop package changed.

[probe.ts](probe.ts) writes machine-local state and wire transcripts to the ignored `local-results/` directory. [failure-probe.ts](failure-probe.ts) also writes its localhost patches and plain mock-session logs there. Live sessions remain under this user's DSH session storage; no existing sessions were deleted or resumed. The experiment is reversible by removing only its own artifacts and identified session directories after all its processes stop. Do not delete or edit the shared credential store, profile settings, or unrelated sessions. Transcripts can contain prompts/tool output and should remain private.

[headless-poc.ts](headless-poc.ts) records the simpler headless approach and validates both exit status and `final.reason.kind`. Its first Codex run failed the exit deadline as described above; headless continuation was not claimed as verified.

## Surface comparison

| Surface | Fit and limits |
| --- | --- |
| TypeScript SDK client / SDK wire | `session()`/first prompt creates agents; `run()` observes activity; `resumeSession(savedId)` performs persisted restore. `session(id)` alone is only a lazy handle, not restore. Wire equivalents are initialize, prompt/query, resume, wait, working-directory get/set, and shutdown. Session events expose retry and terminal details. No wire cancel or per-session close: closing the runtime stops all its owned work. |
| Headless | One task/process; opening `session` event identifies it; `--session-id` adopts persisted history from the same cwd with ownership/preset checks. NDJSON is a bounded projection, not the full log. Text is committed-step output, not token streaming. Requires process exit 0 **and** completed terminal reason. No live approval-response channel. Tested Codex shutdown caveat applies. |
| ACP | Standard multi-session stdio API: new/list/resume/close, prompt/cancel, model/effort configuration, semantic updates, permission requests. Better when independent session cancellation/close or interoperability is required. No transcript replay, session/load, deletion/fork API, extra directories, or DSH-specific UI surfaces. `authenticate` success is not model-provider authentication. Source-inspected, **not live-tested here**. |
| In-process plugins/core | Powerful trusted composition, not the simplest standalone consumer API. Avoid coupling an initial integration to core Context/plugin internals. |

The official client returns `RunResult` with session ID, final response, finish reason, events and notifications. Observe before submitting; scope events by session/tree. Lower-level `prompt()` is an enqueue operation; `session/wait` waits for root/managed-descendant quiescence, not business success. In-turn model failure may resolve a wait while reporting an error in `turn/end`; the stock SDK missing-key probe demonstrated this. Check the terminal outcome as well as transport/RPC success.

## Failure, approvals and ownership policy

- The SDK client distinguishes `JsonRpcResponseError` (code/data), `RequestTimeoutError`, `SdkProtocolError`, and `TransportClosedError` (exit/stderr context). Model failures remain terminal events/finish reasons rather than necessarily rejected RPCs.
- Installed retry default is **normal**, five retries for `EMPTY_RESPONSE`, `RATE_LIMIT`, `SERVER`, `TIMEOUT`, and `TRANSPORT`, with bounded backoff. `QUOTA` and auth failures are not normally retryable. Valid bounded Retry-After can replace backoff. **Never enable always mode for an unattended first integration**: it can retry permanent auth/quota errors indefinitely, consuming allowance.
- On quota/auth: stop and report a recoverable task state for operator action. On exhausted transient retries: preserve the ID/events, close and await process exit, then decide whether continuation is safe. No automatic model fallback was implemented or tested; change route only under explicit application policy.
- On timeout or lost transport: work may already have run. Do not blindly replay input or claim rollback. Restore history, reconcile side effects, and send a deliberate continuation. There is no exactly-once transaction across arbitrary tools and the caller's state store. Use one active owner per session and prevent overlapping process restarts yourself.
- `approvalRequests: true` plus a live request handler is required for SDK-host approvals; only `allowed-once` grants an operation. Unknown/malformed/cancelled/disconnected requests fail closed. Questions have a separate callback/capability and are not approval grants. Pending question/approval handles do not survive process restart.
- Select permission presets explicitly. Headless unattended execution should use `--approval-policy never`, not silently grant full access. Restores can preserve old permissions; choose/persist an intended preset before resumed execution. The SDK probe used the stock SDK policy and rejected every incoming approval.
- `shutdown`/EOF and SDK client `close()` dispose owned agents and flush storage; the client bounds teardown and escalates signals. A crashing parent can leave a subprocess alive: a production owner still needs OS/process ownership and a restart fence. This spike killed only its own runtime and awaited its exit; it did not simulate a whole-machine failure or external tool-process recovery.
- Persistence retains the committed prefix and repairs interrupted turns. Complete corrupt frames fail rather than silently resetting history; partial tails are recoverable by the backend. Shells, browsers, jobs, live callbacks and external processes are not restored by session resume. Torn-write/corruption behavior was source-inspected, not fault-injected here.

## Built-in scheduling

DSH scheduling persists instructions and target identity; it is **not a daemon/service manager**. A host with the right storage/composition must be running. Targets are existing session, one reused new session, or fresh session per occurrence. After downtime only the latest missed occurrence is delivered; receipts confirm inbox delivery, not task success, and crash recovery can duplicate delivery. Schedule ownership is host-wide, so multiple independent hosts sharing a scheduling store need deliberate ownership rather than an assumption of exactly-once delivery.

SDK compositions include scheduling, but the SDK wire has no dedicated schedule-management methods; activation/creation depends on the composed providers. One-shot headless is not a persistent scheduler. This probe disabled schedule rows in its Codex overlay to avoid touching unrelated automations. **No scheduled task was created or changed.** Process startup/restart should remain the application's/OS supervisor's responsibility; implementing that supervisor is deferred.

## Next bounded integration step

1. Approve a pinned official SDK-client/runtime dependency pair and provision a dedicated automation home/profile with compatible Codex support and its own tested sign-in. Do not copy tokens or assume an isolated home inherits GUI auth.
2. Replace the probe wire plumbing with `DeepSeekHarness`, persist the small session/launch record, attach event and deny-by-default approval handlers, and close the owned runtime in `finally`.
3. Add only process ownership, a restart fence, terminal-error classification, and explicit side-effect reconciliation. Prefer ACP instead if independent per-session cancellation is a hard requirement. Do not add a scheduler or orchestration framework yet.
4. Before choosing headless on this installed Codex stack, reproduce and resolve the successful-final/non-exiting-process result. Before claiming other model routes, expired-token refresh, forced transport variants, or real quota recovery, run their own bounded checks.

## Sources

Primary evidence was the installed 0.2.2-rc.1 package documentation/compiled server and persistence code, existing profile manifests/patches, compatible Codex 0.6.5 code, and the runs above. Upstream `master` is supplementary, not a version pin:

- [TypeScript SDK client](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/sdk/client), [client launch implementation](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/client/src/launch.ts)
- [SDK protocol](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/sdk/protocol), [SDK application](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/sdk-app)
- [Headless](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/bundle/headless)
- [ACP](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/acp)
