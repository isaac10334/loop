# Customize composition and extend a host kit

Start by configuring an existing kit. Create a custom kit only when you need different runtime ownership or adapters, not merely a new application template.

## Select an application, provider and renderer

```ts
import { defineConfig } from '@loop-kit/host';
import { browser } from '@loop-kit/host-browser';
import { semanticDom } from '@loop-kit/renderer-dom';

export default defineConfig({
  schemaVersion: 1,
  source: { manifest: './loop.package.json' },
  targets: [{
    id: 'web', kit: browser(),
    application: { specifier: './src/app.ts', export: 'start' },
    plugins: [semanticDom({ key: 'dom', root: '#app' })],
  }],
});
```

The application module, source inventory and frozen dependency lock must exist before evaluation. The [quick start](quickstart.md) supplies a complete project; this snippet only shows composition shape. Config is executable trusted code. Static inspect does not import it; evaluation/run/build require explicit local trust.

A renderer plugin maps supported semantic elements. Selecting DOM rendering does not give a guest arbitrary DOM access. Likewise, choosing a native kit does not grant windows, files or network through a portable API.

## Add behavior without replacing the kit

Use a runtime contribution for providers and an explicit plugin for rendering. Keep browser code separate from coordinator/Bun modules; do not serialize closures across realms. The [provider guide](providers.md) and [examples](examples.md) show the small service boundary.

Keep the kit's borrowed host/scope/surface in the application. If an application creates a second host, its providers and cleanup are no longer owned by the composed instance.

## When a custom kit is justified

The counter example retains an optional custom-kit route with its own identity, runtime contribution and coordinator hooks. Use that route to study extension rather than impersonating an official kit's ID.

A kit adapter must declare supported profiles and runtime modules; construct fresh instance ownership; validate its actual provider/renderer registrations; unwind partial startup; and make stop/repeated-stop await the same cleanup. Test two concurrent instances and stop one while continuing to use the other. Declare unsupported platforms and elements rather than silently dropping behavior.

Portable contracts belong in existing packages. Native process supervision stays in the native integration, DOM mapping in the renderer, and CLI trust/build/endpoint orchestration in the CLI. Ordinary TypeScript APIs do not need matching Rust crates. Introduce WIT only for a real language-neutral guest/host ABI.

Consult the public [browser kit](../../packages/host-browser/README.md), [native kit](../../packages/host-native/README.md) and [DOM renderer](../../packages/renderer-dom/README.md) APIs before adding a new adapter. The [support catalog](support.md) separates implementation status from authority.
