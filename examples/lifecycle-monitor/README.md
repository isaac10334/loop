# Standalone lifecycle monitor

This application measures real timer latency. It consumes public tarballs of
`@loop-kit/capabilities`, `@loop-kit/host` and `@loop-kit/ui`, outside the workspace
package graph. No Station, private imports, local links or native runtime.

From the Loop checkout:

```sh
bun examples/lifecycle-monitor/setup.ts
bun examples/lifecycle-monitor/cli.ts
bun examples/lifecycle-monitor/serve.ts
```

Open `http://127.0.0.1:43881/` and click **Run monitoring session**. Setup builds and
packs capabilities/host/ui, then installs them into the independent example. Repeat
setup after source edits; the example deliberately runs packed bytes, not live source.
Setup uses content-addressed tarballs and verifies every installed dist byte against the build. Local tarball overrides prevent unpublished transitive dependencies going to npm.

The composition root creates clock, timer sampler and shared journal capabilities.
`createMonitor({ sampler, journal, surface })` receives narrow ports and uses the
existing semantic UI recording adapter. Each run collects eight actual readings,
replaces the 10ms sampler with a 20ms sampler, cancels an active collection, retains
the journal across collector shutdown, then disposes the entire application.
The assertions require one journal cleanup and zero remaining scopes/services.
Timer overshoot varies by operating system and load; no latency budget is asserted.

Validation commands (from this directory):

```sh
bun test monitor.test.ts
bun ../../node_modules/typescript/bin/tsc -p tsconfig.json
bun build cli.ts --target=node --outfile=dist/cli.mjs
node dist/cli.mjs
```

The browser is an intentionally plain acceptance harness. Its output and error
handling make the actual runtime workflow reviewable. It does not demonstrate a
Station renderer, sandboxed scripting, network providers or installed native code.

