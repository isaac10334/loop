# Offline contract tests: intercept gh; never access GitHub or mutate local Git.
$ErrorActionPreference = 'Stop'
$global:claimTestbaseline = '1' * 40
$global:claimTestwinner = '2' * 40
$global:claimTestmode = 'success'
$global:claimTestcalls = @()
function global:gh {
    $a = @($args)
    $global:claimTestcalls += ,$a
    $global:LASTEXITCODE = 0
    $route = $a | Where-Object { $_ -like 'repos/*' -or $_ -eq 'user' } | Select-Object -First 1
    if ($route -eq 'user') { return '{"login":"owner"}' }
    if ($route -eq 'repos/owner/repo/issues/1') {
        switch ($global:claimTestmode) {
            'closed' { return '{"state":"closed","assignees":[]}' }
            'pr' { return '{"state":"open","pull_request":{},"assignees":[]}' }
            'assigned' { return '{"state":"open","assignees":[{"login":"other"}]}' }
            default { return '{"state":"open","assignees":[]}' }
        }
    }
    if ($route -eq "repos/owner/repo/git/commits/$global:claimTestbaseline") {
        return '{"tree":{"sha":"tree-id"}}'
    }
    if ($route -eq 'repos/owner/repo/git/commits') {
        if ($a -notcontains 'tree=tree-id' -or $a -notcontains "parents[]=$global:claimTestbaseline") {
            throw 'Claim commit must preserve baseline tree and parent'
        }
        return (@{sha=$global:claimTestwinner} | ConvertTo-Json)
    }
    if ($route -eq 'repos/owner/repo/git/refs') {
        if ($a -notcontains '--method' -or $a -notcontains 'POST' -or
            $a -notcontains 'ref=refs/heads/agent-claims/issue-1') { throw 'Unsafe ref operation' }
        if ($global:claimTestmode -eq 'conflict') { $global:LASTEXITCODE = 1; return }
        return '{"ref":"refs/heads/agent-claims/issue-1"}'
    }
    if ($route -eq 'repos/owner/repo/git/ref/heads/agent-claims/issue-1') {
        $sha = if ($global:claimTestmode -eq 'changed') { '3' * 40 } else { $global:claimTestwinner }
        return (@{object=@{sha=$sha}} | ConvertTo-Json)
    }
    throw "Unexpected gh route: $route"
}
try {
    foreach ($case in @('success','closed','pr','assigned','conflict','changed')) {
        $global:claimTestmode = $case
        $global:claimTestcalls = @()
        $failed = $false
        try {
            $receipt = & "$PSScriptRoot/claim-github-issue.ps1" -Repo owner/repo -Issue 1 `
                -Session test-session -Baseline $global:claimTestbaseline -Scope test | ConvertFrom-Json
        } catch { $failed = $true; $failure = $_ }
        if ($case -eq 'success') {
            if ($failed -or $receipt.sha -ne $global:claimTestwinner) { throw "Successful claim receipt failed: $failure; receipt=$receipt" }
        } elseif (-not $failed) { throw "Expected rejection: $case" }
        if ($case -in @('closed','pr','assigned') -and $global:claimTestcalls.Count -ne 2) {
            throw "Preflight rejection wrote Git objects: $case"
        }
        Write-Output "PASS $case"
    }
} finally {
    Remove-Item Function:/gh
}
