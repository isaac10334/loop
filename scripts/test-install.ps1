param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference = 'Stop'
$archive = (Resolve-Path -LiteralPath $ArchivePath).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('loop-lifecycle-' + [Guid]::NewGuid().ToString('N'))
$install = Join-Path $testRoot 'install'
New-Item -ItemType Directory -Path $testRoot | Out-Null
$manager = Join-Path $PSScriptRoot 'manage.ps1'
function Assert([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }
& $manager -ArchivePath $archive -InstallDir $install -SkipRust -NoPath -NoRegistry
Assert (Test-Path "$install/bin/loop.exe") 'Missing installed executable.'
$before = (Get-FileHash "$install/bin/loop.exe").Hash
& $manager -Action Upgrade -ArchivePath $archive -InstallDir $install -SkipRust -NoPath -NoRegistry
Assert ((Get-FileHash "$install/bin/loop.exe").Hash -eq $before) 'Idempotent upgrade changed executable.'
Set-Content "$install/my-project.txt" 'keep me'
$bad = Join-Path $testRoot 'bad.zip'
Copy-Item -LiteralPath $archive -Destination $bad
Set-Content "$bad.sha256" ('0' * 64)
$failed = $false
try { & $manager -Action Upgrade -ArchivePath $bad -InstallDir $install -SkipRust -NoPath -NoRegistry } catch { $failed = $_.ToString().Contains('checksum') }
Assert $failed 'Bad checksum was accepted.'
Assert ((Get-FileHash "$install/bin/loop.exe").Hash -eq $before) 'Failed upgrade damaged previous executable.'
$unmanaged = Join-Path $testRoot 'unmanaged'
New-Item -ItemType Directory $unmanaged | Out-Null
Set-Content "$unmanaged/keep.txt" 'keep'
$failed = $false
try { & $manager -ArchivePath $archive -InstallDir $unmanaged -SkipRust -NoPath -NoRegistry } catch { $failed = $_.ToString().Contains('unrecognized') }
Assert $failed 'Unmanaged directory was accepted.'
& "$install/bin/loop.exe" uninstall
if ($LASTEXITCODE) { throw 'CLI uninstall command failed.' }
$deadline = (Get-Date).AddSeconds(30)
while ((Test-Path "$install/installation.json") -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 100 }
Assert (!(Test-Path "$install/bin/loop.exe")) 'CLI uninstall left executable.'
Assert (Test-Path "$install/my-project.txt") 'Uninstall removed a user file.'
Assert (Test-Path "$unmanaged/keep.txt") 'Unmanaged file was removed.'
# Remove test-only marker-free user file, then verify repeated uninstall.
Remove-Item -LiteralPath "$install/my-project.txt"
& $manager -Action Uninstall -InstallDir $install -NoPath -NoRegistry
Write-Host "PASS: install, repeat upgrade, checksum rejection, unmanaged-directory refusal, CLI uninstall, project preservation. Evidence: $testRoot"
