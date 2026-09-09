param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$checkout = Split-Path $PSScriptRoot -Parent
$cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
$bin = Join-Path $cargoHome 'bin'
$destination = Join-Path $bin 'loop.exe'
$marker = Join-Path $bin 'loop-install-source.txt'
$conflicts = @(Get-Command loop -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -ne $destination })
if ($conflicts.Count) { throw "Existing loop command conflicts: $($conflicts.Source -join ', ')" }
if ((Test-Path -LiteralPath $destination) -and !(Test-Path -LiteralPath $marker)) {
    throw "Refusing to replace an unrecognized loop.exe at $destination"
}
if (!$SkipBuild) {
    Push-Location $checkout
    try { cargo +1.98.0 build --locked -p loop-cli; if ($LASTEXITCODE) { throw 'CLI build failed' } }
    finally { Pop-Location }
}
New-Item -ItemType Directory -Force -Path $bin | Out-Null
Copy-Item -LiteralPath (Join-Path $checkout 'target/debug/loop.exe') -Destination $destination -Force
Set-Content -LiteralPath $marker -Value $checkout
$oldPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = @($oldPath -split ';' | Where-Object { $_ })
$present = @($entries | Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ieq $bin.TrimEnd('\') }).Count -gt 0
if (!$present) {
    $newPath = if ([string]::IsNullOrEmpty($oldPath)) { $bin } elseif ($oldPath.EndsWith(';')) { "$oldPath$bin" } else { "$oldPath;$bin" }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
}
if (!(@($env:Path -split ';') -contains $bin)) { $env:Path += ";$bin" }
& $destination --version
Write-Host "Installed $destination. Open a new terminal to refresh PATH."
