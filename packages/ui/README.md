# @loop-kit/ui

Keyed semantic UI data, optimistic frame/event revisions and an independent
recording adapter. DOM, native rendering, placement and permissions belong to hosts.
WIT surfaces own JSON frame/event transport; callbacks stay in the guest.

```ts
import { h, RecordingSurface } from '@loop-kit/ui';
const surface = new RecordingSurface();
surface.render({ revision: 0, root: h('button', { key: 'run', label: 'Run', text: 'Run' }) });
surface.event({ revision: 0, sequence: 1, key: 'run', type: 'activate' });
console.log(await surface.nextEvent());
surface.dispose();
```

Public root exports: `h`, `validateFrame`, `RecordingSurface` and semantic node/frame/event/surface types. No package dependencies. Private source subpaths are not supported.

The surface owner calls `dispose()` to finish pending event reads; semantic data owns no native renderer or permission decisions.

Verify from the repository root with `bun run repo verify ui`; `bun run repo context ui --json` prints ownership, dependencies and entrypoints. `bun run watch` refreshes linked JavaScript and declarations after source edits.

## Registries and reusable descriptions

`createElementRegistry()` defines stable element IDs, property schemas/defaults,
ordered child-slot constraints, events and accessible-label requirements.
`defineElement()` infers custom property types; use `elementProperties()` for
validated defaults. Hosts register trusted renderers independently. Unknown types
fail in `validateFrame`; RecordingSurface accepts the same explicit registry.
Legacy short IDs and string icons remain compatible.

`IconRef` describes a symbol, SVG asset identity/path or registered provider, with
semantic size and decorative/image role. Hosts resolve validated resources; image
icons require a label. `ActionDescriptor` separates serializable metadata from
`invokeAction` ports. Conditions recheck on invocation; authority metadata never
confers permissions. Hosts must authorize every command port invocation.

`CollectionSource`/`collectionView`, `PropertyDescriptor`/`ValueReference`,
`SemanticTokens`, normalized key/pointer input and `createUiController` support
non-React consumers. Controllers expose cached deeply frozen snapshots, stable
subscriptions and explicit disposal. Layout, focus and DOM measurement stay in hosts.

```ts
import { defineElement, createElementRegistry, elementProperties } from '@loop-kit/ui';
const status = defineElement({ id: 'example:status/v1',
  properties: { text: { type: 'string', default: 'Ready' } },
  children: { max: 0 }, events: [],
  accessibility: { labelRequired: false, role: 'status' } });
const registry = createElementRegistry([status.definition]);
console.log(elementProperties(status.node('status', {}), registry).text);
```
