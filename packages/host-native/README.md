# @loop-kit/host-native

The official Rust native kit (initial desktop adapter: **Windows only**): Wasmtime 48 owns Components, Tao/Wry owns the window, and an explicitly selected trusted Bun application can supply ordinary TS providers through a checked semantic surface bridge. No native framework or process API enters portable TS consumers.

```ts
import { native } from "@loop-kit/host-native";
const kit = native(); // native-ts profile; selection starts nothing
const components = native({ profile: "components" });
```

`connectNativeSurface({ transport, epoch, signal })` connects an injected process transport to the public `Surface` contract. Await `ready` before rendering; cancellation before readiness rejects with code `E_CANCELLED`. The coordinator owns spawning/supervision; `dispose()` closes pending event reads immediately, then awaits the backend's closed receipt and process termination. Repeat disposal shares one completion. Restart needs a fresh process, epoch, host and profile directory. Trusted TS providers retain same-user host authority; this bridge is not their sandbox.

The bridge uses u32-LE UTF-8 JSON (1 MiB/frame, 16 queued sends, 8 MiB queued bytes). Messages carry the exact epoch; malformed/stale traffic fails closed. UI frames are limited to 64 KiB and the public frame/event validator. The initial native presentation subset is column, row, text, button, input, toggle and select; unsupported elements/fields reject, never silently disappear. Navigation, popups and network content are denied. Production enables no debugging port.

The Rust `document_runtime` module retains the separate async `loop:document-tool/documents@0.1.0` profile and semantic UI extension. It checks artifact bytes, nominal imports and ABI, generation/rights on every use, delayed reads/CAS commits, budgets and serialized guest entry. Wasmtime's hostcall fuel caps aggregate canonical encoded guest-to-host lifting at 2,097,664 bytes **before decoding/allocation** (UTF-16 needs a distinct encoded-byte allowance). UTF-8 source fields are separately capped at 1 MiB before storage, frames at 64 KiB before JSON parsing, and results at 1 MiB + 256 bytes. At most 16 document calls and one surface event read may be pending; frames advance from revision zero consecutively. Cancellation is not rollback. Traps/timeouts poison the store; fuel bounds non-yielding guests, while the owning process supervisor supplies the hard shutdown deadline. Storage and presentation remain injected inward ports.

Checks: `bun test packages/host-native/test`; `bun run repo verify host-native`. Real native interaction, same-byte Component conformance and relocated CLI acceptance require their separate receipts; unit tests alone prove none of these.
