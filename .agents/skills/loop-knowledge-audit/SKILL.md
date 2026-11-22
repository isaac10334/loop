---
name: loop-knowledge-audit
description: Audit Loop Kit knowledge for stale claims, contradictions, duplicates, missing links and orphans. Use for an explicit knowledge audit or periodic maintenance; scope by changed code and preserve historical evidence and GitHub authorization rules.
---

# Bounded knowledge maintenance

1. Read [the knowledge skill](../loop-knowledge/SKILL.md) and
   [operations](../../../docs/reference/knowledge.md). Name one subsystem or a finite
   changed-path range, acceptance checks and non-goals. For periodic maintenance,
   start with changes since the last reviewed revision (`git log`/`git diff`); do not
   automatically audit the whole repository after every code change.
2. Run `bun run knowledge maintain`. This regenerates indexes and runs deterministic
   structural/link checks, not a model. Resolve your introduced defects; inspect
   orphan/stale warnings rather than silencing them. Generated index links do not
   count as meaningful inbound relationships.
3. Search names and synonyms, follow authoritative pointers and inspect backlinks
   with `bun run knowledge backlinks <slug>`. Compare affected owner claims with
   implementation, contracts and tests. Look for proposal/current confusion,
   unsupported promises, conflicting copies, expired workarounds and missing routes.
   Age is a review hint, not proof of error; unchanged code can still have incorrect
   docs. Dated experiments remain historical evidence, not current support claims.
4. For every finding record the source, exact conflicting claim, confidence and
   smallest next check. Fix high-confidence issues within owned scope. Consolidate
   duplicate facts into the owner and replace copies with links; do not discard
   unique rationale or rewrite receipts. Ask/report when authority is unresolved.
5. Review actual knowledge gaps with `bun run knowledge gap list --state open --json`.
   Reuse upstream [gaps-review](../../../skills/knowledge-wiki/gaps-review/SKILL.md)
   for search-before-close, duplicate clustering and source-backed resolution, not
   personal curriculum or automatic topic creation. Product questions stay in
   QUESTIONS; engineering tasks stay in authorized GitHub issues/PRs. A gap is not
   a second implementation tracker.
6. Update reviewed pointer dates only after checking the target. Regenerate with
   `bun run knowledge index`, rerun `bun run knowledge check`, review `git diff --check`
   and the composed diff. Report fixes, warnings deliberately retained, unverified
   claims and the next bounded review. No external writes without authorization.

Invoke on demand with DSH's `skill` tool (`loop-knowledge-audit`) or read this source.
For a monthly review, a human or separately authorized scheduler invokes this same
skill; this repository does not install a background agent, model-calling CI job or
schedule automatically. External URL checking is a separate optional network audit,
not a deterministic PR gate.
