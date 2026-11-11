# Host-kit CLI and project proposals

**Proposed syntax and source, HK1. These commands/APIs do not run on today's CLI.**
[The canonical spec](host-kits.md) owns semantics. Implementation must turn these
projects into compiled, packed-consumer acceptance fixtures before advertising them.
The official kits are browser and Rust native. The native variant below must
become the official standalone desktop example during implementation. Section B
retains an earlier Electrobun proposal as **optional compatibility research only**;
its package names are historical sketches, not an instruction to create official
packages/starters or spend time on SDK integration. Skip it if complex.

These sketches use ordinary trusted TS providers. Adding a guest Component waits
for the separate async-document gate; kit selection alone supplies no sandbox.

## Proposed CLI help

```text
loop <COMMAND>

Existing commands (unchanged unless --config is selected):
  create <PATH> [--template component|desktop] [--language rust|typescript]
                [--host generated|user] [--yes] [--host-source PATH]
                [--template-dir PATH]
  add component <NAME> [--language rust|typescript] [--workspace PATH]
  run [PATH=.] [--headless] [--actions LIST] [--writable]
  build [PATH=.] [--release]
  doctor
  upgrade
  uninstall

New host-kit mode (PROPOSED):
  create <PATH> --kit browser|native [--yes]
  dev [ROOT=.] --config loop.config.ts --target ID --trust-local-config
               [--instance ID] [--port PORT] [--profile NAME] [--json]
  run [ROOT=.] --config loop.config.ts --target ID --trust-local-config
               [--instance ID] [--port PORT] [--profile NAME] [--json]
  build [ROOT=.] --config loop.config.ts --target ID --trust-local-config
                 [--release] [--json]
  inspect [ROOT=.] [--plan FILE] [--json]
  inspect [ROOT=.] --config loop.config.ts --evaluate-config
                   --trust-local-config [--target ID] [--json]
  doctor [ROOT=.] [--json]                 # static prerequisites, no config import
  stop <INSTANCE> --root ROOT [--json]
  restart <INSTANCE> --root ROOT --trust-local-config [--json]

Optional agent skills (PROPOSED, bundled/offline only):
  skills list [--json]
  skills inspect <ID> --scope project|user --root PATH --adapter codex-v1 [--json]
  skills install|update|remove <ID> --scope project|user --root PATH
         --adapter codex-v1 [--version VERSION] [--dry-run | --write] [--json]
  skills recover <ID> --scope project|user --root PATH --adapter codex-v1
         [--dry-run | --write] [--json]

Config is trusted local executable code. Inspection is static unless explicitly
requested. Multiple targets require --target. Port 0 allocates a fresh endpoint.
Skill mutation verbs plan by default; --write applies. No command auto-installs skills.
```

New config commands reject legacy `--writable`, `--headless`, `--actions` and
`--host-source` unless the explicitly selected legacy adapter declares them. Do
not map `--writable` to arbitrary document rights. Build prepares artifacts; it
does not start runtime plugins or issue grants. Trusted prepare hooks may execute.

Example diagnostics (proposed):

```text
E_CONFIG_OPT_IN: loop.config.ts is present; no loop.toml at the explicit root.
  Use: loop run . --config loop.config.ts --target web --trust-local-config
E_TARGET_REQUIRED: choose one of [web, desktop]; no host started.
E_CONFIG_CONFLICT: legacy.adapter.world disagrees with loop.toml bindings (both locations).
E_NONPORTABLE_CALLBACK: browser provider needs an exported runtime module, not a config closure.
E_PROFILE_BUSY: profile review is owned by instance desktop.review; no fallback/profile reuse.
E_TOOL_VERSION: evaluator requires pinned Bun compatibility; actual executable/version reported.
E_PROTOCOL_FRAME: payload length 1048577 exceeds 1048576; worker stopped; no result promoted.
E_SKILL_LOCAL_EDIT: references/web-renderers.md differs from the owned installation receipt.
```

## Example factory adapter contracts

These proposed adapters expose package-root factories; their options become
bounded literal kit/plugin data. Each factory specifies its supported profiles
and emits a pinned runtime module/export descriptor. The CLI installs no package
implicitly. Both factory and runtime exports must survive the outside-workspace
pack test. Example version `0.1.0` denotes a proposed release to prepare, **not a
claim those adapter packages currently exist or that npm has published them**.

Both kit factories declare distinct `coordinator` and `application` host keys;
only the latter supplies these examples' runtime provider registrations. Guest
worker hosts require explicit kit profiles and are absent from these projects.
Setup returns void; the kit instruments actual registrations against declarations.

The application receives an already-composed `Host`, application `Scope`, borrowed
semantic `Surface` and cancellation signal. The kit owns the surface and closes
pending `nextEvent()` **on abort before joining application tasks**. The application
must not adopt/dispose a second owner for it. Provider modules own their registration
through their plugin scope. Each launch imports fresh mutable instances; no module
global host/provider registry is permitted.

## A. Browser project

```text
hello-browser/
  package.json
  loop.config.ts
  loop.package.json
  .gitignore
  src/status.ts
  src/status-provider.ts
  src/app.ts
  bun.lock                 # generated/reviewed by explicit dependency preparation
```

`package.json`:

```json
{
  "name": "hello-browser",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "loop dev . --config loop.config.ts --target web --trust-local-config",
    "build": "loop build . --config loop.config.ts --target web --trust-local-config --release"
  },
  "dependencies": {
    "@loop-kit/capabilities": "0.1.0",
    "@loop-kit/host": "0.1.0",
    "@loop-kit/ui": "0.1.0",
    "@loop-kit/host-browser": "0.1.0",
    "@loop-kit/renderer-dom": "0.1.0"
  }
}
```

`loop.config.ts`:

```ts
import { defineConfig, defineHostPlugin } from '@loop-kit/host';
import { browser } from '@loop-kit/host-browser';
import { semanticDom } from '@loop-kit/renderer-dom';

const status = () => defineHostPlugin({
  apiVersion: 1,
  identity: { id: 'example:provider/status', version: '1.0.0' },
  key: 'status.primary',
  targets: ['browser'] as const,
  runtime: [{ key: 'status', host: 'application', requires: [],
    provides: [{ kind: 'provider', host: 'application',
      id: 'example:hello/status', version: '1.0.0', serviceId: 'main' }],
    entry: { specifier: './src/status-provider.ts', export: 'setup' },
    options: { greeting: 'Hello from browser' } }],
});

export default defineConfig({
  schemaVersion: 1,
  source: { manifest: './loop.package.json' },
  targets: [{
    id: 'web',
    kit: browser({ profile: 'loop:profile/browser-ts@0.1.0',
      listen: { hostname: '127.0.0.1', port: 0 } }),
    application: { specifier: './src/app.ts', export: 'start' },
    plugins: [status(), semanticDom({ key: 'dom', root: '#app' })],
  }],
});
```

`loop.package.json` (source-manifest v1; all authored runtime inputs listed):

```json
{
  "version": 1,
  "id": "example:hello-browser",
  "sourcePaths": ["package.json", "bun.lock", "loop.config.ts", "src/status.ts", "src/status-provider.ts", "src/app.ts"]
}
```

`.gitignore`:

```gitignore
node_modules/
dist/
.loop/
```

`src/status.ts`:

```ts
import { defineCapability } from '@loop-kit/capabilities';
export const status = defineCapability<{ next(): string }>({
  id: 'example:hello/status', version: '1.0.0',
});
```

`src/status-provider.ts`:

```ts
import type { Host, Scope } from '@loop-kit/host';
import { status } from './status';
export async function setup(ctx: {
  host: Host; scope: Scope; options: { greeting: string };
}) {
  const registration = ctx.host.provide(status, {
    create() { let count = 0; return { next: () => `${ctx.options.greeting}: ${++count}` }; },
  }, { serviceId: 'main', lifetime: 'shared' });
  ctx.scope.defer(() => registration.unregister());
  await registration.activate();
}
```

`src/app.ts`:

```ts
import type { Host, Scope } from '@loop-kit/host';
import { h, type Surface, type UiFrame } from '@loop-kit/ui';
import { status } from './status';
export async function start(ctx: {
  host: Host; scope: Scope; surface: Surface; signal: AbortSignal;
}) {
  const service = await ctx.scope.bind(status, 'main').acquire();
  let revision = 0, sequence = 0;
  const draw = (text: string): Promise<void> => Promise.resolve(ctx.surface.render({
    revision,
    root: h('column', { key: 'root' },
      h('text', { key: 'status', text }),
      h('button', { key: 'next', label: 'Next greeting', text: 'Next' })),
  } satisfies UiFrame));
  await draw('Ready');
  const events = ctx.scope.task(async () => {
    while (!ctx.signal.aborted) {
      const event = await ctx.surface.nextEvent();
      if (!event || ctx.signal.aborted) return;
      if (event.revision !== revision || event.sequence <= sequence ||
          event.key !== 'next' || event.type !== 'activate') continue;
      sequence = event.sequence;
      const text = service.value.next();
      revision++;
      await draw(text);
    }
  }, { name: 'semantic-events' });
  // The scope owns/joins the task; observe its errors without detaching its body.
  void events.result.catch(error => console.error('semantic-events failed', error));
}
```

The kit supplies the minimal HTML document with `#app`, owns its server/listeners,
creates runtime host/scope and mounts the selected semantic renderer before start.
It rejects HTML/CSS in semantic frames. A static browser build embeds application
provider modules; it must reject Bun-only providers without an explicit remote
bridge. No inherited native documents/grants appear in browser output.

Proposed workflow after packages exist: explicit `bun install` (or local reviewed
packed-artifact setup), review/pin the resulting Bun lock, then `bun install
--frozen-lockfile`; run `bun run dev` and observe its reported origin. Two launches
use distinct ephemeral origins; stop one and confirm the other still increments.
`bun run build` emits browser-only output with no Bun/native dependency. A lockfile
is required generated input; this design does not fabricate registry-integrity
bytes for unpublished adapters.

## B. Desktop project

**Optional historical Electrobun compatibility proposal, not the official desktop
kit.** This section keeps its earlier source design/inbound links. Do not include
its dependencies in official builds, add an Electrobun CLI preset or implement a
placeholder package for it. The official desktop is our Rust native kit below.

```text
hello-desktop/
  package.json
  hutch.config.ts
  loop.config.ts
  loop.package.json
  .gitignore
  src/counter.ts
  src/counter-provider.ts
  src/app.ts
  bun.lock                 # generated/reviewed by explicit dependency preparation
```

`package.json`:

```json
{
  "name": "hello-desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare:desktop": "bun x --no-install electrobun prepare --env=canary",
    "dev": "loop dev . --config loop.config.ts --target desktop --trust-local-config",
    "build": "loop build . --config loop.config.ts --target desktop --trust-local-config --release"
  },
  "dependencies": {
    "@loop-kit/capabilities": "0.1.0",
    "@loop-kit/host": "0.1.0",
    "@loop-kit/ui": "0.1.0",
    "@example/electrobun-compat": "0.1.0",
    "@loop-kit/host-browser": "0.1.0",
    "@loop-kit/renderer-dom": "0.1.0",
    "electrobun": "2.0.3-beta.26"
  }
}
```

`hutch.config.ts`:

```ts
export default { packageManager: 'bun', electrobun: { version: '2.0.3-beta.26' } };
```

Electrobun's npm runtime export throws until the SDK is projected. Explicit
`bun run prepare:desktop` prepares that pinned Hutch toolchain; it may download
assets or write its own cache, so it is an opt-in trusted preparation operation,
not an action this design run performs. The kit verifies SDK/launcher versions and
hashes and stages portable resources; its run/build returns `E_DESKTOP_TOOLCHAIN`
when preparation is missing, without fetching or searching arbitrary home caches.

`loop.config.ts`:

```ts
import { defineConfig, defineHostPlugin } from '@loop-kit/host';
import { electrobun } from '@example/electrobun-compat';
import { semanticDom } from '@loop-kit/renderer-dom';

const counter = () => defineHostPlugin({
  apiVersion: 1,
  identity: { id: 'example:provider/counter', version: '1.0.0' },
  key: 'counter.primary',
  targets: ['desktop'] as const,
  runtime: [{ key: 'counter', host: 'application', requires: [],
    provides: [{ kind: 'provider', host: 'application',
      id: 'example:desktop/counter', version: '1.0.0', serviceId: 'main' }],
    entry: { specifier: './src/counter-provider.ts', export: 'setup' }, options: {} }],
});

export default defineConfig({
  schemaVersion: 1,
  source: { manifest: './loop.package.json' },
  targets: [{
    id: 'desktop',
    kit: electrobun({ profile: 'loop:profile/electrobun-ts@0.1.0',
      application: { identifier: 'dev.example.loop.hello', version: '0.1.0' },
      window: { title: 'Loop desktop example', width: 800, height: 600 },
      storage: { mode: 'transient-per-instance' } }),
    application: { specifier: './src/app.ts', export: 'start' },
    plugins: [counter(), semanticDom({ key: 'dom', root: '#app' })],
  }],
});
```

`loop.package.json`:

```json
{
  "version": 1,
  "id": "example:hello-desktop",
  "sourcePaths": ["package.json", "bun.lock", "hutch.config.ts", "loop.config.ts", "src/counter.ts", "src/counter-provider.ts", "src/app.ts"]
}
```

`.gitignore`:

```gitignore
node_modules/
dist/
.loop/
.hutch/
```

`src/counter.ts`:

```ts
import { defineCapability } from '@loop-kit/capabilities';
export const counter = defineCapability<{ next(): number }>({
  id: 'example:desktop/counter', version: '1.0.0',
});
```

`src/counter-provider.ts`:

```ts
import type { Host, Scope } from '@loop-kit/host';
import { counter } from './counter';
export async function setup(ctx: { host: Host; scope: Scope }) {
  const registration = ctx.host.provide(counter, {
    create() { let count = 0; return { next: () => ++count }; },
  }, { serviceId: 'main', lifetime: 'shared' });
  ctx.scope.defer(() => registration.unregister());
  await registration.activate();
}
```

`src/app.ts`:

```ts
import type { Host, Scope } from '@loop-kit/host';
import { h, type Surface, type UiFrame } from '@loop-kit/ui';
import { counter } from './counter';
export async function start(ctx: {
  host: Host; scope: Scope; surface: Surface; signal: AbortSignal;
}) {
  const service = await ctx.scope.bind(counter, 'main').acquire();
  let revision = 0, sequence = 0;
  const draw = (count: number): Promise<void> => Promise.resolve(ctx.surface.render({
    revision,
    root: h('column', { key: 'root' },
      h('text', { key: 'count', text: `Count ${count}` }),
      h('button', { key: 'increment', label: 'Increment count', text: 'Add one' })),
  } satisfies UiFrame));
  await draw(0);
  const events = ctx.scope.task(async () => {
    while (!ctx.signal.aborted) {
      const event = await ctx.surface.nextEvent();
      if (!event || ctx.signal.aborted) return;
      if (event.revision !== revision || event.sequence <= sequence ||
          event.key !== 'increment' || event.type !== 'activate') continue;
      sequence = event.sequence;
      const count = service.value.next();
      revision++;
      await draw(count);
    }
  }, { name: 'desktop-events' });
  void events.result.catch(error => console.error('desktop-events failed', error));
}
```

The example provider runs in the WebView application realm; it is ordinary trusted
TS, not Bun code or a Component. The Bun main process owns Electrobun/window/IPC
and explicit native adapters. A Bun provider must select the coordinator host plus a
reviewed bridge; it cannot smuggle a closure into this application module.

Proposed workflow: prepare/review frozen dependencies, run `bun run dev`, verify
keyboard button activation and closing the exact example joins its workers and
releases profile/endpoint leases. Launch two instances and test independent counts.
Build the standalone desktop distribution, run its exact installed/relocated bytes,
and prove it uses neither a checkout-relative resource nor CLI process. System
WebView2/MSVC prerequisites stay visible. Do not borrow Station's identifier,
profiles, updater feed, native bridge credentials or ports 43157–43159.

## Native Rust kit variant (proposed)

The November 7 scope makes this the official desktop direction, without changing
the existing legacy CLI path. This particular recipe is the opt-in TS-provider
profile; Rust owns desktop presentation, lifecycle and Component execution. Start with the desktop project's counter/provider/application
source above. Remove Electrobun/Hutch dependencies and preparation files; add the
proposed `@loop-kit/host-native` adapter dependency. Use its exported `native`
factory instead of `electrobun`, and keep the counter contribution on the
`application` host. In this profile that host runs in the trusted Bun coordinator,
not a WebView. Its semantic surface bridges to the kit-owned Wry presentation
adapter; the selected native profile supplies its semantic renderer plugin.

```ts
// Proposed replacement target; not a working factory in today's packages.
import { native } from '@loop-kit/host-native';
const nativeTarget = {
  id: 'native',
  kit: native({ profile: 'loop:profile/native-ts@0.1.0',
    window: { title: 'Loop native example', width: 800, height: 600 },
    storage: { mode: 'transient-per-instance' } }),
  application: { specifier: './src/app.ts', export: 'start' },
  plugins: [counter()], // the same local factory defined in the desktop config
};
```

Place that target in `defineConfig`, remove `semanticDom` from the target plugin
list (the native profile owns the presentation plugin), and update the literal
source list/scripts to match the authored files and `--target native`. This is a
variant recipe, not another claim of a complete generated project. The implementation
must ship and test a standalone materialized native example, shared Wasmtime runtime
provider, and public custom-kit factory example, including same-byte Component
interaction. [Desktop integration evidence](../docs/reference/desktop-hosts.md)
explains why the Electrobun example should supervise that provider instead of
nesting Wry or assuming native Rust has Electrobun's updater.

## Multi-target composition and Component follow-up

To compose the official browser and native targets in one project, include their
independent entries and adapter dependencies, with no Electrobun/Hutch dependency.
Do not share mutable plugin instances between entries.
`loop dev ... --target web --instance preview-a` and `--target native --instance
preview-b` own separate epochs/profiles. Omitting target fails when both exist.

After G1/G2, an additional typed Component plugin can reference a verified artifact,
exact world/profile and a host policy binding descriptor. The config may request a
document but cannot serialize a live grant or set `allowAll`. The host issues the
actual resource through current policy. Build source/tool/artifact hashes and
inspected import/export identities accompany that fixture. Until then, these
ordinary-provider projects prove only kit composition and semantic host UI.
