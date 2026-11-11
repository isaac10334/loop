# @loop-kit/renderer-dom

Trusted mapping of public semantic UI frames to native DOM controls. No React,
HTML/CSS injection, URL loading, guest callbacks or implicit resource resolution.

```ts
import { semanticDom, validateDomFrame } from '@loop-kit/renderer-dom';
const plugin = semanticDom({ key: 'dom', root: '#app' });
console.log(plugin.runtime[0]?.entry.export);
validateDomFrame({ revision: 0, root: { key: 'hello', type: 'text', text: 'Hello' } });
```

In browser code call `createDomSurface({root, signal})` with an owned HTMLElement,
then `render(frame)`, `nextEvent()` and `dispose()`. `render` validates finite plain
data, public element/property/key constraints and the 64 KiB UTF-8 budget before
changing the DOM. It commits synchronously and resolves on the next animation
frame. Revisions start at zero and advance exactly once; stale/duplicate-sequence,
unknown, disabled/loading and post-disposal events reject. No descriptor authorizes
a command; the receiving trusted host must recheck policy.

Native buttons/selects/inputs provide keyboard and pointer behavior. Stable keys
restore focus and text-input selection after replacement; listeners are detached
from old nodes. Supported built-ins are column, row, text, icon (literal symbol
only), button, popover (activation only, not window placement), input, toggle,
select, list, tree, table and metric. Resource/provider icons and custom elements
fail until an explicit reviewed mapping exists. This is a semantic renderer, not
a layout system or full tree/table navigation framework.

The surface owner closes pending reads **synchronously on abort**, before task
joins; disposal removes listeners, clears DOM and resolves pending frame waits.
`inspect()` exposes listener/read/frame counts, not events or authority. Runtime
`setup` receives explicit `document` and `registerRenderer` ports from the kit;
it creates no global registry and owns no second lifetime for the kit's surface.

Verify: `bun run repo verify renderer-dom`; actual Chrome keyboard/pointer,
focus/denial/teardown checks: `bun tooling/host-browser/acceptance.ts`.
