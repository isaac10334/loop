# TypeScript package notes

Name public packages `@loop-kit/<focused-contract-or-runtime>`. Keep dependencies light and compatible with browser, Bun and Node-compatible ESM where practical; do not add platform APIs to `capabilities`.

Export through package root only. Emit ESM JavaScript and declarations into `dist`; expose no source subpaths. Make npm package types excellent for agents coding against a linked or installed package: keep inferred and explicit public signatures clear, add TSDoc to exported symbols and important members, and describe ownership, lifecycle, cancellation, errors, and limitations. Start public modules with a short purpose comment and, when useful, a compact example. Keep each package's README tiny: explain its mental model and show one or two runnable examples. Test real behavior and type inference.

Keep `package.json` entry points, `exports`, and `files` aligned with build output. Ship declaration maps and the source files they reference so editor navigation works after `bun link` and after publishing. Check the packed contents and resolve the package from an outside consumer when changing packaging. Bun is the workspace package manager, build runner, and test runner.

Do not create vague `core`, `common`, or `utils` dumping grounds. Make all lifecycle and revocation semantics explicit; do not imply arbitrary JS objects are secured after cancellation.
