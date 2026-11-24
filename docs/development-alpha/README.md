# Loop development alpha

Proposed implementation sequence, October 30, 2026. These documents specify work;
they do not establish that a generic Component runtime or cloud service exists.
Mission: `LOOP-DEVELOPMENT-ALPHA-2026-10-30`.

**Build one independently authored document tool that can change itself without
losing its editor.** Compile it to a WASM Component, grant one document, run the
same bytes in browser and native hosts, and replace a successful generation while
preserving the editor and unsaved source. Station then adopts the same tool.

## First action

Open DeepSeek Harness with `C:/src/ilt/loop` as its workspace. First review the
dirty baseline and prove the async toolchain; freeze the document contract before
delegating adapters. Follow [the gates](execution-plan.md).

## Read by responsibility

| Work | Owner document |
| --- | --- |
| Contracts, handles, authority and execution profiles | [Runtime reference](../reference/runtime.md) |
| Typed CLI host kits, trusted config and optional skills | [Host-kit contract](../../specs/host-kits.md), [proposed projects/help](../../specs/host-kits-examples.md), [audit evidence](host-kits-evidence.md) |
| Async resource and browser/native acceptance | [Core runtime spec](../../specs/async-document-runtime.md) |
| Local workspace, foreground CLI and replacement | [Development spec](../../specs/foreground-development.md) |
| Accounts, Git authority and distribution | [Identity reference](../reference/identity-and-distribution.md) |
| Private cloud job and artifact publication | [Cloud build spec](../../specs/cloud-build.md) |
| Machine roots, asset references and relations | [Access/reference spec](../../specs/machine-access-and-references.md) |
| Reversible consumer UI/runtime adoption | [current behavior audit](host-kits-evidence.md#station-parity-inventory-static-audit-not-a-fresh-pass) |
| Agent roles, task inbox and questions | [Agent workflow](../reference/agent-workflow.md), root `QUESTIONS.md` |

Loop owns portable mechanisms and public contracts. Station owns product behavior,
desks, saved workspace state, defaults and concrete policy. Portable widget,
placement and property mechanisms can move after a real second consumer proves
their contracts; package extraction is not permission to move product state.
Cloud is an optional provider. Local development requires no account.

## Reuse the working evidence

- [Independent development](../portable-development.md): snapshots, checked
  changes, WIT tooling and the independently developed web editor.
- [Windows proof](../windows-desktop-proof.md): a scoped native application with
  actual Rust Component execution, denial and relocation evidence.
- [WIT editor example](../../examples/wit-editor/README.md): real TypeScript
  compiler integration; editor GUI acceptance remains separate.
- [Host lifecycle](../../packages/host/LIFECYCLE.md): scopes, leases and cleanup;
  these do not make ordinary JS a sandbox.

Station's `docs/independent-package-proof.md` owns its consumer receipts. Its
`docs/engineering-plan.md` records its consumer changes; Loop's
`ENGINEERING_PLAN.md` owns Loop's gate and results. Preserve earlier integrated
gate records as dated evidence. Avoid another status database. The native
starter is not yet a generic Component adapter, and the SVG web editor is not a
WASM editor. Re-run affected evidence after implementation changes.
