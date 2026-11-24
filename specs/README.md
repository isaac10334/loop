# Implementation specifications

Selected direction, October 30, 2026. These specifications describe proposed work;
the new async document profile, foreground development server and managed cloud
service have not passed their gates. Existing behavior belongs to
[ARCHITECTURE.md](../ARCHITECTURE.md) and package contracts.

| Order | Spec | Exit evidence |
| --- | --- | --- |
| Composition/design lane | [CLI host kits](host-kits.md), [proposed projects/help](host-kits-examples.md) | Explicit typed composition, trusted-config protocol, independent instances and optional skill catalog. Component application claims still require G1/G2. |
| 1 | [Async document runtime](async-document-runtime.md) | Same Rust Component bytes suspend on a granted document in browser and Wasmtime; denial/lifetime tests pass. |
| 2 | [Foreground development](foreground-development.md) | File edit/build/replace loop preserves its editor and rejects stale output. |
| 3 | [Cloud build](cloud-build.md) | One authenticated build survives worker restart, returns verified bytes and preserves tenant boundaries. |
| Supporting boundary | [Machine access and references](machine-access-and-references.md) | Scoped roots and reference resolution preserve identity, visibility and revocation. Implement only the operations the selected slice consumes. |

Each implementation starts with a reviewed baseline and assigns exact files after
`repo context`. Keep public WIT under `contracts/`, generated bindings under their
own source/tool receipts, and runtime-specific adapters behind public ports.

Use focused examples and generated inputs for policy/race invariants. For each
acceptance case, identify a realistic bad implementation it rejects. A small
mutation probe can establish that an important denial test would detect a missing
check; a blanket mutation-percentage target would not prove runtime correctness.

The [execution plan](../docs/development-alpha/execution-plan.md) sequences gates.
The integrator records
questions in root `QUESTIONS.md`, rather than forking decision lists across specs.
