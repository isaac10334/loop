# Build applications with explicit capabilities

Loop Kit lets an application ask for a typed service, receive the provider its host selected, and release the resources it owns. Its host kits compose services, application startup and semantic UI into a browser or Windows desktop application.

Use it for an editor with scoped document access, a tool with replaceable storage, or an application shell whose controls should not depend on one renderer. You can start with ordinary TypeScript. A WebAssembly Component is an optional execution boundary, not a requirement for every service.

## Start with an application

The [browser quick start](quickstart.md) builds a small counter tool with a labeled input, keyboard/pointer controls and a developer-defined provider. It uses the official browser kit and DOM renderer. The [examples](examples.md) show where to change state, composition and cleanup.

An application borrows a composed host, scope and surface. A provider owns service state; a scope owns acquisitions; the kit owns startup and shutdown. Closing one instance must not stop a sibling instance.

## What Loop Kit does—and does not do

- **Typed capabilities:** exact identity/version matching, explicit provider registration and acquisition.
- **Resource ownership:** scopes, leases, cancellation signals and awaited disposal.
- **Semantic UI:** revisioned frames and events mapped to native DOM controls or a restricted Windows presentation subset.
- **Component execution:** reviewed document profiles with explicit host-issued grants; browser and native limits differ.

Loop Kit is not a game engine, a CSS framework, a permission system for arbitrary JavaScript, or a universal Component launcher. Trusted configuration and TypeScript providers execute with host authority. Guest imports and resource operations need concrete host authorization.

## Developer preview

The working browser/host-kit implementation is currently a **source-build and reviewed-pack preview**, not an npm installation promise. The public Windows CLI release is older and does not establish support for the new config commands. See [installation](installation.md), the [support matrix](support.md) and [language compatibility](compatibility.md) before selecting a runtime.

Continue with [concepts](concepts.md) for the ownership model, or [composition](composition.md) to extend an application without replacing its host.
