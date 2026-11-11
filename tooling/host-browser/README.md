# Browser runtime receipts

Run `bun tooling/host-browser/acceptance.ts` after building the current lead-owned
`contracts/document-tool` guests. It bundles public package roots, translates via
the public `@polyengine/translator` API, hashes Component/plan/adapters/output,
relocates the static output, and launches an isolated actual Chrome context through
Node Playwright. No Station import, private SDK asset resolver or install is used.
`PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` may select existing installations.

The printed output directory contains the receipt, build inventory and screenshot.
`runtimeAcceptancePassed` covers two origins/stop-A-leaves-B, pointer/keyboard/focus,
semantic validation and teardown, genuine async document/CAS/grant races, changed
source bytes/output, runaway worker termination, and actual rendered Component
interaction. Resource/listener/read/worker counters are checked after real joins.
These fixture plans are synthetic: they do **not** prove CLI config evaluation.

The separate test-only worker runs the hostile lifecycle and budget worlds through
the actual public engine. It does not widen the shipped application profile.
Retained-borrow reconstruction must trap before host reads; actual guest-owned drop
must call the host destructor once while a sibling remains usable. The receipt's
`fullComponentConformance` is a separate gate and is currently **false**:
Polyengine 0.6.7 canonical lifting decodes oversized UTF-8 before facade checks.
The raw-engine probe observes encoded lengths at `TextDecoder.prototype.decode`
without changing outcomes. UTF-16/transcode and Latin1 paths also prevent a safe
TextDecoder-only enforcement workaround. Registry `latest` remains
[0.6.7](https://registry.npmjs.org/@polyengine%2Fruntime/latest). No global builtins
workaround, engine patch, private API or falsely named pre-decode check is shipped.
The production worker does bound decoded output **before** cloning to the app.

For actual evaluated config/installed tarballs, use:

```sh
node tooling/host-browser/cli-chrome.mjs <fresh-relocated-loop.exe> <prepared-project-root> [components]
```

This verifies real pinned plans, relocated static build interaction, two owned CLI
launches, browser readiness, pointer/keyboard, stop acknowledgements, independent
B, fresh restart epoch/state and process exit. It fails on browser/console errors.
Only generated temporary projects may be supplied. The verifier prepares and
installs content-addressed public tarballs; this script does not install anything.
`prepare-component-app.ts <prepared-HK09-browser-components-root>` materializes a
current reviewed inline artifact and ordinary trusted application which receives
its already-composed host/scope/surface and a public worker URL. It modifies only
that explicitly generated test project's app/config/source inventory, never a repo
manifest, package lock or shared contract.
