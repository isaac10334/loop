# WIT tooling fixture

`editor.wit` exercises the WIT parser, declarations and TS7.1 content mapper.
Its synchronous SVG document world is a test/example input, not Loop's selected
standard document API. Preserve its `loop:svg-editor@0.1.0` identity while tests
and the direct-WIT example consume it. The proposed async replacement has a
[separate spec](../../../specs/async-document-runtime.md).

```powershell
bun run contracts:generate
bun run contracts:check
bun examples/wit-editor/check.ts
```

Pinned jco uses its Rust WIT parser on Node/V8. Receipts retain source and generated
declaration identity; they are not JSON Schema or a runtime ABI. The content
mapper accepts valid arguments, rejects invalid calls and reports parser errors.
It supports one standalone WIT file and explicit world selection. Its synthesized
span map does not support precise WIT navigation/rename. Real editor completion
still needs separate acceptance. Generated jco resource bindings need an explicit
adapter for another runtime such as Polyengine.

See the [editable example](../../../examples/wit-editor/README.md) for compiler
registration and trust requirements. A mapper executes code; it is not passive
type metadata. Runtime applications do not load this fixture through the mapper.
