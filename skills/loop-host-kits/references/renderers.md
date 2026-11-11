# Renderer adapter route

Use this branch for semantic UI or renderer changes. Resolve repository owner paths
from the selected Loop checkout as described in the skill entrypoint.

## Portable semantics

Read `packages/ui/README.md` and public declarations for existing element
registries, property/action descriptors, controllers, `Surface`, frames and events.
Extend that seam only when the requested behavior cannot use it. Keep semantic
identity/version, revision/sequence/key validation and lifetime rules portable;
layout, focus, platform measurement and event translation belong to the renderer.

Before accepting an event, validate its current surface/frame identity and event
ordering, reject stale/duplicate/disabled actions and authorize the invoked command
at the trusted host port. A descriptor or enabled button grants no authority.
Guest callbacks remain guest-local; exchange bounded semantic data across realms.
Dispose subscriptions, pending event reads and callback registrations with their
surface/session owner. Test events after disposal as well as the successful path.

## Web and optional React

For DOM output, use trusted element mappings, safe property/resource handling,
accessible labels, keyboard/focus behavior and explicit listener cleanup. Treat
untrusted HTML, CSS, URLs or remote callbacks as separate reviewed boundaries.
A DOM protocol does not establish guest isolation.

Use React only if the selected host already chooses it. Adapt existing controller
snapshots/subscriptions and keep effects/listeners under component or surface
ownership; do not move hooks, DOM globals or React types into portable contracts.
A React component is a renderer implementation, not a semantic element registration
or a Station widget definition. Station owns its product rendering and placement.

For a proposed standalone kit/DOM adapter, read `specs/host-kits.md` sections 3, 6
and 7 before choosing package names or claiming runtime support. Verify a real
rendered interaction, denial/stale-event behavior and teardown on the selected
platform. `RecordingSurface` proves semantic behavior, not DOM/native acceptance.
