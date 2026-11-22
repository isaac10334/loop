# @loop-kit/component-polyengine

Two explicit adapters share pinned Polyengine 0.6.7: the document/semantic profile
below and import-free string-call Components. Neither automatically registers a
capability provider or grants host authority.

## Import-free Components

Bundle a dedicated module worker calling `installPureComponentWorker()` from this
public root. `createPureComponentSession({workerUrl, componentBytes, translation,
artifact, exports, signal?})` accepts reviewed prepared translation/adapters and
exact component SHA-256, translation SHA-256 and world digest pins. Before
instantiation, the worker verifies those pins and rejects **all host imports**.
`exports` is an explicit allowlist of root functions; there is no WASI shim,
filesystem, clock, network, GPU or document provider.

`session.call(name, args)` accepts up to 16 finite numeric, boolean or string
arguments and returns a string. Calls serialize by rejecting concurrent entry;
they do not queue or retry. A trusted application adapter owns WIT-specific shapes
and any JSON checkpoint schema. Defaults: 2 MiB decoded argument/result budget
(configurable 1 byte–4 MiB), 15 s initialization/call deadline (1–30000 ms), and
32 MiB component bytes. Prepared plan/adapter bounds are also checked by
`translationSha256`. Output checks occur **after canonical lifting**, not before
allocation inside the engine; this is not a hostile-memory conformance claim.

`dispose()` synchronously terminates the worker and rejects pending initialization
or calls. Repeated disposal shares completion. Abort, trap, malformed/stale messages
and deadlines poison the session; create a new one and restore a known checkpoint
rather than retrying an operation of uncertain completion. `inspect()` exposes only
closed/worker/pending-call counts. Caller-owned pins bind reviewed bytes, not
publisher authenticity or translator correctness. Tests include mocked-worker
lifecycle/denial cases; real guest execution needs a separate host acceptance lane.

## Document/semantic Components

Dedicated Polyengine 0.6.7 workers run the reviewed async document profile or its
separate semantic extension. One session owns one worker and one serialized guest
entry. No filesystem, network, environment, document lookup or ambient grant is
provided; emitted unused WASI imports have exact denying providers.

```ts
import { createDocumentOwner } from '@loop-kit/component-polyengine';
const owner = createDocumentOwner({ source: 'hello', authorize: principal => principal === 'author' });
const grant = owner.issue({ principal: 'author', read: true, write: true });
const signal = new AbortController().signal;
await owner.write(grant, '0', 'edited', signal);
console.log((await owner.read(grant, signal)).source);
owner.dispose();
```

To run a Component, bundle a module worker that imports `installPolyengineWorker`
from this public package root and calls it once. Call `createPolyengineSession`
with its URL, verified `componentBytes`, expected artifact SHA-256/world digest,
profile (`document` or `semantic`), and a host-issued `{owner, grant}` binding.
Provide either explicitly prepared `translatorBytes` or reviewed build-time
`translation: {plan, adapters}` from the public `@polyengine/translator`
`defaultTranslator().translate(bytes)` API. Hash/pin that complete translation and
its adapters in the build receipt using the public `translationSha256(translation)`
helper, and supply that pin as `artifact.translationSha256` (required for prepared
translations). The worker verifies it before instantiation. A caller-supplied digest
alone is not proof of translation provenance or publisher authenticity. No private SDK asset path is an
API. `replaceText(from, to)` and semantic `run()` are async nominal borrowed entries;
concurrent entry rejects rather than queues. Never retain a borrowed resource.

Every operation rechecks principal, read/write rights and grant generation. Source
inputs are limited to 1 MiB UTF-8; decoded results allow 1 MiB plus 256 bytes for
metadata, matching the native host. Frames are limited to 64 KiB and pending host calls
to 16. These
checks guard decoded facade values and cross-worker messages, **not canonical ABI
pre-decode allocations**: Polyengine 0.6.7 exposes no public pre-lift byte-limit
hook. The hostile current guest proves an over-budget encoded string reaches
TextDecoder first. Decoded revisions over 128 UTF-8 bytes are rejected before
forwarding to the host; oversized error details and results are rejected before a second
UTF-8 allocation. Failure variants are shape- and size-checked on both sides; malformed
worker failures close the session. Invalid-source detail is limited to 64 KiB UTF-8,
matching the native host. Conflict snapshots use their individual field limits rather
than a JSON size limit: worker messages use structured clone, not JSON. The session
cannot undo a message clone already made by a worker.
Full hostile canonical-budget conformance remains open; pin reviewed artifacts and do not
advertise this adapter as passing that gate. CAS policy,
expected-revision comparison and commit are synchronous after asynchronous storage
work. Before-commit cancellation forbids commit; after-commit cancellation does not
roll it back. If a host write committed but stop/trap prevents its guest result,
`ComponentOutcomeUncertainError` reports the committed revision for reconciliation,
including when a malformed or oversized result arrives after a host write; never retry
that entry automatically. Host policy is trusted; plain scopes and
artifact IDs confer no authority.

A semantic session **takes ownership** of its dedicated `Surface`; do not share or
independently dispose it. Session disposal immediately aborts host calls, closes
surface reads and terminates its worker before joining trusted host work. Repeated
disposal returns the same completion, including cleanup failure. Trusted storage
callbacks must honor cancellation and settle: worker termination cannot terminate
main-thread JavaScript. Calls have a default 5 s hard worker deadline (configurable
1–30000 ms); `inspect()` reports actual worker/pending-call counts without grants.
The caller owns and closes document owners/grants; session disposal never revokes
unrelated sibling grants. A terminated/trapped session is not reusable.

Verify: `bun run repo verify component-polyengine`. For Chrome/public-root runtime
checks, build the `contracts/document-tool` artifacts and run
`bun tooling/host-browser/acceptance.ts`. These checks do not establish complete
hostile borrow/drop fuzzing or all-engine/WebView conformance.
