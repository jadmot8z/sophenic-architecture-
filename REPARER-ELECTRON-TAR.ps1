$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "=== SOPHENIC 10.0.2 - HOTFIX EXTRACTION ELECTRON ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".\package.json")) {
    throw "Place ce script dans la racine sophenic_Oauth, a cote de package.json."
}

$Version = "37.2.6"
$Arch = (& node -p "process.arch").Trim()
if ($Arch -ne "x64" -and $Arch -ne "arm64") {
    throw "Architecture non supportee : $Arch"
}

$Asset = "electron-v$Version-win32-$Arch.zip"
$TempDir = Join-Path $env:TEMP "sophenic-electron-$Version-$Arch"
$ZipPath = Join-Path $TempDir $Asset
$SumsPath = Join-Path $TempDir "SHASUMS256.txt"
$ElectronDir = Join-Path $PSScriptRoot "node_modules\electron"
$DistDir = Join-Path $ElectronDir "dist"
$StagingDir = Join-Path $env:TEMP "sophenic-electron-staging-$Version-$Arch"
$ExePath = Join-Path $DistDir "electron.exe"
$PathTxt = Join-Path $ElectronDir "path.txt"

$BaseUrl = "https://github.com/electron/electron/releases/download/v$Version"

if (-not (Test-Path $ZipPath)) {
    Write-Host "Archive locale absente. Telechargement..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    Invoke-WebRequest -Uri "$BaseUrl/$Asset" -OutFile $ZipPath -UseBasicParsing
}

if (-not (Test-Path $SumsPath)) {
    Invoke-WebRequest -Uri "$BaseUrl/SHASUMS256.txt" -OutFile $SumsPath -UseBasicParsing
}

Write-Host "Verification SHA-256..." -ForegroundColor Yellow
$Line = Get-Content $SumsPath | Where-Object { $_ -match [regex]::Escape($Asset) } | Select-Object -First 1
if (-not $Line) { throw "SHA officiel introuvable pour $Asset." }

$Expected = (($Line -split "\s+")[0]).Trim().ToLowerInvariant()
$Actual = (Get-FileHash -Path $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()

Write-Host "SHA attendu : $Expected"
Write-Host "SHA obtenu  : $Actual"

if ($Expected -ne $Actual) {
    throw "SHA-256 invalide. Le fichier ne sera pas extrait."
}

Write-Host "SHA-256 OK." -ForegroundColor Green

$Tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $Tar) {
    throw "tar.exe est introuvable sur Windows."
}

Write-Host ""
Write-Host "Preparation d'un dossier temporaire propre..." -ForegroundColor Yellow
Remove-Item -LiteralPath $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

Write-Host "Extraction avec tar.exe (contournement du bug Expand-Archive)..." -ForegroundColor Yellow
& tar.exe -xf $ZipPath -C $StagingDir
if ($LASTEXITCODE -ne 0) {
    throw "tar.exe a echoue avec le code $LASTEXITCODE."
}

$StagedExe = Join-Path $StagingDir "electron.exe"
if (-not (Test-Path $StagedExe)) {
    throw "L'archive a ete extraite mais electron.exe n'est pas present dans le staging."
}

Write-Host "electron.exe extrait correctement dans le staging." -ForegroundColor Green

Write-Host ""
Write-Host "Installation dans node_modules\electron\dist..." -ForegroundColor Yellow
Remove-Item -LiteralPath $DistDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

# robocopy est plus robuste que Copy-Item pour ce dossier.
& robocopy.exe $StagingDir $DistDir /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
$RoboCode = $LASTEXITCODE
if ($RoboCode -ge 8) {
    throw "robocopy a echoue avec le code $RoboCode."
}

Set-Content -LiteralPath $PathTxt -Value "electron.exe" -NoNewline -Encoding ascii

Start-Sleep -Seconds 2

if (-not (Test-Path $ExePath)) {
    Write-Host ""
    Write-Host "electron.exe etait present dans le staging mais a disparu apres copie." -ForegroundColor Red
    Write-Host "Verifie Windows Security > Protection contre les virus et menaces > Historique de protection." -ForegroundColor Yellow
    throw "electron.exe absent apres installation."
}

$SizeMB = [math]::Round((Get-Item $ExePath).Length / 1MB, 1)

Write-Host ""
Write-Host "SUCCES : Electron est repare." -ForegroundColor Green
Write-Host "electron.exe : $ExePath" -ForegroundColor Green
Write-Host "Taille : $SizeMB MB" -ForegroundColor Green

Write-Host ""
Write-Host "Verification du binaire Electron..." -ForegroundColor Yellow
$VersionOutput = (& $ExePath --version 2>&1 | Out-String).Trim()
if ($VersionOutput) { Write-Host $VersionOutput -ForegroundColor Green }
if (-not (Test-Path $ExePath)) { throw "electron.exe a disparu apres le test." }

Write-Host ""
Write-Host "Tout est OK." -ForegroundColor Green
