# Build a browser counter

Run a small TypeScript application with an editable increment amount, keyboard and
pointer controls, and a provider that owns the count. The official browser kit
creates the host, injects the application scope and renders semantic UI through
the DOM adapter.

## Prerequisites

This is a **source-build and reviewed-pack preview**. Use Bun 1.3.14, npm, `tar`,
a browser and a current source-built Loop CLI. The published Windows CLI may not
have config-mode commands; follow [installation](installation.md) first. The
commands below use PowerShell from the Loop checkout root. They do not publish
packages or open a native window.

Obtain reviewed package tarballs and their checksum inventory using the
[release preparation instructions](../../RELEASING.md). The example needs
`@loop-kit/capabilities`, `host`, `host-browser`, `renderer-dom` and `ui`, all at
0.1.0. Do not substitute workspace links or assume these versions are on npm.

## Prepare a standalone application

Choose a **new, absent** output directory outside the checkout:

```powershell
$output = Join-Path $env:TEMP ('loop-counter-' + [guid]::NewGuid())
bun examples/host-kits/custom-provider/prepare-fixture.ts target/npm-pack $output
$consumer = Join-Path $output 'consumer'
```

The preparer inspects the five public package archives, copies their exact bytes,
records SHA-256 hashes and installs offline with lifecycle scripts disabled. Only
the generated consumer receives relative tarball pins and lockfiles. An existing
output directory is refused rather than overwritten.

## Inspect, run and stop

```powershell
$loop = './target/debug/loop.exe'
& $loop inspect $consumer --json
& $loop inspect $consumer --evaluate-config --config official.config.ts --trust-local-config --target counter --json
& $loop dev $consumer --config official.config.ts --trust-local-config --target counter --instance counter-demo --json
```

The first inspection does not execute config. The next two commands explicitly
trust executable local config, which has same-user host authority; this is not a
sandbox. Open the **reported loopback origin**. It uses an allocated port, not a
fixed URL.

Click **Increment**: `Count: 0` becomes `Count: 1`. Change the labeled amount to
`5`, then leave the input to commit its change. Activate the button with Enter or
Space to add five. An amount of `0`, a fraction or text disables the button and
shows validation feedback. The provider also rejects invalid direct calls.

From another terminal, set the same `$consumer` and stop the named instance:

```powershell
& ./target/debug/loop.exe stop counter-demo --root $consumer --json
```

Stop waits for the application task and provider cleanup and clears the rendered
surface. A new launch starts at zero; the example does not persist state.

## Build static output

After stopping the development instance:

```powershell
& $loop build $consumer --config official.config.ts --trust-local-config --target counter --json
```

Serve the reported `dist/counter` directory with your static HTTP server. Its HTML
and JavaScript can be moved together; the browser does not need the source checkout
or Bun coordinator at runtime.

## Change the application

In the prepared consumer, edit `app.ts` for semantic frames and input handling,
`counter-provider.ts` for count state and operation validation, and
`official.config.ts` for explicit kit/provider/renderer composition. The app acquires
`example:counter/value` at exact version `1` and named service `primary`; neither
that identity nor an enabled button grants permission.

The kit owns the surface and closes event reads on shutdown. The application owns
its event task through the injected scope; it does not create a second host or
dispose the borrowed surface. Continue with [examples](examples.md) for source
entry points and the optional custom-kit extension.
