# Fast standalone checks: no registry publication, dependency install or native app compilation.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Binary)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$source = (Resolve-Path -LiteralPath $Binary).Path
$stage = Join-Path ([IO.Path]::GetTempPath()) ('loop-cli-smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$exe = Join-Path $stage 'loop-dev.exe'
Copy-Item -LiteralPath $source -Destination $exe
$oldPath = $env:Path
$oldHost = $env:LOOP_HOST_SOURCE
Push-Location $stage
try {
    # Only the relocated copy may satisfy this command, never a checkout or installed CLI.
    $env:Path = "$stage;$env:windir\System32;$env:windir;$env:windir\System32\WindowsPowerShell\v1.0"
    Remove-Item Env:LOOP_HOST_SOURCE -ErrorAction SilentlyContinue
    if ((Get-Command loop-dev).Source -ne $exe) { throw 'Unexpected PATH resolution.' }
    $version = & loop-dev --version
    if ($LASTEXITCODE -or $version -notmatch '^loop \d+\.\d+\.\d+$') { throw 'Version check failed.' }
    foreach ($helpArgs in @(@('--help'), @('help'), @('help', 'create'), @('create', '--help'))) {
        $help = & loop-dev @helpArgs
        if ($LASTEXITCODE -or "$help" -notmatch 'Usage:') { throw "Help failed: $helpArgs" }
        $help | Out-Host
    }
    $shortVersion = & loop-dev -V
    if ($LASTEXITCODE -or $shortVersion -ne $version) { throw 'Short version flag failed.' }
    & loop-dev doctor --json | Out-Host
    if ($LASTEXITCODE) { throw 'Doctor failed with missing optional tools.' }
    & loop-dev create hello --template desktop --language rust --yes | Out-Host
    if ($LASTEXITCODE -or !(Test-Path -LiteralPath 'hello/loop.toml')) { throw 'Embedded legacy scaffold failed.' }
    if (Select-String -LiteralPath 'hello/loop.toml' -Pattern 'host_source') { throw 'Scaffold depends on a checkout.' }
    & loop-dev create service --kit headless --yes --json | Out-Host
    if ($LASTEXITCODE -or !(Test-Path -LiteralPath 'service/loop.config.ts') -or !(Test-Path -LiteralPath 'service/src/app.ts')) { throw 'Embedded headless scaffold failed.' }
    & loop-dev inspect service --json | Out-Host
    if ($LASTEXITCODE) { throw 'Relocated headless static inspection failed.' }
    # Windows PowerShell 5.1 treats redirected native stderr as a terminating
    # NativeCommandError under Stop; capture the expected rejection as a process.
    $errorFile = Join-Path $stage 'upgrade-error.txt'
    $manager = Start-Process -FilePath $exe -ArgumentList 'upgrade' -NoNewWindow -Wait -PassThru -RedirectStandardError $errorFile
    if ($manager.ExitCode -eq 0 -or (Get-Content -LiteralPath $errorFile -Raw) -notmatch 'not a managed installation') { throw 'Development CLI accepted managed upgrade.' }
    Write-Host "PASS: relocated PATH command, version/help/doctor, embedded legacy/headless scaffolds, inert inspection, managed-upgrade refusal. Evidence: $stage"
} finally {
    Pop-Location
    $env:Path = $oldPath
    if ($null -eq $oldHost) { Remove-Item Env:LOOP_HOST_SOURCE -ErrorAction SilentlyContinue } else { $env:LOOP_HOST_SOURCE = $oldHost }
}
