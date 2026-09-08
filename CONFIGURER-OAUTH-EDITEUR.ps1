$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "SOPHENIC - Provisionnement unique OAuth multi-utilisateur" -ForegroundColor Cyan
Write-Host "Ce script est reserve a l'editeur SOPHENIC." -ForegroundColor Yellow
Write-Host "Les Client Secrets restent uniquement dans oauth-broker/.env et ne sont jamais livres dans Electron." -ForegroundColor Yellow
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$brokerDir = Join-Path $root "oauth-broker"
$targetFile = Join-Path $brokerDir ".env"
New-Item -ItemType Directory -Force -Path $brokerDir | Out-Null

$values = [ordered]@{}
if (Test-Path $targetFile) {
  foreach ($line in Get-Content -LiteralPath $targetFile) {
    if ($line -match '^\s*([^#=][^=]*)=(.*)$') { $values[$matches[1].Trim()] = $matches[2] }
  }
}

function Read-Plain([string]$Key, [string]$Label, [string]$Default = "") {
  $current = if ($values[$Key]) { [string]$values[$Key] } else { $Default }
  $suffix = if ($current) { " [Entree pour conserver]" } else { "" }
  $answer = Read-Host "$Label$suffix"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $current }
  return $answer.Trim()
}

function Read-Secret([string]$Key, [string]$Label) {
  $current = if ($values[$Key]) { [string]$values[$Key] } else { "" }
  $suffix = if ($current) { " [deja configure - Entree pour conserver]" } else { "" }
  $secure = Read-Host "$Label$suffix" -AsSecureString
  if ($secure.Length -eq 0) { return $current }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function New-RandomSecret([int]$Bytes = 48) {
  $data = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($data) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($data)
}

$values["OAUTH_PUBLIC_BASE_URL"] = Read-Plain "OAUTH_PUBLIC_BASE_URL" "URL HTTPS publique du broker (ex. https://connect.sophenic.ai)" "https://connect.sophenic.example"
if (-not $values["OAUTH_DISTRIBUTION_KEY"] -or ([string]$values["OAUTH_DISTRIBUTION_KEY"]).Length -lt 32) {
  $values["OAUTH_DISTRIBUTION_KEY"] = New-RandomSecret 48
  Write-Host "Cle de distribution generee automatiquement." -ForegroundColor Green
}
$values["OAUTH_ALLOWED_LOOPBACK_PORT"] = "43823"
$values["OAUTH_SESSION_TTL_SECONDS"] = "300"

$providers = @(
  @{ Name="Vercel App"; Id="VERCEL"; Secret="CLIENT_SECRET"; Hint="App Vercel multi-utilisateur" },
  @{ Name="Supabase OAuth App"; Id="SUPABASE"; Secret="CLIENT_SECRET"; Hint="OAuth App dans les parametres de l'organisation Supabase" },
  @{ Name="Cloudflare OAuth Client"; Id="CLOUDFLARE"; Secret="CLIENT_SECRET"; Hint="OAuth Client public/confidentiel Cloudflare" },
  @{ Name="Google (Gmail, Drive, Calendar, Firebase)"; Id="GOOGLE"; Secret="CLIENT_SECRET"; Hint="OAuth Client Web cote broker" },
  @{ Name="Notion Public Connection"; Id="NOTION"; Secret="CLIENT_SECRET"; Hint="Public connection, pas un token ntn_ interne" },
  @{ Name="Stripe Connect"; Id="STRIPE"; Secret="SECRET_KEY"; Hint="Client ID Connect + cle secrete plateforme" },
  @{ Name="Shopify App"; Id="SHOPIFY"; Secret="CLIENT_SECRET"; Hint="App Dev Dashboard distribuable a plusieurs boutiques" },
  @{ Name="WordPress.com OAuth App"; Id="WORDPRESS"; Secret="CLIENT_SECRET"; Hint="Application WordPress.com" }
)

foreach ($provider in $providers) {
  Write-Host ""
  Write-Host "--- $($provider.Name) ---" -ForegroundColor Green
  Write-Host $provider.Hint -ForegroundColor DarkGray
  $clientKey = "OAUTH_$($provider.Id)_CLIENT_ID"
  $secretKey = "OAUTH_$($provider.Id)_$($provider.Secret)"
  $values[$clientKey] = Read-Plain $clientKey "Client ID"
  $values[$secretKey] = Read-Secret $secretKey "Secret editeur"
}

$values["OAUTH_CLOUDFLARE_SCOPES"] = Read-Plain "OAUTH_CLOUDFLARE_SCOPES" "Scopes Cloudflare" "openid profile email"
$values["OAUTH_STRIPE_SCOPE"] = Read-Plain "OAUTH_STRIPE_SCOPE" "Scope Stripe Connect" "read_write"
$values["OAUTH_SHOPIFY_SCOPES"] = Read-Plain "OAUTH_SHOPIFY_SCOPES" "Scopes Shopify" "read_products,read_orders,write_products"

$lines = @(
  "# Configuration confidentielle du broker SOPHENIC - NE JAMAIS livrer avec Electron",
  "# Generee par CONFIGURER-OAUTH-EDITEUR.ps1"
)
foreach ($key in $values.Keys) {
  if ($null -ne $values[$key] -and [string]$values[$key] -ne "") {
    $safe = ([string]$values[$key]).Replace("`r", "").Replace("`n", "")
    $lines += "$key=$safe"
  }
}
[IO.File]::WriteAllLines($targetFile, [string[]]$lines, $utf8NoBom)

$public = ([string]$values["OAUTH_PUBLIC_BASE_URL"]).TrimEnd('/')
Write-Host ""
Write-Host "Broker configure : $targetFile" -ForegroundColor Green
Write-Host "Callbacks a enregistrer chez les fournisseurs :" -ForegroundColor Cyan
foreach ($providerId in @("vercel","supabase","cloudflare","firebase","gmail","google-drive","calendar","notion","stripe","shopify","wordpress")) {
  Write-Host "  $public/oauth/$providerId/callback" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Ensuite deploie oauth-broker/ derriere HTTPS." -ForegroundColor Cyan
Write-Host "Dans le build Desktop, injecte UNIQUEMENT :" -ForegroundColor Cyan
Write-Host "  SOPHENIC_OAUTH_BROKER_URL=$public" -ForegroundColor Gray
Write-Host "  SOPHENIC_OAUTH_BROKER_DISTRIBUTION_KEY=<la valeur generee dans oauth-broker/.env>" -ForegroundColor Gray
Write-Host "Les utilisateurs finaux n'auront aucune cle a saisir : ils cliqueront seulement sur Connecter." -ForegroundColor Green
