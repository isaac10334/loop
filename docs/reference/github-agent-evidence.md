# LK-AUTO-02 GitHub agent workflow evidence

Run date: November 18, 2026. This receipt describes this exercise, not a guarantee
about later repository settings. Procedure ownership:
[GitHub runbook](../../.github/agent-development.md),
[repo skill](../../skills/loop-github/SKILL.md),
[claim helper](../../scripts/claim-github-issue.ps1).

## Scope and baseline

- Source baseline: `195184023d6b0ac88b57e087cfbe9dd1be69a1bd`, `main`/`origin/main`.
  Sampled history contained five commits, descriptive sentence-style subjects and
  a single author; no existing issue branches or PRs supplied another convention.
  Existing policy suggests `lk-<id>-<topic>`; this task uses `lk-auto-02-github-agents`.
- Isolated checkout: `C:/src/ilt/loop-auto-02`. The dirty primary checkout at
  `C:/src/ilt/loop` was not copied, staged, committed or reset. Its release, CLI and
  documentation changes remain independently owned.
- Owned paths: the runbook, skill, claim helper, this receipt and the small routing
  addition to the GitHub README. No workflow YAML or product contracts changed.
- Human explicitly authorized the task-local install, issue/claim/branch/draft-PR
  exercise, and subsequently branch protection configuration through the CLI.
  No merge, release dispatch, global installation or unrelated cleanup authorized.

## Audit and settings

`gh` 2.88.1 was authenticated as the repository administrator. Credentials were
not retrieved or changed. Initial all-state issue and PR lists were empty.
`main` protection returned HTTP 404 (Branch not protected); repository rulesets
were empty. The repo is public.

After explicit human authorization, `gh api` created active repository ruleset
`main-human-review`, ID `27576385`, targeting `refs/heads/main` only, with no bypass
actors. Readback through both the ruleset response and effective branch-rules
endpoint confirmed:

- PR required; review threads must be resolved.
- Deletion and non-fast-forward updates prohibited.
- Zero required approving reviews: the sole owner cannot approve their own PR.
- No required CI contexts: the existing TypeScript job is path-filtered.

This blocks direct updates through the PR requirement, but was verified by API
configuration/readback, not a destructive push attempt. Human-only merging still
requires agent policy: a shared human/agent login cannot be distinguished by this
ruleset. It does not require a second independent reviewer. A future maintainer
can raise approval requirements when another eligible reviewer is available.

Workflow inspection found TypeScript CI on matching push/PR paths, using Windows,
Bun 1.3.14, frozen install, tooling typecheck and package verification. It has no
explicit workflow permissions declaration. npm/host publishing are manual,
dry-run by default, with environment-gated publication and publication-job OIDC.
Windows release is manual with Contents write; Pages is manual with Pages/OIDC
permissions. No agent automation workflow or broader token grant was added.
Codex roles are bounded instructions, not credential or sandbox configuration.

## Tools inspected

No issue-graph executable/package was found in PATH, Bun's global package list or
the inspected Bun tree. With authorization, npm installed `issue-graph@0.7.0` into
`C:/src/ilt/loop-auto-02-tools`, outside both Git worktrees, using `--ignore-scripts
--no-audit --no-fund`. No repository dependency/lockfile/global setting changed.
Installed package metadata confirmed version 0.7.0 and Node >=20.

Executed `--help`, `schema`, `graph --help`, `skills get core`,
`skills get core --full`, and `auth status`. The schema describes remote mutations,
local writes, formats, limits and bundled guidance. `--version` failed with
`unknown flag`; package metadata was used instead. The runbook preserves this
version difference rather than assuming generic CLI flags. Full guidance warns
that graph JSON uses `-o`, plan/graph exit zero does not certify complete coverage,
exports may include private references, and status does not inspect CI or threads.

`gh extension list` was empty. The upstream gh-stack README was reviewed for
shared catalog, multi-worktree and rewrite/push effects. It was not installed or
executed; independent task branches do not require stacked PRs.

## Live exercise

- Created [issue #1](https://github.com/isaac10334/loop/issues/1) after checking
  all-state issues/PRs. It records scope, acceptance, non-goals and task key.
- Ran the claim helper for session `lk-auto-02-lead`; acquired
  `refs/heads/agent-claims/issue-1` at
  `a9f14777b4b9042f559abaa01422ffe3983ad99b`.
- Ran a second session `lk-auto-02-contender` against that same issue. GitHub
  rejected create-ref with HTTP 422 (Reference already exists); helper exited 1.
  Readback confirmed the original SHA was unchanged. This is a real duplicate
  acquisition test, not a simultaneous-process scheduling test. Exclusivity rests
  on GitHub's atomic fixed-ref creation, not a read-then-comment check.
- Assigned the issue and posted the claim receipt. No issue closed or claim deleted;
  both remain for human integration/handoff.

Publication, graph and final check results are recorded below after execution.

## Limits and next human action

The claim protocol is cooperative, not an authorization boundary. Nonparticipating
writers can still conflict. There is no automatic lease expiry or safe concurrent
claim deletion; handoff requires stopping writers and serialized human action.
A failed contender may leave an unreachable server-side metadata commit.
No real external reviewer is fabricated; actual review replies require a review
and authorization. No merge/auto-merge, force push, release, deployment, settings
bypass or modification of another worktree is part of this test.
