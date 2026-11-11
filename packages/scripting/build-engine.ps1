param([Parameter(Mandatory)][string]$Compiler)
$ErrorActionPreference = 'Stop'
$expected = 'bc9d5aa48905e55760f18cb92ed988a34534ff0ce8824a71d6650464f8a68c63'
if ((Get-FileHash -LiteralPath $Compiler).Hash.ToLowerInvariant() -ne $expected) { throw 'Expected pinned wasm-rquickjs 0.4.13 Windows x64 compiler' }
$output = Join-Path $PSScriptRoot 'target/engine'
[string[]]$authored = @('engine/evaluator.js','engine/world.wit','engine/Cargo.lock','wit/services.wit','../ui/wit/surfaces.wit','build-engine.ps1')
function Hash-Inputs([string[]]$paths) {
  [Array]::Sort($paths,[StringComparer]::Ordinal)
  $records = @($paths | ForEach-Object { "$_ $((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $_)).Hash.ToLowerInvariant())" }) -join "`n"
  [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($records))).ToLowerInvariant()
}
function Hash-Source {
  [string[]]$paths = $authored + @('target/engine/Cargo.toml','target/engine/Cargo.lock','target/engine/.cargo/config.toml') + @(Get-ChildItem -LiteralPath (Join-Path $output 'src'),(Join-Path $output 'wit') -Recurse -File | ForEach-Object { [IO.Path]::GetRelativePath($PSScriptRoot,$_.FullName).Replace('\','/') })
  Hash-Inputs $paths
}
$authoredHash = Hash-Inputs $authored
$binary = Join-Path $output 'target/wasm32-wasip2/release/engine.wasm'
$identityPath = Join-Path $output 'build-identity.json'
if ((Test-Path -LiteralPath $identityPath) -and (Test-Path -LiteralPath $binary)) {
  $previous = Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
  if ($previous.authoredSha256 -eq $authoredHash -and $previous.sourceSha256 -eq (Hash-Source) -and $previous.sha256 -eq (Get-FileHash -LiteralPath $binary).Hash.ToLowerInvariant()) { Write-Output $binary; exit 0 }
}
$wit = Join-Path $PSScriptRoot 'target/wit'
New-Item -ItemType Directory -Force (Join-Path $wit 'deps/scripting'),(Join-Path $wit 'deps/ui') | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'engine/world.wit') -Destination (Join-Path $wit 'world.wit')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'wit/services.wit') -Destination (Join-Path $wit 'deps/scripting/services.wit')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../ui/wit/surfaces.wit') -Destination (Join-Path $wit 'deps/ui/surfaces.wit')
& $Compiler generate-wrapper-crate --target wasi-p3 --js (Join-Path $PSScriptRoot 'engine/evaluator.js') --wit $wit --world engine --output $output
if ($LASTEXITCODE -ne 0) { throw 'Engine generation failed' }
$manifestPath = Join-Path $output 'Cargo.toml'
$manifest = [IO.File]::ReadAllText($manifestPath)
if (-not $manifest.Contains('"inter-task-wakeup"')) { throw 'Unexpected compiler template' }
[IO.File]::WriteAllText($manifestPath,$manifest.Replace(', "inter-task-wakeup"',''))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'engine/Cargo.lock') -Destination (Join-Path $output 'Cargo.lock')
$runtimePath = Join-Path $output 'src/internal/runtime_services.rs'
$runtime = [IO.File]::ReadAllText($runtimePath)
if (-not $runtime.Contains('rt.set_memory_limit(0).await;')) { throw 'Unexpected runtime template' }
[IO.File]::WriteAllText($runtimePath,$runtime.Replace('rt.set_memory_limit(0).await;','rt.set_memory_limit(16 * 1024 * 1024).await;').Replace('rt.set_gc_threshold(256 * 1024 * 1024).await;','rt.set_gc_threshold(8 * 1024 * 1024).await;'))
New-Item -ItemType Directory -Force (Join-Path $output '.cargo') | Out-Null
[IO.File]::WriteAllText((Join-Path $output '.cargo/config.toml'),"[target.wasm32-wasip2]`nrustflags = ['-C', 'link-arg=--max-memory=67108864']`n")
if ((Hash-Inputs $authored) -ne $authoredHash) { throw 'Source changed during generation' }
$before = Hash-Source
Push-Location $output
try { & cargo +nightly-2026-09-08 build --release --locked --target wasm32-wasip2 --no-default-features --features p3,encoding; if ($LASTEXITCODE -ne 0) { throw 'Engine compilation failed' } } finally { Pop-Location }
if ((Hash-Source) -ne $before) { throw 'Source changed during build' }
$identity = [ordered]@{ profile='loop-scripting-0.1'; sha256=(Get-FileHash -LiteralPath $binary).Hash.ToLowerInvariant(); bytes=(Get-Item -LiteralPath $binary).Length; sourceSha256=$before; authoredSha256=$authoredHash; compilerSha256=$expected; toolchain='nightly-2026-09-08' }
[IO.File]::WriteAllText($identityPath,($identity | ConvertTo-Json))
Write-Output $binary
