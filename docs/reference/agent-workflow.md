# Agent development workflow

This is the contributor policy for agents working in Loop Kit. Use an existing
harness, not a repository-owned orchestrator. Codex has native subagents; DSH also
delegates to agents. Roles and skills are instructions, not permission grants.
Keep credentials and unrelated personal tasks out of reports.

## Find authoritative knowledge

Read root [AGENTS](../../AGENTS.md), then the instructions for the paths being
changed. Load only the material needed for the task:

| Question | Owner |
| --- | --- |
| What exists and where does it belong? | [Architecture](../../ARCHITECTURE.md), package README and implementation/tests |
| Which architectural choices are settled? | [Decisions](../../DECISIONS.md); lifecycle details stay in their linked contracts |
| Which imports and boundaries are enforced? | [Architecture policy](../../tooling/architecture-policy.json), checked by `bun run repo check` |
| What is proposed or still undecided? | [Spec index](../../specs/README.md), [questions](../../QUESTIONS.md) |
| Where are usage and current limits documented? | [Documentation index](../README.md), package README and API comments |
| What evidence exists for an engineering gate? | [Engineering plan](../../ENGINEERING_PLAN.md) and its linked receipts; dates limit the claims |
| How are releases and external settings handled? | [Releasing](../../RELEASING.md), [GitHub setup](../../.github/README.md) |

If sources disagree, inspect implementation and tests, report the mismatch and
correct the owning document within scope. Do not silently turn a proposal into a
supported promise or a passing unit test into installed-runtime evidence.

## GitHub issues, worktrees and pull requests

1. Establish the outcome, owned paths, acceptance checks and non-goals. Inspect
   `git status --short`, the current branch and `git worktree list` before Git
   changes. Preserve all existing tracked and untracked work; do not reset, clean,
   stash, rebase or overwrite someone else's changes to obtain a clean baseline.
2. An existing GitHub issue supplies scope, not authority to publish or merge.
   Read its acceptance and relevant discussion when assigned. Use the issue ID in
   branch/PR descriptions when one exists; do not invent an issue number or require
   a new issue for every local edit. Before an authorized issue creation, look for
   duplicates. Include outcome, scope, acceptance and unresolved decisions; link
   the owning spec rather than copying it. Issue creation, comments, edits and
   closure require an explicit request covering those external writes.
3. For a new implementation task, prefer a separate branch and isolated Git
   worktree from an identified local baseline, such as `lk-<id>-<short-topic>` (or
   `<short-topic>` without an ID). Record branch, baseline revision and path. A
   worktree does not include dirty source changes: if those are required, stop and
   agree on their integration rather than copying them or committing them silently.
   A task explicitly scoped to the current checkout may stay there when ownership
   is clear. Changing cwd alone is not isolation. No automatic fetch or tool install
   is required to create a local worktree.
4. Keep one integration owner. Independent workers use separate worktrees or
   explicitly disjoint owned paths; shared contracts and lockfiles need an assigned
   owner. Review the complete composed diff before handoff. Do not remove another
   task's branch/worktree; remove your own only after confirmed integration and
   authorization, checking for untracked work first.
5. Local edits and validation do not imply permission to commit, push or open a PR.
   When explicitly requested, commit only owned changes and push only the agreed
   branch/remote. Prefer a draft PR until validation and review are complete. State
   outcome, linked issue/spec, compatibility effects, checks actually run, skipped
   checks and blockers. Use closing keywords only when closure is intended and
   authorized. Never merge, force-push or bypass branch protection without explicit
   approval for that action.

## Validation and review

Use the smallest relevant checks first. Package work uses
`bun run repo context <package>`, `bun run repo check` and
`bun run repo verify <package>`. Shared package/packaging changes may require
`bun run verify`; automation types use `bun run typecheck:tooling`. Rust commands
are owned by the [root README](../../README.md#rust-status). Documentation-only
changes need affected-link and source-claim checks, not an automatic full build.
The [TypeScript CI workflow](../../.github/workflows/typescript.yml) and knowledge
checks currently run only by explicit manual dispatch. A push or PR without a CI
run is not evidence of a passing build; record the local checks and dispatch any
required remote verification deliberately.

Review `git diff --check`, the final diff and status for scope, accidental generated
files, secrets, compatibility and failure/resource behavior. Add a bounded second
review when authority, lifecycle or shared-contract risk warrants it; do not spawn
reviewers as a quota. Address findings and rerun affected checks. Report commands
and outcomes, distinguishing not run, failed, skipped and passed. Do not claim
GitHub approval or branch-protection enforcement without checking the actual state.

## Approval and real blockers

An implementation request permits scoped local edits and relevant non-destructive
checks. It does not authorize external tracker writes, Git publication, releases,
deployment, workflow dispatch, dependency/tool installation, global settings,
credential access or changes to account/repository/registry configuration. Obtain
explicit authorization for those actions; release approval remains governed by
[RELEASING](../../RELEASING.md). Never print tokens or inspect credential stores.

When credentials, publishing authorization or external configuration block a
required step, stop that step. Report the exact operation, missing prerequisite,
completed local evidence and the smallest human action needed. Do not retry
blindly, fabricate credentials, weaken checks or substitute a mock for the blocked
acceptance. Continue independent authorized local work. If approval is unavailable,
leave a reviewable handoff rather than trying another route around the boundary.

## Maintain knowledge with the change

Update the owner of a changed fact in the same task: API behavior beside the API,
usage in its guide, architectural rationale in [DECISIONS](../../DECISIONS.md),
proposed obligations in the owning spec, unresolved product/trust choices in
[QUESTIONS](../../QUESTIONS.md). Add evidence to an existing ledger only when its
gate is affected; do not create a second task ledger or rewrite historical receipts.
Link facts instead of duplicating them. New documents need a route from the
[docs index](../README.md) or their owning page.

Use [knowledge discovery/capture](../../.agents/skills/loop-knowledge/SKILL.md)
before creating documentation and at implementation completion; use
[knowledge audit](../../.agents/skills/loop-knowledge-audit/SKILL.md) for bounded
periodic or on-demand reviews. [Knowledge operations](knowledge.md) owns setup,
mechanical checks and DSH invocation. GitHub issues/PRs remain the shared engineering
record; the knowledge gap inbox is not a second task tracker.

Keep root instructions short. Use scoped AGENTS for subtree rules and on-demand
skills for repeatable procedures, not progress logs. Other source-routed skills are
[writing](../../skills/loop-writing/SKILL.md) and
[host kits](../../skills/loop-host-kits/SKILL.md); read their source when routed
there, without installing anything. The [bundled catalog](skills.md) covers CLI
distribution, not every local instruction. Add a skill only when a recurring
procedure is not already owned; give it a trigger, bounded steps, checks and limits.
No scheduler, task runner or orchestrator is introduced here.

## Documents, questions and tasks

- Guides teach a supported path; reference documents describe current behavior.
- Specs record proposed/selected behavior, interfaces and executable acceptance.
- [QUESTIONS.md](../../QUESTIONS.md) holds unresolved product/authority choices.
  Write one question per bullet with a recommendation and consequence. Resolve
  answers into the owning spec, then remove answered questions.
- GitHub issues hold explicitly assigned repository work. TickTick is an optional
  personal capture route only when requested; neither is required for local edits.
  Link the owning spec; avoid copying its contents. Harness sessions hold transient
  execution state.

Before implementation, name the observable outcome and what remains unknown.
The integration owner resolves shared-contract questions before dependent edits;
independent work can continue. Run a narrow spike and preserve existing behavior
before replacing it. Before handing off, remove task-introduced obsolete code
paths and duplicate abstractions while preserving unrelated work. Use failure cases that detect a real defect; mutation,
property tests or fuzzing earn their cost at authority/parser boundaries, not
as a quota on every edit. These choices adapt the
[Impatient Programming rules](https://impatientprogramming.org/rules/). Deployment
and destructive changes still follow the user's authorization.

## Optional TickTick capture

This section preserves the existing machine-specific capture procedure. Use it
only for an explicit capture request; it does not authorize installation, login
or external writes on its own.

Use the official `@ticktick/ticktick-cli`, tested at `0.1.14` on October 30, 2026.
The unscoped npm package is a different publisher. See the
[official CLI guide](https://help.ticktick.com/articles/7465251130025443328).
No webhooks, scheduled review or automatic task processing runs here.

```powershell
ticktick --help
ticktick task --help
ticktick task create --help
ticktick project list --json
```

If missing, stop or obtain explicit installation approval before running
`npm install -g @ticktick/ticktick-cli@0.1.14`. With explicit login authorization, use
`ticktick auth login` for browser OAuth. The CLI stores credentials outside the
repo. `auth status` prints a token fingerprint: redact its `Token:` line from
recorded output. Do not inspect credential files or paste tokens into chat.

This machine's non-secret routing and captured task IDs live in
`~/.config/loop-agent/inbox.json`; it is not a portable project dependency.
Choose the account/inbox explicitly on another machine. Built-in Inbox may be
absent from `project list`; do not create a second list called Inbox as a guess.
Version 0.1.14 requires `--project` when creating a task.

```powershell
$captureRoute = Get-Content ~/.config/loop-agent/inbox.json -Raw | ConvertFrom-Json
ticktick task create --project $captureRoute.projectId `
  --title 'Loop capture: Short actionable title' `
  --content 'Question or next action. Source URL/spec. Reason deferred. Capture key: unique-key.' `
  --tags $captureRoute.tag --json
ticktick task get $captureRoute.projectId <returned-task-id> --json
```

Read back the returned ID before claiming capture succeeded. Record its ID/key
in the local routing file. Before retrying an uncertain create, reconcile that
ID or capture key; do not create duplicates blindly. `task search` returned
irrelevant tasks during this run: filter results by exact title/key/tag and do
not treat server search as reliable proof of presence or absence. Avoid dumping
unrelated results into agent context.

Capture deferred ideas within the current task, with prefix `Loop capture:` and
tag `loop-capture`; omit invented dates/priorities. Update or complete an agent's
own captures when the work resolves. Human-task deletion, bulk triage, scheduling,
sharing and changing lists need a task requesting those operations. An inbox item
does not make deleting active code safe: preserve the behavior/compatibility
contract and prove the retirement or replacement first.

## Delegation

Use one owner for shared contracts and integration. Give each worker a task cwd,
reviewed source baseline, owned paths, public dependencies, forbidden edits and
observable checks. Start dependent writers after their shared interface lands.
Require changed paths, artifact identities and actual check results in handoffs.

Codex project roles live in `.codex/agents/`; they inherit parent settings and
permissions. A read-only instruction is not a sandbox. DSH uses the same AGENTS
and task cards; changing child cwd does not create a Git worktree or new authority.
Review dirty sources before creating worktrees from HEAD. Current
[Codex subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents)
describes custom roles and model selection. Pick cheaper models explicitly when
available, then compare acceptance quality and total usage.

## Repo host-kit skill and optional installation

Before config, kit/plugin, renderer-adapter or dependency-boundary work, read the
[repo-owned skill](../../skills/loop-host-kits/SKILL.md). AGENTS routes to the source;
no installation is needed inside this checkout. [HK1](../../specs/host-kits.md#8-repo-skill-and-optional-data-driven-installation)
owns the bundled catalog contract. The source-built CLI has an explicit-write-only
[skill manager](skills.md); create/run/build/doctor must not write skills or user
instructions. Its source/fixture and dated client-discovery evidence do not establish
published release behavior or DSH invocation.

## Writing skills

`stop-slop` edits prose: remove filler, repeated contrasts and vague claims.
`i-have-adhd` shapes a response for action: visible next step, short working set,
numbered tasks and continuity. Use the former for reference/spec edits and the
latter when presenting work to the user. Keep uncertainty that affects correctness;
do not manufacture confidence or time estimates to satisfy a style rule.

Reviewed `writing-for-agents` from `mattpocock/skills` at
`a496f5513d4a4cf889bc48e189e579f4b0bdf6aa` and installed it on this machine.
Its useful rules: precise context pointers, one owner per fact and branch-specific
reference material. It is optional tooling, not required to understand this repo.
The reviewed `to-spec` skill assumes tracker publishing and discourages an initial
interview; those defaults do not match this project's question-first workflow.
Do not install a skill bundle merely because its leaderboard count is high.
