---
name: loop-host-kits
description: Design or implement Loop loop.config.ts composition, host kits/plugins, renderer adapters, and package or trust boundaries. Use for these Loop-specific changes, not generic React UI or unrelated host configuration.
---

# Loop host kits

Support the requested implementation or design slice. HK1 is the full contract;
source builds implement parts of it. Check current CLI help, public exports and
owner receipts rather than assuming all release gates passed. Skill use does not
permit migration, dependency installation, skill installation, publication or
replacement of a consumer's runtime.

## Locate the owners

Separate this skill's installed directory from the project and Loop source roots.
For an installed consumer, read the selected package's shipped README and public
root exports/declarations. Resolve those from that consumer's installed package;
use public imports, not private source subpaths.

For proposed behavior or source changes, locate the user's selected Loop checkout
and confirm it contains `ARCHITECTURE.md` and `specs/host-kits.md`. Resolve the
owner paths below from that checkout, **not from this skill's directory**. Read
its `AGENTS.md` and instructions for the owned paths. If no checkout is available,
ask for its location before relying on HK1 details; continue supported public-API
work from installed documentation where possible. Do not fetch or install a copy.

Read the matching routes before editing; combine routes when the change spans them:

| Change | Required owner material in the selected Loop checkout |
| --- | --- |
| `loop.config.ts`, target selection, config evaluation or CLI compatibility | `specs/host-kits.md` sections 2, 3 and 5; select acceptance from section 9. Read `specs/host-kits-examples.md` for proposed project/help examples. |
| Host kit/plugin factories, registration, bootstrap or stop/restart | `specs/host-kits.md` sections 3, 4 and 6; `packages/host/README.md` and `packages/host/LIFECYCLE.md` for implemented ownership APIs. |
| Renderer adapter, semantic elements, events or UI bindings | Read [renderer guidance](references/renderers.md); `packages/ui/README.md` and its public exports. For guest bindings also read `packages/scripting/README.md`. |
| Package/layer, cross-realm or trust boundary | `ARCHITECTURE.md` (Enforced package ownership); `specs/host-kits.md` sections 5 and 6. Read `packages/AGENTS.md` and the target package README for package edits. |
| Station adoption, placement, saved state or grants | Locate the selected Station checkout and read its instructions; read Loop's `specs/station-adoption.md`. Keep consumer policy and persistence there. |
| Skill catalog or optional management | `specs/host-kits.md` section 8; `docs/reference/skills.md` for source-built `loop skills` commands, explicit write intent and recovery limits. Release/client-discovery gates remain separate; skill use grants no installation authority. |

## Keep the portable seam

- Reuse existing host resources/leases, UI descriptors/controllers and workspace
  build/source contracts through public roots. Inspect the current API before
  proposing a new shared abstraction.
- Keep identity/version matching, lifetime and authorization separate. Scopes,
  registration keys, renderer metadata and `requiredAuthority` do not issue grants.
  Concrete trusted hosts authorize operations; guest bindings expose narrow ports.
- Keep portable contracts free of platform imports/globals. Composition injects
  providers and presentation adapters. React is optional; ordinary TypeScript
  consumers need neither a renderer nor a Component engine.
- Give each launch fresh mutable ownership. Register cleanup during acquisition,
  await disposal and test partial-start failure. Cooperative cancellation cannot
  roll back a committed effect or guarantee termination of same-process code.
- Treat executable config and host plugins as trusted same-user code. Static
  inspection must not import config. Require explicit local trust before evaluation;
  installed packages or worker/transport boundaries do not establish isolation.

## Deliver a bounded slice

Name the observable result, owned files and unresolved boundary first. Distinguish
implemented public APIs from proposed HK1 signatures/commands in code examples and
reports. Preserve legacy formats and behavior unless the user authorizes a change.

Choose checks from the owning contract for the actual change. In a Loop checkout,
use `bun run repo context <package>`, `bun run repo check` and focused
`bun run repo verify <package>` as applicable; source checks do not prove browser,
Component, native, installed-client discovery or release execution. Report changed
paths, contract effects, checks run, evidence gaps and the next bounded test.
