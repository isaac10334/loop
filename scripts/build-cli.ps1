# Bootstrap with Bun and Cargo only; never invoke an installed Loop CLI.
[CmdletBinding()]
param([switch]$Release)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$checkout = Split-Path $PSScriptRoot -Parent
Push-Location $checkout
try {
    # Dependencies must already be prepared with bun install --frozen-lockfile.
    & bun run build | Out-Host
    if ($LASTEXITCODE) { throw 'SDK build failed. Run bun install --frozen-lockfile first.' }
    & bun tooling/host-kit-assets.ts | Out-Host
    if ($LASTEXITCODE) { throw 'Embedded CLI asset build failed.' }
    $buildArgs = @('build', '--locked', '-p', 'loop-cli', '--bin', 'loop', '--message-format=json-render-diagnostics')
    if ($Release) { $buildArgs += '--release' }
    $messages = @(& cargo @buildArgs)
    if ($LASTEXITCODE) { throw 'CLI build failed.' }
    $artifacts = @($messages | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object {
        $_.reason -eq 'compiler-artifact' -and $_.target.name -eq 'loop' -and $_.executable
    })
    if ($artifacts.Count -ne 1) { throw 'Expected exactly one Loop executable from Cargo.' }
    # Cargo reports the actual path, including custom CARGO_TARGET_DIR/target config.
    Write-Output $artifacts[0].executable
} finally { Pop-Location }
