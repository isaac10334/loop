# Station adoption

Status: proposed, October 30, 2026. No runtime extraction or migration is
implemented by this spec. Outcome: Station uses portable authored definitions and
shared placement/property mechanisms without losing saved work or authority.

## Preconditions and scope

Start from Station's [core review](C:/Users/ijhar/Desktop/station/docs/core-systems-review.md)
and [architecture](C:/Users/ijhar/Desktop/station/docs/architecture.md).
Use [the async document runtime](async-document-runtime.md) when a slice needs
Component document access; this spec does not expand its execution profile.
Assign exact files after package context and an inventory of real consumers.
Review saved IDs, defaults, grants, shortcuts and source formats before migration.
Keep source, definition, saved instance, running session and grant distinct.

Loop owns portable contracts and reusable mechanisms. Station owns workspace
storage, desks/defaults, permission decisions, installation and product adapters.
Public descriptors carry data; trusted controllers own callbacks and authority.
Read existing public UI/host/property contracts before proposing another registry.

## Gate A: adopt one authored widget

Finish one existing widget whose behavior fits current authored primitives.
The November 3 dirty-source audit found Action Button already routes through
`AuthoredSurfaceView` and a built-in authored definition; do not repeat that
conversion or create a parallel widget. Its session-owned revision/sequence,
cancellation and independent packed-consumer acceptance remain unproved. Use the
[HK1 adapter slice](host-kits.md#9-acceptance-and-integration-gates) and
[current behavior inventory](../docs/development-alpha/host-kits-evidence.md#station-parity-inventory-static-audit-not-a-fresh-pass).
Action Button remains the recommended first candidate; inventory its actual
commands, settings, placements and accessibility before selecting files.
Express its reusable definition as source/configuration with explicit bindings;
retain the existing instance and placement rather than creating a parallel widget.
Host adapters may supply native behavior through existing checked operations.

Acceptance requires a real saved definition, edit/Apply/reload and instance reuse.
Exercise keyboard activation, accessible name/focus, moving between supported
slots and two instances with independent configuration. Check denial, revocation,
invalid draft retention and missing-definition recovery through the same path.
Show that the replacement consumes the shared primitive rather than hiding the
old specialized implementation behind a second descriptor.

Keep the previous definition/activation recoverable during rollout. A failed
Apply leaves the last working activation and draft source available. Recovery
must preserve instance IDs, placements and reviewed bindings without new grants.

## Gate B: portable dock and property mechanisms

Extract only mechanisms demonstrated by Station and an independent Loop consumer.
The second consumer must import public packed packages without Station imports.
Candidate placement contracts describe instance identity, slot ownership,
validated moves and reducer outcomes. Station maps its saved document into them
and retains desktop rules, protected tools, desk selection and product defaults.
One authoritative placement graph owns each instance; moving it preserves state.

Candidate property contracts describe typed values, compatible references,
editor selection and draft/commit outcomes. Reference resolution and commits
use injected ports; Station validates resource visibility, rights and revisions.
An asset reference carries stable identity, not a hierarchy path or a grant.
Binding evaluation is a separate contract when a real consumer requires it.

Both consumers must exercise the same move/property operations, including invalid
targets/types, cancellation, stale revisions, reference disappearance and disposal.
Station acceptance additionally covers reload, undo, existing layout adaptation,
retained widget state and permission denial. Use actual rendered interactions for
UI claims; contract tests alone establish only contract behavior.
Reject an extraction that needs Station's permission/store imports or duplicates
its live graph. Roll back the adapter/package selection with saved documents and
source intact; any persisted format migration needs a versioned recovery route.

## Gate C: specify behavior before deleting compatibility

Clock, Weather and Snake are hidden from new creation but still have renderers,
recognized widget IDs and saved-layout consumers. Snake also has per-workspace
high scores under `unit-workspace.snake.<workspace-id>`.
Choose whether old instances retain a compatibility renderer, become optional
package instances or become explicit recovery placeholders. Decide whether and
how high scores transfer. An unrecognized or silently replaced instance fails.

Legacy scripts without `program.json` still use the `main.js` calculation editor
and evaluator. Choose continued compatibility or explicit source-preserving
conversion to a program. Define changed execution semantics and review bindings
before conversion; saving source alone must not install or start a program.

Before removal, fixtures must prove opening, editing, exporting and recovering
old documents/layouts, unresolved definitions and invalid source. Preserve raw
source, saved identities and existing grants; migration cannot manufacture new
authority. A failed conversion leaves the original readable and exportable.
Delete renderers/evaluators only after the selected replacement handles their
real callers and these acceptance cases. Product choices remain in
[QUESTIONS.md](../QUESTIONS.md), not implied by a cleanup task.

## Already retired: evidence, not a new removal gate

The October 30 audit removed five isolated initial compatibility drivers:
`probe-p3-scripting.ts`, `probe-rquickjs-scripting.ts`,
`probe-rquickjs-browser.ts`, `rquickjs-runtime-probe.ts` and
`serve-rquickjs-probe.ts` from Station's `apps/station/scripts`.
Their dated compiler/hash findings and replacement boundary are retained in
[Station's foundation history](C:/Users/ijhar/Desktop/station/docs/programmable-workspace-foundation.md#investigation-retirement).
Production preparation, lifecycle drivers/fixtures/tests and semantic DOM proof
remain active. Their deletion is not authorized by this spec.
