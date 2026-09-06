$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$engine = Join-Path $root "voice_engine"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop est requis pour le moteur vocal local SOPHENIC."
}

$engineEnv = Join-Path $engine ".env"
if (-not (Test-Path $engineEnv)) {
  Copy-Item -LiteralPath (Join-Path $engine ".env.example") -Destination $engineEnv
}

$engineLines = @(Get-Content -LiteralPath $engineEnv)
$keyLine = $engineLines | Where-Object { $_ -match '^SOPHENIC_VOICE_SERVICE_KEY=' } | Select-Object -First 1
$voiceKey = if ($keyLine) { ($keyLine -split '=', 2)[1].Trim() } else { "" }
if (-not $voiceKey -or $voiceKey -eq "replace-with-a-long-random-secret") {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $voiceKey = [Convert]::ToBase64String($bytes)
  $engineLines = @($engineLines | Where-Object { $_ -notmatch '^SOPHENIC_VOICE_SERVICE_KEY=' })
  $engineLines = @("SOPHENIC_VOICE_SERVICE_KEY=$voiceKey") + $engineLines
  [IO.File]::WriteAllLines($engineEnv, [string[]]$engineLines, $utf8NoBom)
}

# Pair Electron with the local engine. The service key never enters React.
$runtimeDir = Join-Path $env:LOCALAPPDATA "Sophenic"
$runtimeEnv = Join-Path $runtimeDir "sophenic.env"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$runtimeLines = if (Test-Path $runtimeEnv) { @(Get-Content -LiteralPath $runtimeEnv) } else { @() }
$runtimeLines = @($runtimeLines | Where-Object { $_ -notmatch '^SOPHENIC_VOICE_SERVICE_(URL|KEY)=' })
$runtimeLines += "SOPHENIC_VOICE_SERVICE_URL=http://127.0.0.1:8765"
$runtimeLines += "SOPHENIC_VOICE_SERVICE_KEY=$voiceKey"
[IO.File]::WriteAllLines($runtimeEnv, [string[]]$runtimeLines, $utf8NoBom)

Push-Location $root
try {
  docker compose -f voice_engine/docker-compose.yml up -d --build
  docker compose -f voice_engine/docker-compose.yml ps
} finally {
  Pop-Location
}

Write-Host "SOPHENIC Native Voice est demarre et appaire au Desktop." -ForegroundColor Green
Write-Host "Redemarre SOPHENIC, puis ouvre le microphone dans le chat." -ForegroundColor Green
