# Loop documentation

For application development, start with the [public overview](public/overview.md),
[browser quick start](public/quickstart.md), [installation](public/installation.md)
and [support catalog](public/support.md). These are the source/packed preview docs;
public release availability is labeled separately.

The index below is for contributors and internal engineering. Package READMEs and
TSDoc describe source APIs; specifications describe proposed obligations. Only the
explicit allowlist in `site/content.ts` is published. Internal Markdown stays here,
but is excluded from site pages, navigation, search, sitemaps and agent exports.

| Need | Read |
| --- | --- |
| Try a working package/editor | [Portable development](portable-development.md), [WIT editor example](../examples/wit-editor/README.md) |
| Use the current CLI | [CLI commands and workflow](cli.md), [Windows setup](../crates/loop-cli/WINDOWS.md) |
| Reproduce native execution | [Windows desktop proof](windows-desktop-proof.md) |
| Implement the next slice | [Development alpha](development-alpha/README.md), [specifications](../specs/README.md) |
| Understand source-build host kits, providers and acceptance limits | [System guide](host-kits.md), [Rust/Electrobun backends](reference/desktop-hosts.md), [contract](../specs/host-kits.md), [project/help proposals](../specs/host-kits-examples.md) |
| Review host-kit evidence and agent skill delivery | [November audit](development-alpha/host-kits-evidence.md), [skill contract](../specs/host-kits.md#8-repo-skill-and-optional-data-driven-installation) |
| Understand runtime terms and limits | [Runtime reference](reference/runtime.md) |
| Understand accounts and distribution | [Identity and distribution](reference/identity-and-distribution.md) |
| Coordinate agents and tasks | [Agent workflow](reference/agent-workflow.md), [task prompts](development-alpha/prompts.md) |
| Check package/layer ownership | [Architecture](../ARCHITECTURE.md), [local evidence ledger](../ENGINEERING_PLAN.md) |
| Prepare releases | [Release workflow](../RELEASING.md) |

Dates on evidence pages identify those runs. They do not establish acceptance of
later edits. Keep actual results in the existing engineering ledgers and link the
receipts. Record unresolved decisions in the root `QUESTIONS.md`.

The alpha guide routes runtime/development gates and the supporting host-kit and
Station-adoption contracts through the specification index. Its former runtime,
local-development, cloud-and-identity and repo-and-agent-map pages were merged
into those owner specifications and the two references above.
