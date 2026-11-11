# Languages and runtime compatibility

Loop Kit's multilingual intent has three distinct parts. A language that can compile WebAssembly is not automatically supported by every Loop profile.

| Role | Current route | Status and restriction |
| --- | --- | --- |
| Application/host composition | TypeScript in browser; trusted TS/Bun in native composition | Source/packed-preview supported. Browser entries must not import Bun-only providers. |
| Native runtime/provider implementation | Rust host using Wasmtime 48 and Tao/Wry | Windows presentation initially; applications supply storage through explicit host APIs. |
| Guest Components | Authored Rust fixtures for the async document/semantic profiles | Experimental browser/native path; exact world, artifact and grants required. |
| Legacy guest applications | Rust and TypeScript templates for the legacy application worlds | Different worlds; TS synchronous ABI is not equivalent to the async document profile. |
| Other guest languages | Must produce the exact required Component world and ownership behavior | Untested until an authored guest passes the relevant runtime and denial checks. |
| Ordinary native SDKs | Existing TypeScript APIs, Rust host APIs | Language-specific implementations; they are not interchangeable generated bindings. |

## Browser execution

The official browser kit supports ordinary TypeScript composition. The separate Polyengine 0.6.7 worker adapter runs reviewed document/semantic Components. Worker disposal terminates guest execution, but trusted host callbacks must still honor cancellation.

Decoded field/message limits are implemented. **Canonical ABI pre-lift allocation limits are not enforced by Polyengine's public API.** Do not use decoded validation as evidence that a hostile guest cannot allocate before decoding. Chrome and Edge receipts do not establish other browser engines or WebView2 acceptance.

## Native execution

Wasmtime owns guest resources and checks imports, grants and budgets. Tao/Wry owns window presentation. The first native subset is column, row, text, button, input, toggle and select. Unsupported elements/fields reject rather than disappearing. Windows close, input and event-loop behavior require real native-window verification; a headless fake only tests framing/lifecycle.

Native predecode fuel budgeting and browser decoded checks are not equivalent guarantees. A grant may be revoked while a supported implementation remains installed. Cancellation cannot roll back a committed document write.

## Version identities

npm versions, Rust crate versions, kit/profile IDs, WIT package versions and application config schema versions have separate jobs. Matching one does not establish the rest. Public imports use package roots; private source paths and copied implementation files are not supported APIs.

Consult the [support catalog](support.md) for per-capability implementation, authority and evidence.
