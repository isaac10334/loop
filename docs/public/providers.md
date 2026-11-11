# Consume a capability and implement a provider

Use the same capability definition at the provider and consumer boundary. Keep composition in trusted host code; an application should receive the host it will use rather than discover a global registry.

## A complete TypeScript service

This standalone SDK example runs with the reviewed `capabilities` and `host` packs. In a kit application, use its supplied host and scope instead of creating a second host.

```ts
import { defineCapability } from '@loop-kit/capabilities';
import { createHost } from '@loop-kit/host';

const counter = defineCapability<{ increment(): number }>({
  id: 'example:counter/value', version: '1.0.0',
});
await using host = createHost();
host.provide(counter, {
  create: () => {
    let count = 0;
    return { increment: () => ++count };
  },
});
await using scope = host.scope({ name: 'Counter application' });
await using lease = await scope.acquire(counter);
console.log(lease.value.increment()); // 1
console.log(lease.value.increment()); // 2
```

Each acquisition is independent by default. Use an explicitly named/shared service only when consumers should share a resource generation; do not silently switch to a singleton. Await release/disposal, including failure paths.

## Compose a provider into a kit

The [quick start](quickstart.md) uses a named counter provider in an application runtime module. Its config declares the contribution, the module registers it, and the application acquires the declared identity through its supplied scope. Change that provider to vary application behavior without replacing the renderer or kit.

A runtime module exports `setup({ host, scope, signal, options, ports })`; the application exports `start({ host, scope, surface, signal })`. The browser bootstrap checks declared registrations against actual registrations. Browser modules must remain browser-safe. Coordinator/Bun code requires an explicit bridge and cannot be packed into static browser output.

## Authority and cleanup

A capability identity or registration is not a grant. If a provider reads a file, writes a document or invokes an external command, it must check caller authority at that operation. Keep policy bindings private to trusted code. A scope limits ownership, not arbitrary JavaScript behavior.

Register acquired resources with their owner before awaiting more initialization. Honor cancellation and await cleanup. Extracted JavaScript service references can outlive a lease unless the provider checks its signal; disposal cannot intercept those references or roll back a committed effect.

See the [host API](../../packages/host/README.md) for named services, bindings, leases and inspection, and [composition](composition.md) for kit extension.
