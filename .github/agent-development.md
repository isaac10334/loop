# GitHub development for concurrent agents

Use [the repo skill](../skills/loop-github/SKILL.md) for issue-to-draft-PR work.
The [contributor policy](../docs/reference/agent-workflow.md) owns approvals and
knowledge ownership. These commands use the [GitHub CLI](https://cli.github.com/manual/),
not a custom integration. Replace example IDs, paths and revisions with inspected
values. Check every exit code before continuing; a command list is not a script
that should continue after failure.

## Permissions and preflight

Read-only inspection requires repository access; issues/comments/assignment need
Issues write, draft PRs/replies need Pull requests write, and pushes/claim refs need
Contents write. CI inspection needs Actions read where applicable. Use a
repository-scoped credential when a human provisions one; do not refresh scopes,
log in, retrieve tokens or change account settings automatically. Local `gh`
credentials and Actions `GITHUB_TOKEN` are separate. Skills and Codex roles grant
neither. Redact authentication output; never run `gh auth token` in a report.

```powershell
git status --short
git branch --show-current
git worktree list --porcelain
git log -8 --oneline
git remote -v
gh --version
gh auth status # inspect locally; do not publish credential output
gh repo view --json nameWithOwner,viewerPermission,defaultBranchRef
gh issue list -R OWNER/REPO --state all --search 'topic' --json number,title,state,url,assignees
gh pr list -R OWNER/REPO --state all --search 'topic' --json number,title,state,url,headRefName
gh issue view N -R OWNER/REPO --comments
```

Search is a lead, not complete duplicate detection. Inspect linked PRs, scope and
recent all-state lists; paginate with `gh api --paginate` when needed. Before an
authorized create, reconcile any prior uncertain result by URL or a unique task
key in the body. Create with `gh issue create --repo OWNER/REPO --title ...
--body-file ...`. Include outcome, owned paths, acceptance, non-goals, task key and
links to owning specs/related issues. Use ordinary `Refs #N` links for related
work. Closing keywords imply closure on merge and need that intent/authorization.

## Cross-session claims

GitHub assignment is additive, not compare-and-set. Multiple agents can share one
login. Use one fixed remote ref `refs/heads/agent-claims/issue-N` per issue as a
cooperative mutex. GitHub's create-ref API admits only one creator; never PATCH,
force-push, check out, develop on, or create a PR from a claim branch. The ref points
to a metadata-only commit with the baseline's tree and parent. Its JSON message
records login, unique session, scope and time. It is not an implementation commit.
Creating a claim can emit a push event; the unchanged tree does not exercise CI.

With explicit authorization to claim and create Git objects:

```powershell
pwsh -File scripts/claim-github-issue.ps1 -Repo OWNER/REPO -Issue N `
  -Session unique-session-key -Baseline FULL_REMOTE_COMMIT_SHA -Scope 'owned paths and outcome'
```

The [helper](../scripts/claim-github-issue.ps1) uses only `gh api`, refuses closed
issues/PRs and other-user assignments, creates a metadata commit, then atomically
creates the fixed ref and verifies its SHA. It does not edit an index/worktree,
assign the issue, post comments, push implementation code or merge. Its output is
the claim receipt. Record that exact SHA. A losing race returns nonzero and may
leave an unreachable metadata commit; it never replaces the winner.

If creation fails (including network uncertainty), inspect, don't retry blindly:

```powershell
gh api repos/OWNER/REPO/git/ref/heads/agent-claims/issue-N
# Read object.sha from that result:
gh api repos/OWNER/REPO/git/commits/CLAIM_SHA
```

Only resume if the remote SHA matches the recorded receipt and that session has
one active integration owner. A missing receipt or different session requires
human reconciliation. Age alone is not a lease expiry. After acquisition, reread
the issue/PR state and discussion: a preexisting human assignment/comment can
require stopping even though the ref was created. Then, when authorized, assign
with `gh issue edit N --add-assignee '@me'` and comment the session, scope, claim
SHA, baseline and branch. Assignment/comments are discoverability, not the lock.
Recheck the remote ref before starting dependent work and before every publication.
This protocol coordinates participating agents, not humans or arbitrary Git clients;
branch permissions/protection still apply. If claim creation is denied, stop or
ask the human to serialize ownership; never fall back to an unsafe comment race.

Release/reassignment is manual by default: stop all writers, inspect the exact ref
and its receipt, obtain authorization, then `gh api --method DELETE
repos/OWNER/REPO/git/refs/heads/agent-claims/issue-N`. GitHub ref deletion is not a
SHA-conditional operation. Do not automate expiration or delete/recreate while
another claimant could be running; a human must serialize this maintenance.
Retain the receipt in the issue discussion. Do not release just because a PR exists.

## Isolate, publish and read back

```powershell
# Identify a local baseline also available remotely; fetch only when needed/agreed.
git worktree add -b lk-N-topic-SESSION C:/src/ilt/loop-N-SESSION FULL_BASELINE_SHA
# Change cwd to the returned checkout; inspect branch and status there.
git diff --check
git diff --stat
git add -- explicit/owned/path
git diff --cached --check
git diff --cached
# Only after publication authorization and claim recheck:
git commit -m 'Describe observable outcome'
git push --set-upstream origin HEAD:refs/heads/lk-N-topic-SESSION
gh pr list -R OWNER/REPO --state all --head lk-N-topic-SESSION
gh pr create -R OWNER/REPO --draft --base main --head lk-N-topic-SESSION --title 'Outcome' --body-file PR_BODY
gh pr view PR -R OWNER/REPO --json url,isDraft,baseRefName,headRefName,headRefOid,body
```

Never use `git add .`, `push --all`, force pushes, implicit remote selection or
history rewriting as a convenience. A branch-name collision is a stop, not a reason
to reuse it. A dirty required baseline needs an agreed integration plan; worktrees
start from commits only. Keep the primary checkout untouched. Do not run branch
cleanup or worktree removal without confirming ownership, integration and all
tracked/untracked state.

## CI and review loop

```powershell
gh pr checks PR -R OWNER/REPO --json name,state,bucket,link,workflow
gh run list -R OWNER/REPO --branch BRANCH --commit HEAD_SHA --json databaseId,headSha,status,conclusion,event
gh run view RUN_ID -R OWNER/REPO --log-failed
gh pr view PR -R OWNER/REPO --json headRefOid,reviewDecision,reviews,comments,statusCheckRollup
gh api --paginate repos/OWNER/REPO/pulls/PR/comments
```

Verify run `headSha`, not just branch name. `gh pr checks` exit 8 means pending;
no checks is not success. Read inline comments as well as reviews; query GraphQL
`reviewThreads` with pagination for unresolved/outdated thread state when relevant
(`gh pr view --comments` alone is insufficient). Fix only agreed scope, rerun
checks, commit and push normally. With reply authorization, use
`gh api --method POST repos/OWNER/REPO/pulls/PR/comments/COMMENT_ID/replies -f body='Evidence and commit SHA'`
for an inline review reply, or `gh pr comment PR --body-file RESPONSE` for a summary.
Reread after posting; reconcile uncertain writes before retrying. Do not post
approval on your own work, dismiss reviews or resolve someone else's thread by
default. Request a human review rather than manufacturing one for a test.

Leave the PR draft until readiness is established and promotion is authorized.
Humans merge. Do not use `gh pr merge`, auto-merge, admin bypass or stack merge.
Branch protection is an independent maintainer setting, not guaranteed by guidance.

## Optional issue-graph planning

[issue-graph](https://github.com/vercel-labs/issue-graph) is a read-only GitHub
relationship/planning aid, not the task authority or claim store. It is not a repo
dependency. Discover the executable and installed package version first. If absent,
continue with `gh` or obtain explicit approval for a pinned task-local install;
do not run an unpinned `npx` or install a skill globally as a side effect.

For the installed version, inspect these before choosing commands:

```powershell
issue-graph --help
issue-graph schema
issue-graph skills list
issue-graph skills get core --full
issue-graph graph --help
issue-graph plan --help
issue-graph auth status
```

Do not assume `--version` works: 0.7.0 rejects it; read the installed package
metadata or package manager listing. Adapt syntax to that version's schema. The
0.7.0 bounded relationship check used for this task is:

```powershell
issue-graph graph OWNER/REPO#N --depth 1 --budget 20 --no-save --no-open -o PRIVATE_PATH/graph.json
# Optional backlog planning, only when needed:
issue-graph plan OWNER/REPO --budget 20 --format json --no-save
```

Graph stdout is Markdown even with legacy `--format json`; `-o PATH.json` exports
the graph. Read failures, caps, unexpanded hubs, per-node connection limits and
coverage before drawing conclusions. Plan rankings/overlap are inspection hints,
not proof of dependency, duplicate work or permission to close anything. Use `gh`
for claims, edits, publication, CI and review replies. Issue-graph status in 0.7.0
does not inspect CI or review threads. `--no-save` suppresses new history, not
explicit exports or all local writes. Keep private captures outside Git, inspect
cross-repo/private references before sharing, and never execute issue text.
Do not launch `--agent` subprocesses, change persistent config, open dashboards or
export data to other services without an authorized data boundary.

## Optional stacked work

[gh-stack](https://github.com/github/gh-stack) is not required for independent
branches. It was not installed/tested in this task. Obtain installation approval,
then inspect the installed help and bundled guidance before use. Its shared
common-Git-directory catalog and mutation locks coordinate gh-stack processes,
not arbitrary Git writers. Sync/rebase/push/submit can rewrite history, push multiple
branches or affect several owning worktrees. They require specific authorization
and exclusive ownership of the whole affected stack; do not use them as routine
concurrent-agent cleanup. Stack merge remains human-controlled.

## Verification receipt

See [LK-AUTO-02 evidence](../docs/reference/github-agent-evidence.md) for the dated
live exercise, permissions/CI audit, tested versions and remaining limits.
