---
title: Knowledge tooling evaluation
type: research
status: stable
created: 2026-11-19
last_updated: 2026-11-19
summary: Pinned knowledge-wiki adoption, reused upstream skills and complementary offline Markdown validation, with limits.
repos: [loop]
systems: [knowledge, DSH, Markdown]
related: ["[[reference/knowledge-system|Living knowledge operations and DSH skills]]"]
---

# Knowledge tooling evaluation

## Decision

Adopt [knowledge-wiki](https://github.com/lfreeman/knowledge-wiki/tree/126bfe6cc60ce3bd38c0600fc93525c174ee897b),
version 0.1.0 at revision `126bfe6cc60ce3bd38c0600fc93525c174ee897b`, for a **small
repository-local pointer vault**. Existing documents retain their owners; the tool
supplies search, frontmatter, wikilink/backlink generation, orphan/stale checks and
gaps. No database, server, embedding service or bespoke indexing engine is added.

Review covered the CLI dispatcher, config, schema/parser, index, search, lint,
adopt implementation, bundled skills and tests. The local adapter runs its console
entrypoint with explicit `KB_VAULT`, `KB_CONFIG_DIR` and `KB_REPO_ROOT` under this
checkout; it never invokes global initialization or Claude skill installation.
Dependencies install only on explicit `bun run knowledge setup`, in an ignored venv.
Python 3.13+ is an additional contributor/CI requirement, not an SDK/runtime dependency.
The pinned dependencies are listed in [requirements](../../tooling/knowledge-requirements.txt).

## Why not adopt the whole layout?

Upstream is a young personal knowledge tool with a fixed vocabulary and Claude
assumptions. Its schema text asks for absolute reference paths, while its actual
`lint._reference` resolves relative paths against the vault. We use tested relative
paths for checkout portability. It does not validate ordinary Markdown links or
heading fragments. Backlinks only include recognized vault wikilinks; they are not
a global repository graph. Lexical/stemmed search ranks candidates; agents must
still search synonyms and read sources to decide semantic equivalence.

The [upstream skills](../../skills/knowledge-wiki/README.md) are retained unmodified
as procedure resources, not directly registered triggers: capture explicitly
excludes repository docs, assumes `kb` on PATH and reads Claude personal transcripts.
The [Loop skill](../../.agents/skills/loop-knowledge/SKILL.md) overrides those
assumptions and reuses search-before-create, classification, update-in-place,
reference-not-copy, reciprocal relationships and post-write checks. The
[audit skill](../../.agents/skills/loop-knowledge-audit/SKILL.md) reuses gap review
without treating personal learning or a gap inbox as shared engineering tasks.
Upgrades require rechecking schema, output rendering, relative pointers and skills.

## Complementary tools

- Adopt [remark-validate-links](https://github.com/remarkjs/remark-validate-links)
  with remark-cli and GFM. The CLI checks cross-file headings using a shared
  repository transform; the standalone API does not provide that guarantee.
  It checks ordinary local file/image/reference links and anchors without HTTP.
  GitHub source-line fragments are allowed, not verified as semantic evidence.
- Adopt [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) with a
  small structural rule set for the new knowledge surface. Do not mass-format
  historical docs or turn line length/list styling into this project's migration.
- Evaluate [lychee](https://github.com/lycheeverse/lychee) as a capable future
  external URL auditor. Do not install another native binary or put network
  availability/rate limits/authenticated links into a deterministic PR gate.
  External URL health remains an explicit separate maintenance check.

## Honest limits

A date warning is not proof of falsehood, and fresh metadata is not proof of truth.
Historical evidence must not be retouched to imply current acceptance. Structural
checks cannot detect conflicting prose or prove runtime behavior. Agent semantic
review is bounded by affected paths and the question being investigated. DSH skill
compatibility and the initial acceptance run are recorded in
[operations](../../docs/reference/knowledge.md); that receipt, not a file's presence,
establishes what was actually invoked.
