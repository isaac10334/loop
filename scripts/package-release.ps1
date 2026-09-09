param([string]$Binary = 'target/release/loop.exe', [string]$OutputDir = 'target/release-assets')
$ErrorActionPreference = 'Stop'
$metadata = cargo metadata --no-deps --format-version 1 | ConvertFrom-Json
if ($LASTEXITCODE) { throw 'Cargo metadata failed.' }
$version = ($metadata.packages | Where-Object name -eq 'loop-cli').version
$reported = & $Binary --version
if ($LASTEXITCODE -or $reported.Trim() -ne "loop $version") { throw 'Release binary version mismatch.' }
New-Item -ItemType Directory -Force $OutputDir | Out-Null
$payload = Join-Path $OutputDir ('payload-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $payload | Out-Null
Copy-Item -LiteralPath $Binary -Destination (Join-Path $payload 'loop.exe')
Copy-Item -LiteralPath scripts/manage.ps1 -Destination $payload
Copy-Item LICENSE-MIT,LICENSE-APACHE $payload
@{version=$version;rust='1.98.0'} | ConvertTo-Json | Set-Content (Join-Path $payload 'release.json') -Encoding UTF8
$archive = Join-Path $OutputDir 'loop-windows-x64.zip'
for ($attempt = 1; $attempt -le 5; $attempt++) {
    try {
        Compress-Archive -Path "$payload/*" -DestinationPath $archive -Force
        break
    } catch {
        if ($attempt -eq 5) { throw }
        # Windows security scanners can briefly hold a freshly copied executable.
        Start-Sleep -Seconds 1
    }
}
((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLower() + '  loop-windows-x64.zip') | Set-Content "$archive.sha256" -Encoding ASCII
Write-Host "Packaged $archive"
