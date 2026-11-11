# Agent workflow and capture

Use an existing harness. Codex has native subagents; DSH also delegates to agents.
Start with bounded tasks and measure total usage: parallel workers can increase
tokens despite smaller individual contexts. Keep credentials and unrelated personal tasks out of reports.

## Documents, questions and tasks

- Guides teach a supported path; reference documents describe current behavior.
- Specs record proposed/selected behavior, interfaces and executable acceptance.
- [QUESTIONS.md](../../QUESTIONS.md) holds unresolved product/authority choices.
  Write one question per bullet with a recommendation and consequence. Resolve
  answers into the owning spec, then remove answered questions.
- TickTick holds captures and next actions. Link the owning spec; avoid copying
  its contents. Harness sessions hold transient execution state.

Before implementation, name the observable outcome and what remains unknown.
The integration owner resolves shared-contract questions before dependent edits;
independent work can continue. Run a narrow spike and preserve existing behavior
before replacing it. Before handing off, remove task-introduced obsolete code
paths and duplicate abstractions while preserving unrelated work. Use failure cases that detect a real defect; mutation,
property tests or fuzzing earn their cost at authority/parser boundaries, not
as a quota on every edit. These choices adapt the
[Impatient Programming rules](https://impatientprogramming.org/rules/). Deployment
and destructive changes still follow the user's authorization.

## TickTick

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

Install with `npm install -g @ticktick/ticktick-cli@0.1.14` if missing. Use
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
owns the proposed bundled catalog and explicit-write-only manager. No install
command exists yet; create/run/build/doctor must not write skills or user instructions.
Project/user destinations, local edits and crash recovery require their own tests.

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
