# @loop-kit/host

Portable capability resolution and deterministic resource ownership. Depends only
on `@loop-kit/capabilities`; works without Station, a DOM or a native host.
Factories receive explicit dependency objects. The host manages their lifetimes,
not application permissions, script execution or UI rendering.

```ts
import { defineCapability } from "@loop-kit/capabilities";
import { createHost } from "@loop-kit/host";

const clock = defineCapability<{ now(): number }>({ id: "loop:time/clock", version: "1.0.0" });
await using host = createHost();
host.define(clock, { name: "Clock", description: "Unix wall time in milliseconds." });
host.provide(clock, { create: () => ({ now: Date.now }) });
await using request = host.scope({ name: "Request" });
await using handle = await request.acquire(clock);
console.log(handle.value.now());
```

Scopes own child scopes, tasks, acquisitions and arbitrary disposable resources.
Revocation synchronously cancels descendants, joins tasks and pending creation,
then completes child cleanup before sequential LIFO parent cleanup. Cleanup is
idempotent and continues after failures; callers must await it. Cancellation is
cooperative: work that ignores its signal and never settles can delay disposal.

Acquisition is independent by default. `{ lifetime: "shared" }` coalesces concurrent
acquisitions into one resource generation; only final-ticket release disposes it.
`handle.retain(scope)` adds ownership, `transferTo(scope)` moves it, and `borrow()`
creates a non-owning view. `host.start(..., { serviceId })` eagerly pins a shared
service. `scope.bind(capability, serviceId)` captures exact named resolution for
injection. Removal invalidates all dependent tickets; replacements affect future
acquisitions, with no implicit rebinding or fallback to a default provider.

`inspect()` returns cached, deeply immutable diagnostic snapshots; `subscribe()`
coalesces notifications in a microtask. Definitions, provider activation, services,
scopes, resources, bindings, tasks and pending/active/releasing acquisitions contain
no service values, raw errors or authority. Names and registration grant nothing.

See [lifecycle semantics and five examples](LIFECYCLE.md) and the independently
packed [timer monitor application](../../examples/lifecycle-monitor/README.md).
`await using` works on host/scope/lease/registration/task/service; sync disposable
values use `scope.own(value)` or `createResourceOwner().use(value)` with `await using`.
Native `DisposableStack` / `AsyncDisposableStack` can consume those same protocols;
the host itself needs no global stack implementation.

## Renderer-free host kit

`headless()` is an inert versioned kit factory for trusted TypeScript applications:

```ts
import { defineConfig, headless } from '@loop-kit/host';
export default defineConfig({
  schemaVersion: 1, source: { manifest: './loop.package.json' },
  targets: [{ id: 'bot', kit: headless(), application: { specifier: './app.ts', export: 'start' } }],
});
```

The application exports `start(context: HeadlessApplicationContext)` and receives a
fresh host, root scope and cancellation signal. Register resources with that scope;
return after initialization rather than awaiting the entire service lifetime.
`bootstrapHeadless` validates provider registration receipts and unwinds failed
startup. Each launch is independent. Trusted modules are not sandboxed and ignored
cancellation can delay shutdown. No renderer, guest imports or network grants are
provided. Source-built CLI run/dev/stop/restart support this profile; headless dev
currently has no source watching and standalone build fails explicitly.

Compatibility: IDs, exact versions, default/named resolution, lazy independent
creation and explicit `Provider.dispose` precedence remain. `value` now checks the
lease before returning the raw service. Extracted JavaScript references still
require provider-side cooperative checks. Lease `signal` tracks the consumer;
`resourceSignal` equals `ProviderContext.signal` and follows final ownership.
`toLegacyHandle(handle)` explicitly restores the old raw-value/provider-signal
view. Snapshots add readonly metadata; existing fields retain their meanings.
Use TypeScript 5.5+ with disposable symbols supported by the runtime (or an
application-installed standards-compatible symbol polyfill).

