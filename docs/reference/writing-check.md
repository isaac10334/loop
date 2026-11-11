# Internal writing check

This is maintainer guidance, not a public onboarding page or a runtime contract.
Use [the local writing skill](../../skills/loop-writing/SKILL.md) for the short
procedure. Load this page only to review that procedure or calibrate an edit.

## Scope and acceptance

A prose edit is done when the named reader can find the answer, the rewrite
preserves the supported claims and qualifications, and affected links resolve.
State unexecuted examples and remaining factual questions. The task may set
additional concrete checks. Do not require a new ledger entry, external task,
independent model review or numerical style score for every edit.

Non-goals: hiding AI authorship, detecting an author, enforcing a phrase blacklist,
rewriting historical evidence, changing behavior, or installing a writing tool.
Capture a useful deferred issue in the handoff or its owner document with the
reason and next check; external task creation requires an explicit request.

## Editorial judgment

Start with the reader's question. If the draft has no answer, sentence polishing
will not supply one. Ask for missing facts or keep the gap explicit. Public docs
should explain current usage; internal receipts can retain chronology and checks.

Inspect headings, introductions and endings for sentences that announce a finding
instead of stating it. Vague praise, significance claims, repeated contrasts and
forced lists often add words without information. They are review candidates,
not automatic deletions. An API's real denial condition may require a negative;
a three-item list may describe exactly three states. Precise technical terms may
need repetition. Avoid replacing these with synonyms just for variety.

Compare the rewrite with the source for every claim, including scope, rankings,
uncertainty and negation. Preserve names, values, identifiers, commands, code,
links and quotations. Do not replace an unsupported generality with an invented
specific. Keep the author's useful voice and rhythm. Expand a noun stack if the
shorter version is harder to read. A clean lint report would not establish truth,
readability, or faithful preservation.

## Calibration run: November 11, 2026

These are manual applications of the six-step skill, not independent reviews or
executed software examples. The source files were read; they were not edited by
this check. The sample checks assess claim preservation, not runtime behavior.

### Public introduction

Reader question: what can I do with Loop, and must I use WebAssembly?
Source: [README introduction](../../README.md).

Before:

> Loop-kit is becoming a TypeScript-first SDK for typed capabilities and local providers. Ordinary JavaScript can define a contract, register an implementation, acquire it in a scope, and clean it up. WebAssembly is optional.

After:

> Loop-kit is becoming a TypeScript-first SDK for typed capabilities and local providers. With ordinary JavaScript, you can define a contract, register an implementation, acquire it in a scope, and clean it up. WebAssembly is optional.

Result: the reader action is more direct. The maturity qualification, all four
operations, typed/local scope and optional WebAssembly remain. No code or new
availability claim was added. Most of the passage stayed unchanged because it
already answered the question; the procedure does not demand visible churn.

### Technical boundary

Reader question: how do the two composition modes differ, and what do they not guarantee?
Source: [runtime reference, composition](runtime.md#calls-composition-and-metadata).

Before:

> Static composition creates a new artifact. Host-managed linking retains separate instances/lifetimes. Record the resolved graph and adapter hashes, reject accidental cycles, and prove resource ownership across each bridge. Neither form supplies permissions, parallel CPU execution or durable recovery. Use independent workers or runtime preemption for forced stop; AbortSignal alone is cooperative.

After:

> Static composition creates a new artifact. With host-managed linking, instances and lifetimes remain separate. Record the resolved graph and adapter hashes, reject accidental cycles, and prove resource ownership across each bridge. Neither form supplies permissions, parallel CPU execution or durable recovery. Use independent workers or runtime preemption for forced stop; AbortSignal alone is cooperative.

Result: the slash shorthand was expanded. Artifact creation, instance/lifetime
separation, graph/hashes, cycle rejection, bridge ownership, all three excluded
guarantees and the forced-stop distinction remain. The three-item warning and
negative sentence stayed because they convey separate technical limits.

### Reject a lossy rewrite

Candidate: replace "AbortSignal alone is cooperative" with "AbortSignal stops the worker."
Rejected: this changes a cancellation limitation into a termination guarantee.
Likewise, replacing "is becoming" with "is a complete" would invent a maturity
claim. Brevity and confidence do not justify either change.

## Sources and delivery limits

Reviewed on November 11, 2026:

- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
  describes patterns, not universal rules or proof of authorship. Its introduction
  warns that surface cleanup can conceal deeper problems; claim checking matters.
- [declauding v0.13.0 release](https://github.com/oaustegard/claude-skills/releases/tag/declauding-v0.13.0)
  and its [tagged skill source](https://github.com/oaustegard/claude-skills/blob/declauding-v0.13.0/declauding/SKILL.md)
  informed the answer-first, preservation and overcorrection checks. The local
  procedure is deliberately smaller: no linter, hooks, model profiles, embeddings,
  installation or mandatory second agent. Third-party tools and empirical claims
  were not executed or independently verified.
- [Moritz Schauer's post and image](https://x.com/MoritzSchauer/status/2120049961920295069/photo/1)
  were accessible. The image was downloaded to temporary storage and visually
  inspected. It lists staged reveals, significance labels, abstraction agency,
  deferred nouns, coy headings, aphoristic closers, straw-man knockdowns, fragment
  cadence, dressed metaphor and label-first framing. These are prompts to inspect
  context, not prohibitions on legitimate technical language.

Before edits, the existing root/docs instructions, docs index,
[host-kit skill](../../skills/loop-host-kits/SKILL.md) and
[agent workflow](agent-workflow.md) were read. The session skill catalog did not
provide `stop-slop`, previously requested by docs instructions. No third-party
skill was installed and no user/global instruction or setting was changed.

The actual installed DSH runtime was checked read-only at the supplied location:
`C:/Users/ijhar/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh`.
The path was not an OS-readable directory. Its parent `app.asar` was an archive
file of 213,202,918 bytes; source files inside its virtual `dsh` path could not be
read with the available ordinary filesystem tools. No extraction or harness
modification was attempted. In the actual lead session, scoped reminders for
`docs/AGENTS.md`, `specs/AGENTS.md` and `packages/AGENTS.md`, plus updates to the
new public-doc instructions, appeared after those paths were read. That verifies
scoped reminder delivery in this session, not a universal nested-file loading
order. The newly added writing skill did not become a session-catalog skill; it
was explicitly read through the repository route. Automatic repository-skill
discovery and the harness source implementation remain unverified.

Repository instructions explicitly link the local skill and relevant nested
AGENTS files so an agent can read them without installation. A file's presence
does not prove automatic catalog discovery, invocation, or cross-harness support.
If actual discovery must be certified, inspect an accessible copy of this exact
installed harness version and run a bounded discovery test; that remains outside
this prose slice.
