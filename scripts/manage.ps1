# Windows PowerShell 5.1+. Included in every release and served as install.ps1.
[CmdletBinding()]
param(
    [ValidateSet('Install', 'Upgrade', 'Uninstall')][string]$Action = 'Install',
    [string]$Version = 'latest',
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Loop'),
    [switch]$SkipRust,
    [int]$ParentPid = 0,
    # Local release testing; checksum verification still applies.
    [string]$ArchivePath,
    [switch]$NoPath,
    [switch]$NoRegistry
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$repo = 'isaac10334/loop'
$root = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\')
if ($root -eq [IO.Path]::GetPathRoot($root).TrimEnd('\') -or $root.Contains('"')) { throw 'Invalid installation directory.' }
$bin = Join-Path $root 'bin'
$marker = Join-Path $root 'installation.json'
$registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\LoopCLI'
if ($Action -ne 'Uninstall' -and !$NoRegistry -and (Test-Path -LiteralPath $registry)) {
    if ((Get-ItemProperty -LiteralPath $registry).InstallLocation -ne $root) { throw 'Another Loop installation owns the Windows uninstall entry.' }
}
$state = $null
if (Test-Path -LiteralPath $marker) {
    $state = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
    if ($state.product -ne 'isaac10334/loop' -or $state.root -ne $root) { throw 'Unrecognized installation marker.' }
} elseif ((Test-Path -LiteralPath $root) -and @(Get-ChildItem -LiteralPath $root -Force).Count) {
    throw "Refusing to modify an unrecognized directory: $root"
}
function Get-UserPath { [string][Environment]::GetEnvironmentVariable('Path', 'User') }
function Test-PathEntry([string]$Value, [string]$Entry) {
    @($Value -split ';' | Where-Object { [Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ieq $Entry.TrimEnd('\') }).Count -gt 0
}
function Remove-EmptyDirectory([string]$Directory) {
    if ((Test-Path -LiteralPath $Directory) -and @(Get-ChildItem -LiteralPath $Directory -Force).Count -eq 0) { Remove-Item -LiteralPath $Directory }
}
if ($ParentPid -gt 0) {
    $parent = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
    if ($parent) {
        Wait-Process -Id $ParentPid -Timeout 30 -ErrorAction SilentlyContinue
        if (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) { throw 'Loop has not exited. Close it and rerun the installer.' }
    }
}
if ($Action -eq 'Uninstall') {
    if (!$state) { Write-Host 'Loop is already uninstalled.'; return }
    # Only remove files owned by this installer. Preserve projects and unknown files.
    foreach ($name in @('loop.exe', 'loop.previous.exe')) {
        $file = Join-Path $bin $name
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
    }
    if ($state.addedPath -and !$NoPath) {
        $entries = @((Get-UserPath) -split ';' | Where-Object { !([Environment]::ExpandEnvironmentVariables($_).TrimEnd('\') -ieq $bin) })
        [Environment]::SetEnvironmentVariable('Path', ($entries -join ';'), 'User')
    }
    if (!$NoRegistry -and (Test-Path -LiteralPath $registry)) {
        if ((Get-ItemProperty -LiteralPath $registry).InstallLocation -eq $root) { Remove-Item -LiteralPath $registry }
    }
    foreach ($name in @('manage.ps1', 'installation.json')) {
        $file = Join-Path $root $name
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
    }
    Remove-EmptyDirectory $bin
    Remove-EmptyDirectory $root
    Write-Host 'Loop uninstalled. Your projects and Rust toolchains were kept. Open a new terminal to refresh PATH.'
    return
}
if ($Action -eq 'Upgrade' -and !$state) { throw 'No managed Loop installation found. Run the installer first.' }
$conflicts = @(Get-Command loop -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -ne (Join-Path $bin 'loop.exe') })
if ($conflicts.Count -and !$NoPath) { throw "Another loop command is on PATH: $($conflicts.Source -join ', '). Remove that installation before installing here." }
if ($Version -ne 'latest' -and $Version -notmatch '^v?\d+\.\d+\.\d+$') { throw 'Version must be latest or a version such as 0.1.0.' }
if (![Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { throw 'This release supports Windows x64 only.' }
New-Item -ItemType Directory -Force -Path $root | Out-Null
$stage = Join-Path $root ('.install-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    $archive = Join-Path $stage 'loop-windows-x64.zip'
    $checksum = "$archive.sha256"
    if ($ArchivePath) {
        Copy-Item -LiteralPath $ArchivePath -Destination $archive
        Copy-Item -LiteralPath "$ArchivePath.sha256" -Destination $checksum
    } else {
        $tag = if ($Version -eq 'latest') { (Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest").tag_name } else { 'v' + $Version.TrimStart('v') }
        if ($tag -notmatch '^v\d+\.\d+\.\d+$') { throw 'Unexpected release version.' }
        $base = "https://github.com/$repo/releases/download/$tag"
        Invoke-WebRequest "$base/loop-windows-x64.zip" -UseBasicParsing -OutFile $archive
        Invoke-WebRequest "$base/loop-windows-x64.zip.sha256" -UseBasicParsing -OutFile $checksum
    }
    $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
    if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ine $expected) { throw 'Release checksum verification failed.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -notin @('loop.exe', 'manage.ps1', 'release.json', 'LICENSE-MIT', 'LICENSE-APACHE')) { throw "Unexpected archive entry: $($entry.FullName)" }
        }
    } finally { $zip.Dispose() }
    $payload = Join-Path $stage 'payload'
    Expand-Archive -LiteralPath $archive -DestinationPath $payload
    $release = Get-Content -LiteralPath (Join-Path $payload 'release.json') -Raw | ConvertFrom-Json
    if ($release.version -notmatch '^\d+\.\d+\.\d+$' -or $release.rust -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release metadata.' }
    if (!$ArchivePath -and ('v' + $release.version) -ne $tag) { throw 'Release metadata does not match requested version.' }
    $actualVersion = & (Join-Path $payload 'loop.exe') --version
    if ($LASTEXITCODE -ne 0 -or $actualVersion.Trim() -ne "loop $($release.version)") { throw 'Downloaded CLI failed its version check.' }
    if (!$SkipRust) {
        $cargoDir = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
        $rustup = Join-Path $cargoDir 'bin\rustup.exe'
        if (!(Test-Path -LiteralPath $rustup)) {
            $found = Get-Command rustup -ErrorAction SilentlyContinue
            if ($found) { $rustup = $found.Source } else {
                Write-Host 'Installing rustup from rust-lang.org (user account only).'
                $init = Join-Path $stage 'rustup-init.exe'
                $url = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
                Invoke-WebRequest $url -UseBasicParsing -OutFile $init
                $hash = ((Invoke-WebRequest "$url.sha256" -UseBasicParsing).Content.Trim() -split '\s+')[0]
                if ((Get-FileHash -LiteralPath $init -Algorithm SHA256).Hash -ine $hash) { throw 'rustup checksum verification failed.' }
                & $init -y --profile minimal --default-toolchain none --no-modify-path
                if ($LASTEXITCODE) { throw 'rustup installation failed.' }
            }
        }
        Write-Host "Installing/checking Rust $($release.rust) and wasm32-wasip2. Existing default toolchain stays unchanged."
        & $rustup toolchain install $release.rust --profile minimal --target wasm32-wasip2
        if ($LASTEXITCODE) { throw 'Rust toolchain installation failed. Rerun the installer to retry.' }
        $cargoBin = Split-Path $rustup -Parent
        if (!$NoPath -and !(Test-PathEntry (Get-UserPath) $cargoBin)) {
            [Environment]::SetEnvironmentVariable('Path', (((Get-UserPath).TrimEnd(';') + ';' + $cargoBin).TrimStart(';')), 'User')
        }
    }
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    $exe = Join-Path $bin 'loop.exe'
    $backup = Join-Path $bin 'loop.previous.exe'
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
    if (Test-Path -LiteralPath $exe) { Move-Item -LiteralPath $exe -Destination $backup }
    try { Copy-Item -LiteralPath (Join-Path $payload 'loop.exe') -Destination $exe }
    catch {
        if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $exe -Force }
        throw
    }
    Copy-Item -LiteralPath (Join-Path $payload 'manage.ps1') -Destination (Join-Path $root 'manage.ps1') -Force
    $addedPath = if ($state) { [bool]$state.addedPath } else { !$NoPath -and !(Test-PathEntry (Get-UserPath) $bin) }
    @{ product = $repo; root = $root; version = $release.version; addedPath = $addedPath } | ConvertTo-Json | Set-Content -LiteralPath $marker -Encoding UTF8
    if (!$NoPath -and !(Test-PathEntry (Get-UserPath) $bin)) {
        [Environment]::SetEnvironmentVariable('Path', (((Get-UserPath).TrimEnd(';') + ';' + $bin).TrimStart(';')), 'User')
    }
    if (!$NoRegistry) {
        if ((Test-Path -LiteralPath $registry) -and (Get-ItemProperty -LiteralPath $registry).InstallLocation -ne $root) { throw 'Another Loop installation owns the Windows uninstall entry.' }
        New-Item -Path $registry -Force | Out-Null
        $uninstall = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $root 'manage.ps1') + '" -Action Uninstall -InstallDir "' + $root + '"'
        foreach ($pair in @{ DisplayName = 'Loop CLI'; DisplayVersion = $release.version; Publisher = 'Isaac Harvey'; InstallLocation = $root; UninstallString = $uninstall }.GetEnumerator()) {
            New-ItemProperty -LiteralPath $registry -Name $pair.Key -Value $pair.Value -PropertyType String -Force | Out-Null
        }
    }
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
    Write-Host "Loop $($release.version) installed. Open a new terminal, then run: loop doctor"
    Write-Host 'Upgrade: loop upgrade | Remove: loop uninstall (or Windows Settings > Apps > Loop CLI)'
} finally {
    # The randomly named staging directory was created by this invocation under root.
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if (!$resolvedStage.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging cleanup path.' }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
