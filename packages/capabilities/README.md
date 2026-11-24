# @loop-kit/capabilities

Small runtime identities for typed service contracts. No host or platform dependency.

```ts
import { defineCapability } from "@loop-kit/capabilities";

interface Clock { now(): number }
export const clock = defineCapability<Clock>({ id: "loop:time/clock", version: "1.0.0" });
```

`Capability<T>` associates the service type with immutable `{ id, version }` data. `defineCapability<T>` validates a namespaced ID and nonempty version. Identical ID and version values represent the same runtime contract even when defined in different modules. The TypeScript type is erased: authors must coordinate the actual contract and version, and the package does not validate implementation objects.

Optional `methods` describe named input/output schemas, effects and subscriptions as immutable portable data. `defineCapability` bounds method names/counts and copies descriptors; host applications built on Loop Kit validate the schema vocabulary and enforce resource policy. Descriptors never grant authority or validate implementation functions automatically.

Public root exports: `defineCapability` and its public descriptor/identity types. No package dependencies. Private source subpaths are not supported.

These immutable descriptors own no resources; implementation lifetime and authority belong to the host.

Verify from the repository root with `bun run repo verify capabilities`; `bun run repo context capabilities --json` prints ownership, dependencies and entrypoints. `bun run watch` refreshes linked JavaScript and declarations after source edits.
