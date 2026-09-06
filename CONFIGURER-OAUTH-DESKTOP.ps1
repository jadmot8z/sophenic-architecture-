$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
try { chcp 65001 > $null } catch {}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$envPath = Join-Path $PSScriptRoot ".env.local"
$defaultGithubClientId = "Ov23livNj43OaKhQspRt"

function Set-EnvValue([string]$Name, [string]$Value) {
  $lines = @()
  if (Test-Path $envPath) { $lines = @(Get-Content $envPath -Encoding UTF8) }
  $pattern = "^" + [Regex]::Escape($Name) + "="
  $updated = $false
  $result = foreach ($line in $lines) {
    if ($line -match $pattern) {
      if (-not $updated) { "$Name=$Value"; $updated = $true }
    } else { $line }
  }
  if (-not $updated) { $result += "$Name=$Value" }
  [IO.File]::WriteAllLines($envPath, [string[]]$result, [Text.UTF8Encoding]::new($false))
}

Write-Host ""
Write-Host "SOPHENIC 10.1.0 - Connexions développeur" -ForegroundColor Cyan
Write-Host ""
Write-Host "GitHub utilise maintenant le Device Flow officiel." -ForegroundColor Green
Write-Host "Aucun Client Secret GitHub n'est nécessaire dans l'application Desktop." -ForegroundColor Green
Write-Host "Active seulement 'Enable Device Flow' dans l'OAuth App GitHub SOPHENIC AI Developer." -ForegroundColor Yellow
Write-Host ""

$githubClientId = Read-Host "GitHub Client ID public [$defaultGithubClientId]"
if ([string]::IsNullOrWhiteSpace($githubClientId)) { $githubClientId = $defaultGithubClientId }
$githubClientId = $githubClientId.Trim()
if ($githubClientId -notmatch '^[A-Za-z0-9_]{10,200}$') { throw "GitHub Client ID invalide." }
Set-EnvValue "SOPHENIC_GITHUB_CLIENT_ID" $githubClientId

Write-Host ""
Write-Host "Configuration publique GitHub enregistrée dans $envPath" -ForegroundColor Green
Write-Host "Pour les tokens : ouvre SOPHENIC → Paramètres → Connexions développeur." -ForegroundColor Cyan
Write-Host "- GitHub PAT : github_pat_... ou ghp_... (facultatif si tu utilises Connecter GitHub)" -ForegroundColor DarkGray
Write-Host "- Vercel PAT : vcp_..." -ForegroundColor DarkGray
Write-Host ""
Write-Host "Redémarre SOPHENIC : npm run sophenic:start" -ForegroundColor Cyan
