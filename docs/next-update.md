# Proposed next update: an interactive application foundation

Status: proposal. This document does not describe implemented features.

## Outcome

Build `examples/workbench`: a small project editor with an item tree, editable
properties, selection, keyboard commands, undo/redo, and save/reopen. Use it to
prove the shared foundation for Wand, Skraps, and Station before adding their
domain-specific systems.

An application author should be able to replace the example's objects with
tracks, documents, or game entities without changing the Loop host.

## Why this comes next

The current guest already owns its state, but the shared WIT contract contains
counter-specific actions and a `count` field. The renderer replaces every DOM
node on each response and disables every button while dispatch runs. Adding
more widgets alone would leave text editing and concurrent work on those same
constraints.

## 1. General application and interaction contracts

- Introduce a versioned application world without example-specific fields or
  actions. Define initialization, event delivery, and view production explicitly.
- Give UI nodes stable identities. Define typed events for activation, editing,
  selection, keyboard input, and pointer interaction, including target identity.
- Specify event ordering, stale-target handling, and view revisions. A removed
  control must not receive an event intended for an earlier instance.
- Keep application commands inside the application. When a domain exposes
  commands across component boundaries, that domain owns their typed contract.
- Provide a small Rust guest API and UI builders over the WIT bindings. Keep
  platform and renderer types out of the application API.

Do not replace the fixed counter enum with an unrestricted host `invoke(name,
json)` interface. Keep capability calls typed and authorized.

## 2. State, edits, and effects

Separate document state, transient interaction state, and background work.
Selection and an unfinished text edit should not require rewriting the document
or adding an undo entry on every keystroke.

Use application commands for meaningful edits. Group continuous editing into
transactions so one drag or property edit can become one undo operation. Define
versioned document snapshots and migrations; leave the document schema with the
application or domain kit.

Run background work with task identities, completion/error events, cancellation,
and clear ownership. Keep input responsive while an import or other operation
runs. Closing an application must release its work and prevent late results
from reaching a replacement instance. Continue checking grants at capability use.

This establishes boundaries useful for collaboration. It does not choose a
universal CRDT or treat raw UI events as the replication protocol.

## 3. A usable semantic UI

Start with the controls needed by the workbench: text, buttons, text and numeric
inputs, toggles, a selectable tree/list, scrolling, and resizable split regions.
Add explicit sizing constraints and a small theme vocabulary.

Reconcile the rendered UI by stable identity. Preserve focus, text selection,
IME composition, and scroll positions through unrelated updates. Use the
renderer platform's text-editing and accessibility facilities where possible.
Define keyboard navigation, shortcuts, focus ownership, and pointer capture.

Keep full validated view snapshots initially if they suffice. The renderer can
reconcile snapshots without introducing a complex patch protocol immediately.

## 4. Scoped document storage

Add the smallest storage capability needed to save and reopen the workbench.
Grant access to a selected project/document scope rather than unrestricted
filesystem paths. Specify atomic replacement, failure behavior, and resource
lifetime. Test denied writes and interrupted saves as well as success.

Keep storage, document schemas, and history separate: a storage provider should
not need to understand game worlds or DAW tracks.

## Acceptance checks

- Create, select, rename, reorder, and edit workbench items without host changes.
- Type in a field while another operation completes without losing the caret,
  selection, or uncommitted input. Verify IME in the packaged Windows app.
- Group a continuous edit into one undo action; undo and redo reproduce the
  expected document state without adding hover/focus changes to history.
- Save, close, and reopen the document. Denied or failed writes preserve the
  previous saved document.
- Cancel background work and close during work without late callbacks or hangs.
- Run the same application command/state cases through headless and Windows
  integration tests. Validate malformed views and invalid event targets.
- Package and run the example outside the source checkout.

## Fit with the larger product model

Keep the proposed dependency direction:

`products -> domain kits -> shared systems -> capabilities -> providers`

Windows, Linux, and browser are execution environments. Local, remote, and
embedded describe placement. A provider implementation declares its contracts,
versions, and limits; these labels should not become one platform enum. Remote
placement also introduces latency, failure, and authority boundaries that must
remain visible to callers.

Do not route high-frequency graphics or real-time audio processing through the
general UI event/undo path. Reserve an explicit rendering-surface boundary with
size, clipping, scale, input ownership, and lifetime. Keep audio processing
separate from application control messages. Implement those systems when a
product slice can exercise them, with their own scheduling and resource rules.

After this milestone, a Wand viewport with asset loading would be a useful next
slice for graphics and spatial input. A Skraps audio-processing proof would
exercise different constraints. Choose between those based on the first product
priority; neither needs to wait for a universal cloud or collaboration platform.
