# Real development build/install/update; never changes user PATH or the stable CLI.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$stage = Join-Path ([IO.Path]::GetTempPath()) ('loop-dev-install-test-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$installer = Join-Path $PSScriptRoot 'install-dev.ps1'
$stable = Join-Path $stage 'loop.exe'
Set-Content -LiteralPath $stable -Value 'stable sentinel: must never be run or replaced'
$before = (Get-FileHash -LiteralPath $stable).Hash
& $installer -InstallDir $stage -NoPath
& $installer -InstallDir $stage -NoPath
if ((Get-FileHash -LiteralPath $stable).Hash -ne $before) { throw 'Development install changed stable loop.exe.' }
& "$PSScriptRoot/test-cli.ps1" -Binary (Join-Path $stage 'loop-dev.exe')
$exe = Join-Path $stage 'loop-dev.exe'
Add-Content -LiteralPath $exe -Value 'external modification'
$failed = $false
try { & $installer -InstallDir $stage -NoPath } catch { $failed = $_.ToString().Contains('modified outside') }
if (!$failed) { throw 'Installer accepted an externally modified development executable.' }
$unmanaged = Join-Path $stage 'unmanaged'
New-Item -ItemType Directory -Path $unmanaged | Out-Null
Set-Content -LiteralPath (Join-Path $unmanaged 'loop-dev.exe') -Value 'unmanaged sentinel'
$failed = $false
try { & $installer -InstallDir $unmanaged -NoPath } catch { $failed = $_.ToString().Contains('unrecognized') }
if (!$failed) { throw 'Installer overwrote an unmanaged executable.' }
Write-Host "PASS: real install/repeat update, stable preservation, modified/unmanaged refusal. Evidence: $stage"
