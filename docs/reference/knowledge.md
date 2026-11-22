# Repository knowledge runbook

The knowledge vault is a small map into Loop's owned sources, not a second copy of
its documentation. Use it to find relevant owners and connect facts; keep each fact
in the document or system that already owns it. This runbook describes contributor
operations, not a new documentation authority.

## Where information belongs

- **Current architecture and APIs:** [architecture](../../ARCHITECTURE.md), package
  READMEs and TSDoc. Update the relevant owner when behavior changes.
- **Proposed contracts and work:** [specifications](../../specs/README.md). Keep
  proposals distinct from implemented behavior.
- **Decisions and open questions:** [decisions](../../DECISIONS.md) and
  [questions](../../QUESTIONS.md). Preserve the decision's rationale and status.
- **Dated evidence, experiments and engineering plan:**
  [engineering plan](../../ENGINEERING_PLAN.md) and its linked receipts. A date
  identifies the evidence run; it does not certify a later state.
- **External research:** cite its source and date in the relevant owner or pointer.
- **Operations and contributor workflow:** the applicable guide or reference under
  [docs](../README.md).
- **Shared coordination:** GitHub issues and PRs are the shared work record. Preserve
  the original authorization, attribution and claim boundaries. A knowledge pointer
  does not authorize publication, issue/PR creation or remote changes.

Use `knowledge/` for concise discovery pointers with enough context to route a reader
and a repository-relative `path` to the authoritative file. Do not mass-migrate
existing docs, duplicate their content, or create another task tracker. Use a gap
for missing knowledge or an unanswered question about what is known—not for an
implementation task, decision or product backlog item. Resolve those in their owners.

## Setup and commands

Run from the repository root with Bun. The wrapper in
[`tooling/knowledge.ts`](../../tooling/knowledge.ts) isolates `KB_VAULT` to the repo's
`knowledge/` and configuration under `target/`; it does not use a personal vault.
Setup is explicit and local: `bun run knowledge setup` creates `target/knowledge-venv`
and installs the pinned upstream requirements from
[`tooling/knowledge-requirements.txt`](../../tooling/knowledge-requirements.txt).
Python 3.13+ is required. Set `PYTHON` if the Python executable is not named `python`.
No global installation or settings change is needed, and checks do not install missing
dependencies.

```sh
bun run knowledge setup                 # once, when needed
bun run knowledge search <terms> --json  # lexical candidates; inspect relevant owners
bun run knowledge backlinks <slug>       # vault-only reverse links
bun run knowledge schema                 # show upstream rules
bun run knowledge article ...            # article operations
bun run knowledge gap ...                # knowledge-gap operations
bun run knowledge adopt ...              # inspect/adopt existing material
bun run knowledge index                  # regenerate index and backlinks
bun run knowledge check                  # lint, index drift, links, markdown rules
bun run knowledge maintain               # index, then check
```

The wrapper pins `knowledge-wiki` 0.1.0 at revision
`126bfe6cc60ce3bd38c0600fc93525c174ee897b`. `schema` reads the package's shared
rules; a reference `path` relative to the vault is supported by the integrated version.
Do not copy upstream's absolute-path assumption into repository pointers. `index`
regenerates `_index.md` and `_backlinks.json`; do not edit these generated files
manually. `check` compares generated output without rewriting it, runs vault lint,
then validates Markdown links and applies the configured Markdown rules. `maintain`
updates the indexes before the same check.

`search` ranks lexical matches, not semantic synonyms: search alternate names,
identifiers and related terms, then inspect the candidate pointer and follow its
`path` to the owner. Agent judgment supplies semantic matching. Backlinks cover only
vault relationships, not inbound links from repository docs. Age/date metadata helps
prioritize review; it is not evidence that a claim is true or stale.

## Change and adoption workflow

1. Identify the fact and its owner. Search the vault and repository; open candidates
   and verify claims against the authoritative source, current implementation or
   dated evidence as appropriate.
2. Update the owner first. Add or update a small pointer only when it improves
   discovery; include an accurate relative path and useful links. Preserve whether a
   claim is current, proposed or historical.
3. For an existing document, inspect before adopting. Prefer a pointer when the source
   has a legitimate home. Do not move or duplicate authoritative files as a cleanup
   exercise. Treat adoption evidence as signals, not permission to relocate an
   ambiguous document; ask its owner.
4. Use `bun run knowledge article ...`, `gap ...`, and `adopt ...` for supported
   operations. Review write previews and do not hand-edit generated indexes or gap
   tables. Only close a knowledge gap when cited material actually answers it.
5. After pointer or relationship changes, run `bun run knowledge index` and
   `bun run knowledge check`. For ordinary owner edits, run `bun run knowledge links`
   when checking repository links is relevant; don't imply mechanical checks confirm
   semantic accuracy.

The `loop-knowledge` and `loop-knowledge-audit` project skills are adapters in
`.agents/skills/`; they route repository work through this policy. They reuse the
upstream `knowledge-wiki` capture, gap and gaps-review resources retained under
`skills/knowledge-wiki/`. Those upstream instructions are reference material, not
repo policy: do not adopt their Claude transcript harvesting, personal-learning
assumptions, global skill installation or preview gates as repository requirements.

## Mechanical checks and semantic review

The `links` check uses `remark-cli` with GFM and link validation across tracked and
unignored repository Markdown. It uses the CLI transform so cross-file heading anchors
are resolved; the validation plugin API alone does not provide that behavior.
`check` also runs `markdownlint-cli2` with minimal structural rules scoped to vault
Markdown, the two knowledge skills and this runbook. These checks are deterministic
and offline once the repository dependencies and Python environment are present.

Mechanical checks cannot find a claim contradicted by code, a duplicate phrased with
other vocabulary, or a missing owner link. Invoke `loop-knowledge-audit` when needed,
or periodically (for example monthly), to perform a scope-aware semantic review of
changed code and related knowledge. This is a contributor-invoked review, not an
automatic schedule. Verify claims against the owning source, retain historical
receipts, and report findings to the appropriate owner; do not rewrite unrelated
material. Distinguish a missing knowledge gap from an implementation task.

`lychee` was evaluated but is not installed: its network-dependent behavior is not a
reproducible offline gate. Use it only as an optional external-link audit when network
availability and nondeterminism are acceptable. Windows contributors use the same Bun
commands; Python's venv executable is under `Scripts/` there. No global environment
or system settings need to change.

## DSH invocation and initial verification

DSH discovers direct bundles under `.agents/skills/` (also `.dsh/skills/`), not
arbitrary nested `skills/` directories or the CLI's bundled catalog. Each bundle
has `SKILL.md` with `name` and `description` frontmatter. The installed filesystem
provider watches those roots and rereads bodies on load. Existing writing/host-kit
skills remain source-routed; this change does not change their packaged inventories.

In DSH, ask to use `loop-knowledge` for discovery/capture or
`loop-knowledge-audit` for maintenance. The model invokes the `skill` tool with
`{"name":"loop-knowledge-audit"}` (or `loop-knowledge`). If another harness does
not expose that tool, read the linked skill source explicitly. No global install,
symlink, custom plugin or special manual skill registration is required.

Initial Windows acceptance, 2026-11-19, Bun 1.3.14 / Python 3.14.3:

- Both project skills appeared in this running DSH session's replacement catalog;
  actual `skill` calls loaded both current instruction bodies with repository-local
  resource bases. An independent review also invoked the audit skill successfully.
- `bun run knowledge setup` installed/checked the pinned requirements in the local
  venv. `bun run knowledge maintain` regenerated 14 connected articles, then passed
  with zero vault errors/warnings, current indexes, repository local links and
  scoped Markdown structural rules.
- [Acceptance tests](../../tooling/knowledge.test.ts) passed: search-before-create,
  relative authoritative pointers, owner update/touch/index, reciprocal backlinks,
  deterministic generation, non-writing drift rejection, broken wikilinks/pointers,
  duplicate titles, malformed dates, stale/orphan findings, gap add/close,
  cross-file heading/image/reference rejection and retained upstream skill hashes.
  Tests use disposable local fixtures; they do not publish synthetic issues.
- The [agent-workflow pointer](../../knowledge/reference/agent-workflow.md) connects
  real [issue #1](https://github.com/isaac10334/loop/issues/1) and
  [merged PR #2](https://github.com/isaac10334/loop/pull/2), read back with `gh`.
  No issue, PR, claim, comment, commit or remote setting was changed by this task.
- Automation typecheck, package/Rust boundary check and `git diff --check` passed.
  Full SDK/native runtime acceptance was not rerun: this change does not change
  package APIs or native runtime behavior.

Cleanup corrected the obsolete generated SVG proof route and Windows heading link,
clarified generic-provider versus implemented document/semantic adapters, and
replaced the obsolete no-skill-manager claim with a pointer to its owner. Existing
owners and dated receipts were preserved; the new web adds routes, not copied
technical contracts or a second engineering ledger.

[Knowledge CI](../../.github/workflows/knowledge.yml) sets up dependencies explicitly
and runs offline checks/tests on Ubuntu. That remote job and a live Linux install
were not executed in this acceptance run. Ordinary SDK test runs skip Python
integration tests when the local knowledge venv is absent; the dedicated knowledge
job runs setup and `check` first, which fails rather than skipping a missing venv.
No external-URL audit, model-backed CI, automatic schedule or global installation
was performed. Backlinks remain vault-only; lexical substring matching can return
false positives (for example lease/release), so use package names and synonyms and
read the actual owners.
