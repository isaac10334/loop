param([string]$Binary = 'target/release/loop.exe')
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $Binary).Path
$stage = Join-Path ([IO.Path]::GetTempPath()) ('loop-release-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $stage | Out-Null
$app = Join-Path $stage 'hello'
$oldHost = $env:LOOP_HOST_SOURCE
try {
    Remove-Item Env:LOOP_HOST_SOURCE -ErrorAction SilentlyContinue
    & $exe create $app --template desktop --language rust --yes
    if ($LASTEXITCODE) { throw 'Create failed.' }
    if (Select-String -LiteralPath "$app/loop.toml" -Pattern 'host_source') { throw 'Generated project refers to a checkout.' }
    & $exe run $app --headless --actions refresh,increment,delayed-increment
    if ($LASTEXITCODE) { throw 'Headless application failed.' }
    & $exe build $app
    if ($LASTEXITCODE) { throw 'Application packaging failed.' }
    $relocated = Join-Path $stage 'relocated'
    # Known generated bundle and destination are both within this test directory.
    Move-Item -LiteralPath "$app/dist/hello" -Destination $relocated
    & "$relocated/hello.exe" --headless
    if ($LASTEXITCODE) { throw 'Relocated application failed.' }
    Write-Host "PASS: checkout-free create/run/build and relocated bundle. Evidence: $stage"
} finally {
    if ($null -eq $oldHost) { Remove-Item Env:LOOP_HOST_SOURCE -ErrorAction SilentlyContinue } else { $env:LOOP_HOST_SOURCE = $oldHost }
}
