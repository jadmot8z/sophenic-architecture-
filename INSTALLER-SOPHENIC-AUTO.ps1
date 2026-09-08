$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "SOPHENIC Design V8 - Installation et lancement"

function Step([string]$text) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host $text -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
}

try {
  Set-Location $PSScriptRoot
  Step "SOPHENIC Design V8 - Verification du projet"
  if (-not (Test-Path ".\package.json")) { throw "package.json introuvable dans $PSScriptRoot" }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js n'est pas installe ou n'est pas dans PATH." }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm n'est pas disponible dans PATH." }
  Write-Host "Projet : $PSScriptRoot" -ForegroundColor Green
  Write-Host "Node   : $(node --version)"
  Write-Host "npm    : $(npm --version)"

  $depsReady = (Test-Path ".\node_modules\.bin\concurrently.cmd") -and (Test-Path ".\node_modules\electron\dist\electron.exe") -and (Test-Path ".\node_modules\three\package.json")
  if (-not $depsReady) {
    Step "Installation des dependances (premier lancement)"
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install a echoue (code $LASTEXITCODE)." }
  }
  else {
    Step "Dependances deja installees"
    Write-Host "npm install ignore pour accelerer le lancement." -ForegroundColor Green
    & node scripts/prepare-three-assets.mjs
  }

  Step "Tests SOPHENIC"
  & npm run test:sophenic
  if ($LASTEXITCODE -ne 0) { throw "Les tests SOPHENIC ont echoue (code $LASTEXITCODE)." }

  Step "Lancement de SOPHENIC Design V8"
  Write-Host "Laisse cette fenetre ouverte pendant l'utilisation de SOPHENIC." -ForegroundColor Yellow
  & npm run sophenic:start
  if ($LASTEXITCODE -ne 0) { throw "SOPHENIC s'est arrete avec le code $LASTEXITCODE." }
}
catch {
  Write-Host ""
  Write-Host "ERREUR" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ""
  Write-Host "Copie ce message et le log au-dessus pour le diagnostic." -ForegroundColor Yellow
}
finally {
  Write-Host ""
  Read-Host "Appuie sur Entree pour fermer"
}
