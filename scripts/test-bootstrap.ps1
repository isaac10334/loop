param([string]$ArchivePath = 'target/release-assets/loop-windows-x64.zip')
$ErrorActionPreference = 'Stop'
$manager = Join-Path $PSScriptRoot 'manage.ps1'
$archive = (Resolve-Path -LiteralPath $ArchivePath).Path
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('loop-rust-bootstrap-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$oldCargo = $env:CARGO_HOME
$oldRustup = $env:RUSTUP_HOME
$oldPath = $env:Path
try {
    $env:CARGO_HOME = Join-Path $testRoot 'cargo'
    $env:RUSTUP_HOME = Join-Path $testRoot 'rustup'
    $env:Path = "$env:windir\System32;$env:windir;$env:windir\System32\WindowsPowerShell\v1.0"
    & $manager -ArchivePath $archive -InstallDir (Join-Path $testRoot 'install') -NoPath -NoRegistry
    $rustc = & "$env:CARGO_HOME/bin/rustc.exe" +1.98.0 --version
    if ($LASTEXITCODE -or !$rustc.StartsWith('rustc 1.98.0')) { throw 'Fresh toolchain unavailable.' }
    $targets = & "$env:CARGO_HOME/bin/rustup.exe" target list --installed --toolchain 1.98.0
    if ($LASTEXITCODE -or $targets -notcontains 'wasm32-wasip2') { throw 'Wasm target missing.' }
    & $manager -Action Uninstall -InstallDir (Join-Path $testRoot 'install') -NoPath -NoRegistry
    if (!(Test-Path -LiteralPath "$env:CARGO_HOME/bin/rustup.exe")) { throw 'Uninstall removed Rust.' }
    Write-Host "PASS: fresh rustup download, pinned Rust and WASI target installation, Rust preserved on uninstall. Test directory: $testRoot"
} finally {
    $env:CARGO_HOME = $oldCargo
    $env:RUSTUP_HOME = $oldRustup
    $env:Path = $oldPath
}
