# Product boundary for the public developer experience

Working inventory, 2026-11-11. This is contributor material, not a public page or a replacement for historical receipts. The publication catalog is `site/content.ts`; only its entries become pages, search records, Markdown exports and llms.txt routes.

## What exists

| Boundary | Implementation and evidence | Distribution distinction |
| --- | --- | --- |
| Portable TS contracts/runtime | Nine packages; public root exports and enforced dependency policy in `tooling/architecture-policy.json`. Scopes, leases, semantic frames/events, explicit bindings and cleanup are implemented and unit/packed-consumer tested. | Reviewed local packs are the development route. All nine npm endpoints returned 404 on 2026-11-11; that proves neither future availability nor scope ownership. |
| Browser kit | Official trusted-TS composition, DOM renderer and dedicated-worker Component adapter. Existing CLI/browser acceptance covers independent instances, input, replacement and shutdown. | Source/prepared artifacts, not evidence that the latest public CLI includes these commands. |
| Native kit | Rust owns Wasmtime and Tao/Wry; TS package owns typed composition/checked bridge. Initial presentation is Windows-only, restricted semantic subset. Historical real-window receipts exist. | Headless protocol fakes do not prove native UI. No visible native activity in this mission without consent. |
| Component document profile | WIT under `contracts/document-tool`; browser Polyengine and native Wasmtime implementations. Explicit document grants and CAS semantics. | Experimental: browser lacks canonical ABI pre-lift allocation budgets. Chrome/Edge evidence is not Firefox/Safari/WebView parity. |
| Legacy CLI | Rust/TS Component templates, `loop.toml`, build/run/doctor and Windows installer. | GitHub latest v0.1.0 and crates.io loop-host 0.1.0 are older products. Current CLI archive cannot compile against published host 0.1.0's missing native-kit API. Local patches are not registry proof. |
| Future work | Wizard Tower, cloud/marketplace, universal host parity and additional renderers. | Proposals, not installation promises. |

## Ownership decisions

Retain existing package/crate boundaries. No concrete dependency problem warrants a repository-wide split. `capabilities`, `ui` and `workspace` hold portable descriptions; `host` owns TS lifecycle/config contracts; `scripting` owns injected authored-execution APIs. Browser/native kits own composition, renderer-dom owns DOM presentation, component-polyengine owns worker adaptation. Rust loop-host owns Wasmtime/native resources; loop-cli owns orchestration, embedded templates and distribution. Rust crates do not mirror npm packages.

Use WIT where a guest/host language boundary needs nominal imports, exports and owned/borrowed resources: legacy application and async document-tool worlds. Ordinary TS factories, config callbacks, DOM registration, workspace tooling and SDK conveniences remain language-specific APIs. A matching TypeScript type alone does not prove WIT ABI compatibility.

Contributors use workspaces or explicit temporary links to built public roots. External examples use reviewed hashed packs and explicit transitive overrides until publication. Published npm packages must resolve semver dependencies from npm; CLI release artifacts must bundle their own worker/assets and generated Rust hosts must resolve the reviewed host crate. Neither a workspace path nor a tarball override closes that gate. See `RELEASING.md` for coordinated release order and account setup.

## Content classification

- Public: curated application guides under `docs/public/`, selected concise package references.
- Contributor: architecture, releasing, package development, repository instructions and writing checks.
- Internal: engineering ledgers, development-alpha plans/prompts, design proposals and agent task procedures.

Preserve the latter two in place. Do not publish them by recursively discovering Markdown. New public pages require an explicit catalog entry and public-audience review.

## Verification and stop condition

Completed 2026-11-11:

- 21 catalog pages; 55 allowlisted publication artifacts in `target/site`; local HTML/fragment and machine-export link checks. Pages uploads only that generated directory, not site sources or internal Markdown.
- Real headless Chrome: 47 assertions across navigation, search, Markdown alternatives, mobile layout/overflow, keyboard focus/theme and live official-kit input/state/disposal/restart. Receipt: `target/docs-browser-check/1794382738668/receipt.json`.
- Current source CLI 0.1.1 SHA-256 `7d104aa099edc583cc4950e757309a74060caa7938d7572f979e76d591291ae3`: fresh outside-checkout five-pack consumer passed evaluated config, relocated static output, pointer/Enter/Space, invalid input and shutdown. Its prepared app matches the final canonical source. Bun/Node packed consumers and all nine npm dry runs passed release preparation; the dirty plan remains non-publishable.
- Legacy Rust starter passed fresh offline headless count/timer/read/write-denial and explicit writable operations, repeated with the current CLI. No native window or new native-kit UI verification was performed.
- Locked all-features Rust workspace: 20 CLI tests, 28 host tests plus one doctest; artifact directory explicitly enabled. Formatting and clippy passed. Package boundary check reports zero TS/Rust violations. Site/example/release focused tests and noEmit tooling/site typechecks passed.
- Independent bounded public-clarity, API/dependency and release-readiness reviews completed. Their concrete audience/catalog issues were corrected. Live registry identities and GitHub environment protections were not exercised.

Host/CLI source versions are coordinated at 0.1.1; WIT/profile/npm identities stay unchanged. Published `loop-host 0.1.0` is still incompatible with the current CLI. Host crate packaging/dry run passed; registry-only CLI packaging correctly rejects the unpublished exact host 0.1.1 dependency. No local patch counts as registry proof.

Stop here: no publication, tags, deployment, registry/settings changes, external task capture, new renderer, cloud registry or Wizard Tower engine work.

## Ranked follow-ups

1. **Distribution:** maintainer confirms npm scope/crate ownership, configures protected `npm`/`crates` trusted publishers, reviews versions/artifacts, and explicitly publishes host before registry-only CLI checks and the Windows release. See `RELEASING.md` and `.github/README.md`.
2. **Native acceptance:** with human consent, rerun real Tao/Wry input/close/independent-instance behavior on the final release candidate. Headless tests do not close this gap.
3. **Guest budgeting:** establish a public browser pre-lift allocation limit before claiming hostile canonical-budget parity. Do not expand into a general runtime campaign in this task.
4. **Wizard Tower specification:** define a small application session/start-pause/status/input-focus shell with replaceable state operations and finite cleanup acceptance. Voxel rendering/ECS/multiplayer/GPU work remains excluded.

