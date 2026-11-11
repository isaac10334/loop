# Examples

Start with the [browser counter quickstart](quickstart.md) to build an application,
then choose a smaller example for the boundary you want to learn. Examples use
public package roots; their setup and runtime requirements differ.

## Browser application: input, state and composition

The [browser counter](../../examples/host-kits/custom-provider/README.md) uses the
official browser kit, semantic DOM renderer and an application-defined TypeScript
capability. Its prepared consumer installs reviewed tarballs outside the checkout.

| Change | Source |
| --- | --- |
| Semantic frames, input draft and event task | [app.ts](../../examples/host-kits/custom-provider/app.ts) |
| Exact capability identity and named service | [counter.ts](../../examples/host-kits/custom-provider/counter.ts) |
| Per-launch count state and operation validation | [counter-provider.ts](../../examples/host-kits/custom-provider/counter-provider.ts) |
| Official kit, provider registration and renderer selection | [official.config.ts](../../examples/host-kits/custom-provider/official.config.ts) |
| Offline packed installation | [prepare-fixture.ts](../../examples/host-kits/custom-provider/prepare-fixture.ts) |

The amount input accepts integers from 1 to 100. Invalid input leaves the count
unchanged and disables the button; the provider checks bounds and overflow again.
Pointer, Enter and Space invoke the same semantic action. Shutdown closes pending
event reads, joins the scoped task, releases the service and clears the DOM. State
is in memory and resets on a new launch.

Run the focused semantic/provider checks from the checkout root:

```powershell
bun test examples/host-kits/custom-provider/app.test.ts
```

The example's headless browser check additionally exercises the actual CLI route,
relocated static output, native DOM keyboard/pointer controls and disposal. It
requires explicitly installed Playwright; see the example README for invocation.
Recording-surface tests alone are not evidence of rendered browser behavior.

### Extend a kit explicitly

The same directory retains an optional
[custom-kit config](../../examples/host-kits/custom-provider/loop.config.ts),
[factory](../../examples/host-kits/custom-provider/counter-kit.ts) and
[coordinator](../../examples/host-kits/custom-provider/counter-runtime.ts).
Select `--config loop.config.ts` instead of `official.config.ts` to use it. It
reuses the public browser bootstrap under its own identity and logs trusted
Bun-side prepare/ready/quiesce callbacks. These callbacks are intentionally
nonportable: static build rejects that config. Start with the official config
unless you need to learn kit extension.

## Resource ownership without a host kit

The [lifecycle monitor](../../examples/lifecycle-monitor/README.md) measures real
timer latency using explicit sampler and journal capabilities. It demonstrates
provider replacement, cancellation, retained state and awaited disposal. Its
browser page is an acceptance harness, not the official semantic DOM application
shell. Choose it to study service lifetimes independently of presentation.

## TypeScript editing against WIT

The [WIT editor example](../../examples/wit-editor/README.md) checks TypeScript
against a WIT-defined interface and verifies an intentional type error. It is an
editor/compiler integration example, not a runtime WIT loader or an application
shell. Editor interaction also requires the documented extension and trust choice.

## Foundation for a future interactive shell

The browser counter is the best starting point here for a future Wizard Tower
shell: it already separates application input/state, typed operations, renderer
selection and scoped shutdown. Extend those application boundaries first. It does
**not** implement Wizard Tower, an engine, ECS, GPU rendering, frame timing,
spatial input or game persistence. The lifecycle monitor complements it when
adding long-running services; the WIT editor does not replace its UI foundation.

## Rust and Windows application behavior

The [Rust/native guide](native.md) runs the existing Component starter headlessly:
count changes, an asynchronous timer, read-only write denial and an explicitly
writable note. It also explains the separate desktop bundle and visible-window
route. This legacy application is not the new native-kit bridge.

Browser or headless success does not establish Tao/Wry pointer/keyboard behavior.
See the [support matrix](support.md) and [compatibility guide](compatibility.md)
before choosing a native profile.
