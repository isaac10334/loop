param(
  [Parameter(Mandatory)][string]$Compiler,
  [ValidateSet('compatibility', 'lifecycle')][string]$Profile = 'lifecycle'
)
$ErrorActionPreference = 'Stop'
function Get-SourceHash([string[]]$Paths) {
  [Array]::Sort($Paths, [StringComparer]::Ordinal)
  $records = @($Paths | ForEach-Object { "$_ $((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $_)).Hash.ToLowerInvariant())" }) -join "`n"
  return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($records))).ToLowerInvariant()
}
function Get-LifecycleSourceHash {
  [string[]]$paths = @('lifecycle.wit', 'rquickjs-lifecycle.js', 'rquickjs-probe.Cargo.lock', 'prepare-rquickjs-probe.ps1', 'target/rquickjs-lifecycle/Cargo.toml', 'target/rquickjs-lifecycle/Cargo.lock', 'target/rquickjs-lifecycle/.cargo/config.toml') + @(Get-ChildItem -LiteralPath (Join-Path $probeOutput 'src'),(Join-Path $probeOutput 'wit') -File -Recurse | ForEach-Object { [IO.Path]::GetRelativePath($PSScriptRoot, $_.FullName).Replace('\', '/') })
  return Get-SourceHash $paths
}
# Official v0.4.13 Windows x64 executable; tool acquisition stays explicit.
$expectedHash = 'bc9d5aa48905e55760f18cb92ed988a34534ff0ce8824a71d6650464f8a68c63'
if ((Get-FileHash -LiteralPath $Compiler).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Expected the official wasm-rquickjs v0.4.13 Windows x64 executable' }
$lifecycle = $Profile -eq 'lifecycle'
[string[]]$authoredInputs = @('lifecycle.wit', 'rquickjs-lifecycle.js', 'rquickjs-probe.Cargo.lock', 'prepare-rquickjs-probe.ps1')
$beforeAuthoredHash = if ($lifecycle) { Get-SourceHash $authoredInputs } else { '' }
$probeOutput = Join-Path $PSScriptRoot $(if ($lifecycle) { 'target/rquickjs-lifecycle' } else { 'target/rquickjs-wrapper' })
$probeWit = Join-Path $PSScriptRoot $(if ($lifecycle) { 'target/rquickjs-lifecycle-wit' } else { 'target/rquickjs-wit' })
New-Item -ItemType Directory -Force $probeWit | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot $(if ($lifecycle) { 'lifecycle.wit' } else { 'probe.wit' })) -Destination (Join-Path $probeWit 'world.wit')
& $Compiler generate-wrapper-crate --target wasi-p3 --js (Join-Path $PSScriptRoot $(if ($lifecycle) { 'rquickjs-lifecycle.js' } else { 'rquickjs-probe.js' })) --wit $probeWit --world probe --output $probeOutput
if ($LASTEXITCODE -ne 0) { throw 'P3 wrapper generation failed' }
$manifestPath = Join-Path $probeOutput 'Cargo.toml'
$manifest = [IO.File]::ReadAllText($manifestPath)
if (-not $manifest.Contains('"inter-task-wakeup"')) { throw 'Expected v0.4.13 executor feature configuration' }
# Required compatibility experiment: same-thread executor, no inter-task wake stream.
[IO.File]::WriteAllText($manifestPath, $manifest.Replace(', "inter-task-wakeup"', ''))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'rquickjs-probe.Cargo.lock') -Destination (Join-Path $probeOutput 'Cargo.lock')
if ($lifecycle) {
  $runtimePath = Join-Path $probeOutput 'src/internal/runtime_services.rs'
  $runtime = [IO.File]::ReadAllText($runtimePath)
  if (-not $runtime.Contains('rt.set_memory_limit(0).await;')) { throw 'Expected v0.4.13 QuickJS heap setup' }
  [IO.File]::WriteAllText($runtimePath, $runtime.Replace('rt.set_memory_limit(0).await;', 'rt.set_memory_limit(16 * 1024 * 1024).await;').Replace('rt.set_gc_threshold(256 * 1024 * 1024).await;', 'rt.set_gc_threshold(8 * 1024 * 1024).await;'))
  # Independent outer linear-memory bound, enforced by wasm memory.grow itself.
  $configPath = Join-Path $probeOutput '.cargo'
  New-Item -ItemType Directory -Force $configPath | Out-Null
  [IO.File]::WriteAllText((Join-Path $configPath 'config.toml'), "[target.wasm32-wasip2]`nrustflags = ['-C', 'link-arg=--max-memory=67108864']`n")
  if ((Get-SourceHash $authoredInputs) -ne $beforeAuthoredHash) { throw 'Source changed during generation; rebuild' }
  $beforeSourceHash = Get-LifecycleSourceHash
}
Push-Location $probeOutput
try {
  & cargo +nightly-2026-09-08 build --release --locked --target wasm32-wasip2 --no-default-features --features p3,encoding --manifest-path $manifestPath
  if ($LASTEXITCODE -ne 0) { throw 'P3 Component compilation failed' }
} finally { Pop-Location }
if ($lifecycle) {
  # Record build identity here, never at invocation time: edited source must not
  # be attached to stale engine bytes by a later verification driver.
  $sourceHash = Get-LifecycleSourceHash
  if ($sourceHash -ne $beforeSourceHash) { throw 'Source changed during compilation; rebuild' }
  $componentPath = Join-Path $probeOutput 'target/wasm32-wasip2/release/probe.wasm'
  $identity = [ordered]@{ profile = 'rquickjs-lifecycle-proof-0.1'; sha256 = (Get-FileHash -LiteralPath $componentPath).Hash.ToLowerInvariant(); bytes = (Get-Item -LiteralPath $componentPath).Length; sourceSha256 = $sourceHash; compilerSha256 = $expectedHash; toolchain = 'nightly-2026-09-08' }
  [IO.File]::WriteAllText((Join-Path $probeOutput 'build-identity.json'), ($identity | ConvertTo-Json))
}
Write-Output (Join-Path $probeOutput 'target/wasm32-wasip2/release/probe.wasm')
