# Browser counter with an explicit TypeScript provider

Start with the official kit in [official.config.ts](official.config.ts). The app
renders a count, an accessible step input and an Increment button. Valid steps are
whole numbers from 1 to 100; invalid input disables the button, and the provider
independently validates every operation. Count state belongs to the named provider;
the input draft belongs to the application. Nothing is persisted across launches.

After preparing an installed consumer as described below, use the current source-built CLI:

```powershell
& ./target/debug/loop.exe inspect $consumer --evaluate-config --config official.config.ts --trust-local-config --target counter --json
& ./target/debug/loop.exe dev $consumer --config official.config.ts --trust-local-config --target counter --instance counter-demo --json
# In another terminal:
& ./target/debug/loop.exe stop counter-demo --root $consumer --json
& ./target/debug/loop.exe build $consumer --config official.config.ts --trust-local-config --target counter --json
```

Open the reported origin, not an assumed port. The static build writes
`dist/counter/index.html` and `app.js` under the consumer; serve that directory
with a static HTTP server. No config callbacks are needed by this official route.
[app.ts](app.ts) borrows the kit's surface and owns its event task through the
injected scope. Kit shutdown closes event reads before joining the task, releases
the acquired service and removes DOM listeners. The app never disposes the borrowed
surface independently.

Focused checks from the checkout root:

```powershell
bun test examples/host-kits/custom-provider/app.test.ts
# Set PLAYWRIGHT_MODULE to an explicitly installed Playwright entry module.
node examples/host-kits/custom-provider/browser-check.mjs <loop-executable> <prepared-consumer> <new-receipt-directory>
```

The browser check uses headless Chromium only. It checks static relocation,
pointer/Enter/Space, input validation/recovery and stopped/detached controls.
The unit checks cover provider overflow, direct invalid calls, extracted references
after disposal and independent launch state. These do not establish guest isolation
or visible native execution.

## Optional custom-kit extension

The original [loop.config.ts](loop.config.ts) remains an explicit alternative to
`official.config.ts`: it selects the custom factory/coordinator and Bun lifecycle
callbacks documented below. Use it when learning to extend a kit, not as the default
application starting point.

This is a real, trusted-host example, not a new official kit or a sandbox. It uses
only installed public SDK roots. It needs Bun 1.3.14, npm, `tar`, a current Loop CLI
with config-mode support, and a browser. No global links, a separate host application's
source, private imports or framework-name dispatch are involved.

## Prepare explicitly

The source package pins the five SDK packages to **0.1.0**. Those packages need not
be published: use reviewed tarballs produced from the current SDK build. From the
Loop checkout root:

```powershell
bun examples/host-kits/custom-provider/prepare-fixture.ts target/npm-pack target/custom-provider-fixture
```

The script first validates every tarball's package name/version and rejects
unrewritten workspace dependencies. It stages exact tarball bytes and SHA-256
receipts under the selected output directory, copies this small app into its `consumer` subdirectory,
changes **only the generated copy's** dependencies to relative `file:` pins with
npm overrides, and explicitly installs offline with lifecycle scripts disabled.
It creates example-local npm and Bun v1 lockfiles; Bun consumes the migrated lock
without downloading registry packages. The CLI requires the reviewed `bun.lock` and
checks installed package metadata against its frozen graph. Nothing updates the source
manifest, repository lock, policy or package manifests. An existing selected
output directory causes a refusal: review/archive it explicitly or choose a new path
before preparing another snapshot. There is no delete, global install, automatic packing or source-copy
SDK fallback. Supply an absolute tarball-directory argument from another checkout.
The optional second argument selects the output directory; use a new absent location
if the default `.artifacts` contains older receipts.

The generated consumer has real installed packages, not workspace links. Its
source inventory includes the config, exact package/lock inputs, app, provider,
capability contract, custom factory and custom runtime coordinator. The preparer
and these instructions are tooling, not runtime inputs.

## Inspect, evaluate and run in development

From the Loop checkout root (or substitute the path to your selected CLI):

```powershell
$consumer = 'target/custom-provider-fixture/consumer'
& ./target/debug/loop.exe inspect $consumer --json
& ./target/debug/loop.exe inspect $consumer --evaluate-config --trust-local-config --target counter --json
& ./target/debug/loop.exe dev $consumer --config loop.config.ts --trust-local-config --target counter --instance custom-counter --json
```

This config includes live Bun-side lifecycle callbacks. `loop build` intentionally
rejects it with `E_NONPORTABLE_CALLBACK` rather than serializing those closures into
a static browser artifact; use `dev` for this example. Open the reported loopback
origin. The native **Increment** button starts at
`Count: 0`; click it, then focus it and press Enter or Space. Each accepted semantic
`activate` calls the named provider and commits the next revision. Stop with Ctrl+C.
The evaluated Bun process logs `custom-provider:prepare`, `custom-provider:ready`
and `custom-provider:quiesce` with target, instance and epoch. These are actual
callbacks, not serialized functions or browser hooks. Select `official.config.ts`
for static output; the custom hook-bearing config cannot be built statically.

Executable config has same-user authority; the explicit trust flag is not
isolation. No guest Component or permission-grant claim is made here.

## Public seams

- [counter-kit.ts](counter-kit.ts): its own `defineHostKit` factory, identity
  `example:kit/counter-browser@1.0.0`, reusing the official
  `loop:profile/browser-ts@0.1.0` profile and endpoint defaults.
- [counter-runtime.ts](counter-runtime.ts): the pinned `startCounterBrowser(context)` export validates
  the exact custom identity/profile, then delegates public `bootstrapBrowser`.
- [counter.ts](counter.ts): capability `example:counter/value`, opaque exact version `1`,
  named service `primary`; identity is not authority.
- [counter-provider.ts](counter-provider.ts): portable ordinary TS `setup`, one shared service per
  launch, cooperative cancellation and scope-owned registration disposal.
- [app.ts](app.ts): injected host/scope/surface, named acquisition, semantic native button,
  frame/event revisions and cancellation-safe lifetime task; no second host.
- [loop.config.ts](loop.config.ts): factory/plugin/renderer composition and trusted Bun callbacks.

A current config CLI must bundle and call the pinned coordinator module/export,
not hardcode the official browser coordinator. Reusable browser bootstrap must
accept compatible external kit identities. Static typechecking alone proves
neither condition nor rendered execution.
