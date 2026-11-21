---
name: loop-knowledge
description: Find, capture and maintain Loop Kit repository knowledge before architecture or documentation work and when implementation changes a documented fact. Search existing owners, update in place, link contracts/specs/issues/PRs and regenerate knowledge-wiki indexes.
---

# Loop repository knowledge

Run commands from the repository root. Read [operations](../../../docs/reference/knowledge.md)
for setup and authority boundaries. This skill needs no global installation.

## Find before creating

1. State the task, owned paths and finite checks. Read relevant AGENTS files.
2. Run `bun run knowledge search <subject> --json`, then search related package names,
   contract IDs and synonyms. Browse [the index](../../../knowledge/_index.md) if needed.
   Search is lexical; you decide semantic relevance. Also search code/docs directly:
   the pointer vault is deliberately not a complete copy of repository content.
3. Open candidate pointers and **follow their `path` to the authoritative document**.
   Never answer from a pointer summary. Check implementation/tests for current behavior;
   distinguish proposed specs, settled decisions and dated evidence.
4. Before adding a document, explain why an existing owner cannot hold the fact.

## Capture or complete a change

Reuse the upstream [capture procedure](../../../skills/knowledge-wiki/capture/SKILL.md),
especially search/update-vs-create, source classification, references instead of copies,
related links and post-write lint. Apply these repository adaptations:

- Use `bun run knowledge` wherever upstream says `kb`; it isolates configuration and
  never consults a personal vault. If missing, explicit setup is
  `bun run knowledge setup` with Python 3.13+; checks never install dependencies.
- Update code/API contracts beside the API, usage in its guide, proposals in specs,
  rationale in DECISIONS, open product/trust choices in QUESTIONS. Preserve historical
  receipts. An implementation request includes affected knowledge maintenance; it
  does not require another per-file approval or a full audit for a minor change.
- Skip upstream Claude transcript harvesting and personal learning assumptions. Do
  not read private transcripts or infer what the user knows. Do not move repository
  owners to the vault or generate absolute machine-local reference paths.
- Add a small `type: reference` article only for a useful discovery route. Its `path`
  is relative to `knowledge/`, e.g. `../packages/host/LIFECYCLE.md`; use repo-relative
  Markdown links in its body so GitHub readers can follow it. Use vault-root slug
  wikilinks in `related`, with aliases and reciprocal links (`article link`). Read
  `bun run knowledge schema` for required metadata. Dates record this pointer's
  review, not independent proof that every underlying claim is current.
- Connect an assigned issue/PR using its real URL in the owner and/or pointer and
  `tickets` metadata. In a PR description link the owning docs/spec and evidence.
  GitHub is the shared engineering record, not the gap inbox. Search duplicates and
  preserve established claims/authorization; do not create, claim, comment, close,
  publish or merge remotely without explicit authorization. No issue is required
  for a local edit, and no synthetic issue number is acceptable.
- For a missing explanation, first check its owner and open gaps. Reuse upstream
  [gap](../../../skills/knowledge-wiki/gap/SKILL.md) for knowledge gaps only, not
  engineering tasks or product decisions. Record source and next verification;
  close only when cited evidence answers it. Do not hand-edit the generated gap tables.

After editing a vault article run `bun run knowledge article touch <slug> --no-dry-run`,
then `bun run knowledge index` and `bun run knowledge check`. Ordinary owner edits
need `bun run knowledge links`; run index/check if pointers or relationships changed.
Report actual checks, authoritative updates and unresolved limits. Never edit generated
indexes/backlinks by hand or claim mechanical checks establish semantic truth.
