# @loop-kit/scripting

Execution identities, lifecycle contracts and a guest SDK for explicit bindings.
`createGuestSdk` owns portable UI callbacks inside the guest. WIT supplies scoped
service calls/subscriptions and surfaces; a host enforces policy and budgets.
The reusable evaluator source targets pinned wasm-rquickjs P3 and Polyengine.
Ordinary JavaScript contracts alone are not a permission boundary.

```ts
import { createGuestSdk } from '@loop-kit/scripting';
// The owning runtime supplies these narrow bindings and enforces their policy.
const sdk = createGuestSdk({
  invoke: async () => ({ refreshed: true }),
  subscribe: async () => ({ next: async () => undefined, cancel() {} }),
  openSurface: async () => ({
    render: document => console.log(document),
    nextEvent: async () => undefined,
    dispose() {},
  }),
});
await sdk.ui.render(sdk.ui.h('button', { key:'refresh', label:'Refresh', text:'Refresh',
  onActivate: async () => { await sdk.invoke('catalog', {}); } }));
// Retain sdk.ui as the session's update/dispose controller.
sdk.ui.dispose();
```

Public root exports: `scripting`, `createGuestSdk` and execution/session/binding types. Depends on capabilities and ui, never host or Station. Private source subpaths are not supported.

The session owner stops execution and disposes the guest UI controller; injected bindings retain authorization and resource policy. The optional native/WASM evaluator is not required to import the npm package.

Verify from the repository root with `bun run repo verify scripting`; `bun run repo context scripting --json` prints ownership, dependencies and entrypoints. `bun run watch` refreshes linked JavaScript and declarations after source edits.
