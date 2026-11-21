# Requires explicit authorization to create GitHub objects. No local Git mutations.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9-]*/(?!\.{1,2}$)[A-Za-z0-9_.-]+$')][string]$Repo,
    [Parameter(Mandatory)][ValidateRange(1, 2147483647)][int]$Issue,
    [Parameter(Mandatory)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$')][string]$Session,
    [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$Baseline,
    [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Scope
)
$ErrorActionPreference = 'Stop'
function Invoke-GhJson([string[]]$Arguments) {
    $result = & gh @Arguments
    if ($LASTEXITCODE -ne 0) { throw "gh failed; stop and reconcile remote state before retrying." }
    return ($result | ConvertFrom-Json)
}
$login = (Invoke-GhJson @('api', 'user')).login
$item = Invoke-GhJson @('api', "repos/$Repo/issues/$Issue")
if ($item.pull_request -or $item.state -ne 'open') { throw 'Claim requires an open issue, not a PR.' }
if (@($item.assignees | Where-Object login -ne $login).Count -gt 0) {
    throw 'Issue assigned to another user; coordinate rather than claim.'
}
$base = Invoke-GhJson @('api', "repos/$Repo/git/commits/$Baseline")
$message = [ordered]@{
    protocol = 'loop-agent-claim-v1'; repo = $Repo; issue = $Issue
    login = $login; session = $Session; scope = $Scope; baseline = $Baseline
    createdAt = [datetime]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress
# Each contender creates its own metadata commit. Only one can create the fixed ref.
# A failed contender may leave an unreachable server-side commit, never a checkout.
$commit = Invoke-GhJson @('api', '--method', 'POST', "repos/$Repo/git/commits",
    '-f', "message=$message", '-f', "tree=$($base.tree.sha)", '-f', "parents[]=$Baseline")
$ref = "refs/heads/agent-claims/issue-$Issue"
$claim = Invoke-GhJson @('api', '--method', 'POST', "repos/$Repo/git/refs",
    '-f', "ref=$ref", '-f', "sha=$($commit.sha)")
$confirmed = Invoke-GhJson @('api', "repos/$Repo/git/ref/heads/agent-claims/issue-$Issue")
if ($confirmed.object.sha -ne $commit.sha) { throw 'Claim identity changed; stop.' }
[ordered]@{ repo = $Repo; issue = $Issue; ref = $claim.ref; sha = $commit.sha
    login = $login; session = $Session; scope = $Scope } | ConvertTo-Json
