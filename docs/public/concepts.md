# Concepts

## Applications and host kits

An **application** exports startup behavior. A **host kit** supplies a versioned runtime integration: supported profiles, composition, presentation and startup/shutdown. A **target** selects a kit and entry point in trusted config. An **instance** is one launch, with fresh mutable state and resource ownership.

The official browser kit runs browser-safe TypeScript and maps semantic UI to DOM controls. The native kit uses Rust/Wasmtime and Tao/Wry; a selected trusted Bun application may supply TypeScript providers through the native surface bridge. That bridge is not a JavaScript sandbox.

## Capabilities, contracts and providers

A **capability** associates an exact identity and version with a service type. A **provider** implements that service. The host registers providers; applications acquire them through scopes. Structural type compatibility does not replace identity matching.

```ts
import { defineCapability } from '@loop-kit/capabilities';
interface Clock { now(): number }
const clock = defineCapability<Clock>({ id: 'example:time/clock', version: '1.0.0' });
```

This definition creates neither an implementation nor access rights. [Consume and implement a provider](providers.md) shows the remaining steps.

**WIT contracts** describe language-neutral Component imports/exports and resource ownership. Use them when guest and host languages cross an ABI boundary. Ordinary TypeScript factories, config callbacks and DOM adapters remain TypeScript APIs; they need no matching Rust crate or WIT world.

## Semantic UI and Components

A semantic **surface** accepts keyed, revisioned frames and yields ordered events. A renderer maps supported elements to a platform. A stable key identifies a control; it is not an authority token. The DOM renderer uses real buttons, inputs and selects so browser keyboard behavior remains available.

A **WebAssembly Component** is executable Component Model bytes with declared imports and exports. It is not a React component. The host must verify the selected world/profile and supply only reviewed, granted imports. The current document profile is specific; loading arbitrary worlds or claiming every guest language works is unsupported.

## Grants and support are separate

A supported document API still requires a grant. A grant identifies a principal, rights and generation; the provider checks them on each use. A support matrix answers whether an implementation exists on a platform. It never authorizes its use.

Likewise, portable semantic input does not imply access to raw DOM, global keyboard capture, native windows, files or network. Those are platform integrations with their own authority and lifetime.

## Resources, scopes and disposal

Providers own acquired resources and register cleanup during acquisition. Scopes group leases and tasks. Revoking a scope aborts cooperative work and awaits cleanup; disposing a parent also disposes its owned children. A borrowed application surface belongs to the kit and must not be independently disposed by the application.

Ordinary JavaScript can ignore cancellation. A scope cannot intercept arbitrary service values or undo an already committed write. Component worker termination and native process supervision have different enforcement properties; see [compatibility](compatibility.md).
