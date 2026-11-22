# Upstream knowledge-wiki skill resources

These are unmodified upstream `capture`, `gap` and `gaps-review` skills from
[lfreeman/knowledge-wiki](https://github.com/lfreeman/knowledge-wiki/tree/126bfe6cc60ce3bd38c0600fc93525c174ee897b/skills),
revision `126bfe6cc60ce3bd38c0600fc93525c174ee897b`, retrieved 2026-11-19.
Upstream declares MIT in its README and package metadata (copyright attribution:
knowledge-wiki contributors); no standalone license file was present at this revision.
Preserve this provenance and upstream files when updating them.

They are resources, not directly installed triggers: upstream capture explicitly
excludes repository documentation, assumes `kb` on PATH and references Claude's
personal transcripts. The [Loop adapter](../../.agents/skills/loop-knowledge/SKILL.md)
reuses their search/classify/update/link/lint procedures with explicit repository,
DSH, portability and authorization adaptations. The
[audit adapter](../../.agents/skills/loop-knowledge-audit/SKILL.md) reuses gaps-review.
Read the adapter first; do not run upstream global `kb skill install` here.

The CLI itself is installed from that same pinned revision by
`bun run knowledge setup`; dependencies are pinned in
[requirements](../../tooling/knowledge-requirements.txt). Operations and tool tradeoffs
live in [the knowledge reference](../../docs/reference/knowledge.md).
