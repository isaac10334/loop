# Host lifecycle contract

Implemented semantics, 2026-10-20. These APIs own local JavaScript resources.
They are not a security membrane. A scope name, provider registration, retained
handle or binding never authorizes a caller. Check operations and resource grants
at the application's boundary. UI owns semantic descriptions/rendering contracts;
scripting owns execution and guest bindings. Neither responsibility moves here.

## Ownership and cancellation

- `host.scope({ parent })` and `scope.scope()` require an active same-host parent.
  Each scope has a synchronous cancellation signal and idempotent async revocation.
- `scope.own(value, cleanup?)` transfers cleanup responsibility to the scope. Do
  not give it a borrowed value that another owner will independently dispose.
  Explicit cleanup wins, then `Symbol.asyncDispose`, then `Symbol.dispose`; exactly
  one path runs. Plain values need no cleanup. Do not independently adopt the
  same disposable object twice: retain its lease instead.
- A lease is an ownership ticket. `retain(destination)` adds a ticket;
  `transferTo(destination)` creates a destination ticket then invalidates the
  source atomically. Both require an initialized, live source and an active scope
  of the same host. Invalid destinations leave source ownership intact.
- `borrow()` cannot release or retain. Its getter follows the source ticket and
  becomes invalid on transfer/release/revocation, even if another ticket survives.
  Reading any closed lease's `value` throws. Already extracted values/functions
  cannot be intercepted; providers should check their resource signal if needed.
- Lease signals abort individually. The resource signal aborts when every ticket
  is cancelled, or registration/host disposal forces revocation. Final release
  joins provider creation and disposal. Nonfinal release closes only that ticket.
  A cancelled pending shared consumer need not await another consumer's creation.
- Revocation caches its completion before dispatching abort events. Reentrant
  calls return that completion and cannot execute cleanup twice. Cleanup callbacks
  may request lifecycle shutdown, but must not await the shutdown that is currently
  waiting on that callback (a self-dependency would deadlock).

## Ordering and failures

Scope revocation closes admission first, cancels the entire descendant tree and
owned work synchronously, then joins child scopes, task bodies and pending resource
creation. Children finish before the parent disposes resources. Parent resources
close sequentially in reverse adoption order. A release explicitly requested before
revocation may already be running; revocation awaits it. Explicit provider removal
can revoke its resources independently of scope nesting.

Tasks own a child scope. Completing a task cancels and joins its remaining child
tasks before settling `result`. Each task's body errors belong to its `result`;
applications await child results to propagate their failures. Owner shutdown joins
actual work and reports cleanup failures, rather than rethrowing already-completed
body errors. `cancel()` aborts immediately and awaits completion; body cancellation
is read from `result`, while cleanup errors also reject `cancel()`/owner disposal.
Cancellation never races a task body against a timer and leaves that body detached.

Disposal attempts continue after errors. Scope/registration/host failures aggregate
all failed cleanup attempts. A single direct resource cleanup failure retains the
original error. Completed records are removed even if cleanup failed, and repeated
disposal returns the same rejected completion. A provider that never settles can
hold final cleanup open; deadlines request cancellation and do not force-kill JS.

## Provider and service generations

`provide` registers a default or explicitly named provider for an exact contract
version. Omitting `serviceId` selects only the default. An explicitly missing,
invalid or wrong-version named target never falls back to default or another name.

`activate()` runs optional registration startup once, shared by concurrent callers.
`acquire()` activates lazily. Startup failure is sticky for that registration; remove
it and register a replacement to retry. Activation's `resources` stack survives
individual acquisitions and closes after all resource generations during removal.
`ProviderContext.resources` owns each creation's partial initialization: failed
creation unwinds it, successful creation disposes its value first, then its stack.
Use small explicit factory dependencies; `context.scope` remains the initial
requesting scope for compatibility and is not the lifetime of a retained/shared
resource. Do not attach shared dependencies to that transient caller. Acquire and
retain dependencies in their explicit application owner and inject narrow ports,
or adopt independent resources into `context.resources`.

Independent registrations create per acquisition. Shared registrations create one
single-flight generation while tickets exist. After the final cancellation a new
acquisition can start a fresh generation while old cleanup finishes; providers must
support this overlap or the application must await release before reacquisition.
Initialization failure affects its pending tickets and allows a future generation.

`host.start` eagerly registers a named shared provider, pins a value, and returns a
running service with `stop()`. `options.owner` bounds its internal scope. Duplicate
names fail and clean the temporary scope. Stopping/revoking the owner unregisters
the service and invalidates every consumer. Unregister closes admission immediately,
allowing a replacement under the same identity while prior cleanup is still visible.
Existing tickets never silently point to a replacement. A binding's next `acquire()`
resolves the new registration. Replacement is explicit stop/remove, then register/start;
startup failure does not roll back to or implicitly select the previous provider.

## Tasks and inspection

`scope.task(run, { name, signal, timeout, deadline })` starts immediately, unless the
external signal is already cancelled or the deadline is expired. Timeout is finite
nonnegative milliseconds; deadline is finite Unix milliseconds; the earlier wins.
Completion clears timers and external listeners. Long deadlines are scheduled in
bounded timer intervals. Abort is synchronous; result settles only after body and
owned cleanup settle. Nest work through the task context's scope.

Snapshots are cached until a lifecycle mutation and deeply frozen, including nested
metadata arrays. Subscriptions are coalesced, removable and observer exceptions
cannot influence runtime results. Records show provider activation, shared lifetimes,
eager service state/owner scope, bindings, running/cancelling tasks, ownership tickets
and acquisition states. IDs are ephemeral; no completed history is retained. No raw
values, lifecycle methods, signals, errors, credentials or grants enter reflection.
`define` remains an independent documentation catalog retained until host disposal.

## Examples

Import `createHost` and `defineCapability` from their public package roots. The
standalone monitor composes all five cases with real timer I/O and packed artifacts.

### Temporary resource

```ts
await using host = createHost();
await using request = host.scope();
request.own({ [Symbol.dispose]() { console.log("file closed"); } });
// Or request.own(socket, socket => socket.close()) for an explicit adapter.
```

### Shared leased service

```ts
const counter = defineCapability<{ next(): number }>({ id: "example:app/counter", version: "1" });
await using host = createHost();
await using service = await host.start(counter, {
  create() { let value = 0; return { next: () => ++value }; },
}, { serviceId: "session" });
await using consumer = host.scope();
await using a = await consumer.bind(counter, "session").acquire();
await using b = a.retain(consumer);
console.log(a.value.next(), b.value.next()); // 1, 2; one shared instance
```

### Nested scope, borrowed view and ownership transfer

```ts
await using host = createHost();
await using app = host.scope({ name: "Application" });
const request = app.scope({ name: "Request" });
const result = request.own({ message: "ready" });
const borrowed = result.borrow();
const saved = result.transferTo(app);
// borrowed.value and result.value now throw; saved remains owned by app.
await request.revoke();
console.log(saved.value.message);
```

### Cancellable task

```ts
await using host = createHost();
await using app = host.scope();
const task = app.task(async ({ signal, scope }) => {
  scope.defer(() => console.log("request cleaned"));
  const response = await fetch("https://example.com", { signal });
  return response.text();
}, { timeout: 1000 });
try { console.log(await task.result); }
finally { await task.cancel(); }
// A parent task must await child.result when it wants to propagate child errors.
```

### Replaceable provider

```ts
await using host = createHost();
await using app = host.scope();
const counter = defineCapability<{ next(): number }>({ id: "example:app/counter", version: "1" });
const binding = app.bind(counter, "active");
const old = host.provide(counter, { create: () => ({ next: () => 1 }) }, { serviceId: "active" });
const lease = await binding.acquire();
await old.unregister(); // lease.signal aborts and lease.value throws
host.provide(counter, { create: () => ({ next: () => 2 }) }, { serviceId: "active" });
await using replacement = await binding.acquire();
console.log(replacement.value.next()); // 2
```

Compatibility adapter: `toLegacyHandle(lease)` captures the raw service value and
uses `lease.resourceSignal`, identical to `ProviderContext.signal`. Its `release`
closes the source lease. With no additional tickets its cancellation timing matches
the previous handle. With retained/shared ownership, that signal necessarily lasts
until final ownership ends; use the modern lease signal for consumer revocation.
