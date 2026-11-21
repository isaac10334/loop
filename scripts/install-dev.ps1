# Keep development builds separate from stable/legacy loop.exe installations.
[CmdletBinding()]
param([string]$InstallDir, [switch]$NoPath)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$checkout = Split-Path $PSScriptRoot -Parent
if (!$InstallDir) {
    $cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
    $InstallDir = Join-Path $cargoHome 'bin'
}
$bin = [IO.Path]::GetFullPath($InstallDir)
$destination = Join-Path $bin 'loop-dev.exe'
$marker = Join-Path $bin 'loop-dev-install.json'
if (Test-Path -LiteralPath $marker) {
    $state = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
    if ($state.product -ne 'isaac10334/loop-dev' -or $state.destination -ne $destination -or $state.checkout -ne $checkout) {
        throw "Unrecognized development installation or another checkout owns $destination"
    }
    if ((Test-Path -LiteralPath $destination) -and (Get-FileHash -LiteralPath $destination).Hash -ne $state.sha256) {
        throw "Development executable was modified outside this installer: $destination"
    }
} elseif (Test-Path -LiteralPath $destination) {
    throw "Refusing to replace an unrecognized loop-dev.exe at $destination"
}
$conflicts = @(Get-Command loop-dev -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -ne $destination })
if ($conflicts.Count -and !$NoPath) { throw "Existing loop-dev command conflicts: $($conflicts.Source -join ', ')" }
$binary = & "$PSScriptRoot/build-cli.ps1"
$reported = & $binary --version
if ($LASTEXITCODE -or $reported -notmatch '^loop \d+\.\d+\.\d+$') { throw 'Built CLI failed its version check.' }
New-Item -ItemType Directory -Force -Path $bin | Out-Null
Copy-Item -LiteralPath $binary -Destination $destination -Force
@{ product = 'isaac10334/loop-dev'; checkout = $checkout; destination = $destination; version = $reported; sha256 = (Get-FileHash -LiteralPath $destination).Hash } |
    ConvertTo-Json | Set-Content -LiteralPath $marker -Encoding UTF8
if (!$NoPath) {
    $oldPath = [string][Environment]::GetEnvironmentVariable('Path', 'User')
    $present = @($oldPath -split ';' | Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ieq $bin.TrimEnd('\') }).Count -gt 0
    if (!$present) {
        [Environment]::SetEnvironmentVariable('Path', (($oldPath.TrimEnd(';') + ';' + $bin).TrimStart(';')), 'User')
    }
    if (!(@($env:Path -split ';') -contains $bin)) { $env:Path += ";$bin" }
}
Write-Host "$reported installed as $destination. Rerun this script to update; stable loop.exe was not changed."
Write-Host 'Open a new terminal if PATH changed. Development builds do not support managed upgrade/uninstall.'
