# @loop-kit/host-browser

Browser kit factories are inert typed composition data. The CLI owns config trust,
bundling and loopback endpoints; the browser bootstrap owns a fresh host and scopes.

```ts
import { browser } from '@loop-kit/host-browser';
const kit = browser({ profile: 'loop:profile/browser-ts@0.1.0', listen: { hostname: '127.0.0.1', port: 0 } });
console.log(kit.identity.id);
```

`browser` supports `loop:profile/browser-ts@0.1.0` and explicitly selected
`loop:profile/browser-components@0.1.0`; selecting the latter does not itself load
or authorize a Component. Add `semanticDom({key:'dom', root:'#app'})` from the
public renderer package to the target. Runtime modules export
`setup({host, scope, signal, options, ports})`; application modules export
`start({host, scope, surface, signal})`, receiving the **already composed** objects.
Do not create/discover a second host or independently dispose the borrowed surface.

`bootstrapBrowser({plan, modules, root?, workerUrl?, signal?})` consumes the validated
resolved plan plus a bundler-generated static map of public module namespaces keyed
by exact specifier. It executes contributions sequentially, compares actual provider
and explicit renderer registrations with declared keys, mounts the renderer and
starts the application. Coordinator/Bun providers require a reviewed remote bridge
and are rejected in static browser output. No config closure crosses realms.
Source/module/lock currency belongs to the plan evaluator/build owner; the runtime
module map alone does not establish that its bytes match a resolved source digest.

The returned runtime provides `dispose(reason?)`. Failure and repeated stop share
one completion. Abort closes pending surface event reads synchronously and starts
`host.dispose` (including registration activation abort) **before** awaiting scope
task joins; partial starts unwind with aggregate primary/cleanup failures. Providers
must register cleanup before acquisition awaits. Trusted ordinary TS can ignore
cancellation and is not sandboxed; forced guest termination belongs to a dedicated
worker. Each bootstrap has independent host/provider/surface state, never a global
mutable registry. The caller retains endpoint and outer-process ownership.

`browser({assets: [{source, path, sha256}]})` declares pinned binary/text output
assets without embedding them in the 1 MiB authored source snapshot. `source` is a
project-relative regular file; `path` is a portable lowercase output basename.
The CLI independently rejects traversal, reserved/colliding names and symlinks,
checks each digest during evaluation and again during copying, and includes the
binary input in source-currentness checks. Limits: 16 assets, 32 MiB each, 64 MiB
total. Assets are copied into static and live output and served only by their
declared names. This is artifact delivery, not permission for a guest to read files.
Changing an asset requires regenerating its explicit pin before a fresh build.

`createGpuSession({gpu, signal?, onLost?})` acquires an **owned** WebGPU device
from an injected platform; it never reads `navigator`. Track created buffers with
`trackBuffer`, and register exclusive canvas ownership with `configure(context, fn)`
before configuring. Wrap later initialization in `try`/`catch` and dispose on failure;
call `assertActive()` after asynchronous work. Disposal is synchronous, idempotent,
cleans tracked buffers, unconfigures the canvas and destroys the device. Abort rejects
pending acquisition and destroys a late device; device loss disposes and calls `onLost`.
Pending platform operations cannot be forcibly stopped. Extracted GPU objects are not
revoked, and the caller must not independently dispose or share owned resources.

Verify: `bun run repo verify host-browser`; actual two-launch/stop-A-leaves-B,
relocated static output and real Component interaction:
`bun tooling/host-browser/acceptance.ts`. These runtime fixture plans are synthetic;
they do not alone prove CLI evaluation or source-currency acceptance.
