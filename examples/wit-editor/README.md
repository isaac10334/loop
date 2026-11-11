# Edit TypeScript against WIT

This persistent example imports the original
[`editor.wit`](../../tooling/fixtures/wit/editor.wit), rather than a handwritten
TypeScript interface or copied contract. It uses the root's pinned TypeScript
7.1 Beta and official jco WIT parser. This synchronous SVG world is a tooling
fixture, not the proposed standard document API.

From the Loop checkout root, after `bun install --frozen-lockfile`:

```powershell
bun examples/wit-editor/check.ts
```

The command registers the mapper in this example's ignored `node_modules`, checks
`valid.ts`, then checks that `invalid.ts` is rejected with TS2345. It exits zero
only when both outcomes are correct. No generated absolute machine paths are
committed. Re-run after moving the checkout or reinstalling dependencies.

```powershell
# Register for your editor without compiling.
bun examples/wit-editor/check.ts --setup

# Display the deliberate compiler error and exit nonzero.
bun examples/wit-editor/check.ts --invalid
```

Open **this example directory** in VS Code with Microsoft's TypeScript 7 extension
enabled. The included settings select the root's pinned native compiler and enable
content mappers. Trust the workspace and approve the editor's content-mapper
execution prompt: a mapper is an executable, not passive type metadata. These
settings do not bypass either approval. The CLI makes the same execution choice
explicitly through `--runExternalCode`.

Open `valid.ts`, inspect `Document`, and request completion after `document.`.
`read()` returns `{ revision: string; source: string }`; `write()` requires two
strings. Change a call to pass a numeric revision to see the consumer diagnostic,
or edit the WIT and rebuild to see changed bindings. `invalid.ts` is an intentional
negative fixture checked with `tsconfig.invalid.json`; the normal project contains
only `valid.ts`.

This is a development-tool proof, not a runtime `.wit` loader. Use type-only
imports. Generated declarations use jco's resource/result conventions, which need
an explicit adapter when used with another runtime such as Polyengine. The mapper
supports this standalone WIT file and explicit world option. Virtual TypeScript
has synthesized spans: precise navigation/rename into WIT and WIT syntax completion
are not implemented. CLI checking is verified; VS Code interaction requires your
editor extension and trust decisions and is not claimed as automated UI acceptance.
