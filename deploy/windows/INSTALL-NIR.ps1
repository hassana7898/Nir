# =============================================================================
# NIR Factory - one-click local installer for the factory Windows PC.
# Run as Administrator from the extracted NIR package:
#     powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALL-NIR.ps1
#
# Installs NIR (server + frontend + migration) against PostgreSQL, configures
# firewall, auto-start on boot, verifies /api/health, then optionally sets up
# Internet access (see INSTALL-INTERNET.ps1). Idempotent: safe to run twice.
# =============================================================================

[CmdletBinding()]
param(
  [string]$Domain = 'app.artadan.ir',
  [string]$PgHost = '127.0.0.1',
  [int]$PgPort = 5432,
  [string]$PgUser = 'postgres',
  [string]$PgPassword = '',
  [string]$DatabaseName = 'nir_db',
  [int]$AppPort = 3000,
  [switch]$SkipInternet,
  [switch]$InstallPortablePostgres,
  [switch]$Force,
  [switch]$Unattended
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

function Install-NirPortablePostgres {
  [CmdletBinding()]
  param([string]$Root)

  $pgRoot = Join-Path $Root 'pgsql'
  $dataDir = Join-Path $Root 'data\pgdata'
  $zipPath = Join-Path $env:TEMP 'nir-postgres-binaries.zip'
  # Pinned, admin-free Windows binaries from EnterpriseDB.
  $url = 'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip'

  Write-Step 'Downloading portable PostgreSQL 16 (approx. 300 MB, one time)'
  try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $zipPath -TimeoutSec 900 -UseBasicParsing
  } catch {
    throw ('Could not download PostgreSQL binaries: ' + $_.Exception.Message + '. Install PostgreSQL 16+ manually and re-run.')
  }

  Write-Step 'Extracting PostgreSQL'
  if (Test-Path -LiteralPath $pgRoot) { Remove-Item -LiteralPath $pgRoot -Recurse -Force }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $Root -Force
  if (-not (Test-Path -LiteralPath (Join-Path $pgRoot 'bin\initdb.exe'))) { throw 'Unexpected PostgreSQL archive layout.' }

  $script:PortablePgPassword = New-NirSecret -Bytes 18
  $pwFile = Join-Path $env:TEMP 'nir-pg-pw.txt'
  Set-Content -Path $pwFile -Value $script:PortablePgPassword -Encoding ASCII -NoNewline

  Write-Step 'Initialising PostgreSQL data directory'
  if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
    & (Join-Path $pgRoot 'bin\initdb.exe') -D $dataDir -U postgres -A scram-sha-256 ('--pwfile=' + $pwFile) -E UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
  }
  Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue

  Write-Step 'Registering PostgreSQL auto-start task'
  $pgRun = Join-Path $Root 'deploy\windows\RUN-POSTGRES.ps1'
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $pgRun + '"')
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName 'NIR PostgreSQL' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $pgRun
  for ($i = 0; $i -lt 30; $i++) { if (Test-PortListening -Port 5432) { break }; Start-Sleep -Milliseconds 500 }
  Write-Ok 'Portable PostgreSQL is running on 127.0.0.1:5432'
  return (Join-Path $pgRoot 'bin')
}

$Root = Resolve-NirRoot -Start $PSScriptRoot
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Start-Transcript -Path (Join-Path $LogDir 'install-nir.log') -Append | Out-Null

try {
  Write-Host ''
  Write-Host '=== NIR Factory Installer ===' -ForegroundColor Cyan
  Write-Host ('Package root: ' + $Root)
  Write-Host ''

  # ---- 0. Preflight -----------------------------------------------------------
  Write-Step 'Checking platform and package integrity'
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { throw 'Administrator privileges are required. Right-click the package -> Run as Administrator.' }
  if (-not [Environment]::Is64BitOperatingSystem) { throw 'NIR requires 64-bit Windows.' }

  $nodeExe = Join-Path $Root 'runtime\node.exe'
  foreach ($required in @($nodeExe, (Join-Path $Root 'server.cjs'), (Join-Path $Root 'db-migrate.cjs'), (Join-Path $Root 'dist\index.html'))) {
    if (-not (Test-Path -LiteralPath $required)) { throw ('Package is incomplete: missing ' + $required) }
  }
  $nodeVersion = (& $nodeExe --version).Trim()
  Write-Ok ('Bundled Node runtime: ' + $nodeVersion)

  # ---- 1. PostgreSQL ----------------------------------------------------------
  Write-Step 'Checking PostgreSQL'
  $pgBin = Get-PostgresBin
  $pgService = Get-PostgresService
  if (-not $pgBin) {
    Write-Warn 'No PostgreSQL installation was detected.'
    $answer = 'y'
    if (-not $InstallPortablePostgres -and -not $Unattended) {
      $answer = Read-Host 'Download and set up a private portable PostgreSQL for NIR? (Y/n)'
      if ([string]::IsNullOrWhiteSpace($answer)) { $answer = 'y' }
    }
    if ($answer -match '^(y|yes)$') {
      $pgBin = Install-NirPortablePostgres -Root $Root
      $PgHost = '127.0.0.1'; $PgPort = 5432; $PgUser = 'postgres'
      $PgPassword = $script:PortablePgPassword
      $pgService = Get-PostgresService
    } else {
      Write-Err 'PostgreSQL 16+ is required. Install it from https://www.postgresql.org/download/windows/ and run this installer again.'
      exit 2
    }
  } else {
    Write-Ok ('PostgreSQL tools found: ' + $pgBin)
  }

  if ($pgService -and $pgService.Status -ne 'Running') {
    Write-Step ('Starting PostgreSQL service: ' + $pgService.Name)
    Start-Service $pgService.Name
    Start-Sleep -Seconds 2
  }

  if ([string]::IsNullOrWhiteSpace($PgPassword)) {
    if ($Unattended) { throw 'Unattended install requires -PgPassword.' }
    $sec = Read-Host ('Enter the PostgreSQL password for user ' + $PgUser) -AsSecureString
    $PgPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if ([string]::IsNullOrWhiteSpace($PgPassword)) { throw 'PostgreSQL password cannot be empty.' }
  }

  $psql = Join-Path $pgBin 'psql.exe'
  $env:PGPASSWORD = $PgPassword
  Write-Step 'Verifying PostgreSQL connection'
  & $psql -h $PgHost -p $PgPort -U $PgUser -d postgres -tAc 'SELECT 1' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not connect to PostgreSQL. Check the host/port and the superuser password.' }
  Write-Ok 'PostgreSQL connection OK'

  Write-Step ('Ensuring database ' + $DatabaseName + ' exists')
  $dbExists = (& $psql -h $PgHost -p $PgPort -U $PgUser -d postgres -tAc ("SELECT 1 FROM pg_database WHERE datname='" + $DatabaseName + "'") | Out-String).Trim()
  if ($dbExists -ne '1') {
    & (Join-Path $pgBin 'createdb.exe') -h $PgHost -p $PgPort -U $PgUser $DatabaseName
    if ($LASTEXITCODE -ne 0) { throw ('Failed to create database ' + $DatabaseName + '.') }
    Write-Ok ('Database ' + $DatabaseName + ' created')
  } else {
    Write-Ok ('Database ' + $DatabaseName + ' already present')
  }

  # ---- 2. Environment file ----------------------------------------------------
  Write-Step 'Writing configuration (.env)'
  $envPath = Join-Path $Root '.env'
  $jwtSecret = New-NirSecret -Bytes 48
  $dbUrl = 'postgresql://' + $PgUser + ':' + [System.Uri]::EscapeDataString($PgPassword) + '@' + $PgHost + ':' + $PgPort + '/' + $DatabaseName
  $pgBinText = $pgBin
  if ((Test-Path -LiteralPath $envPath) -and (-not $Force)) {
    Write-Warn '.env already exists; keeping it (use -Force to regenerate).'
  } else {
    $envContent = @"
NODE_ENV=production
PORT=$AppPort
HOST=0.0.0.0
DATABASE_URL=$dbUrl
JWT_SECRET=$jwtSecret
VITE_API_BASE_URL=
API_BASE_URL=
CORS_ORIGIN=
ALLOWED_ORIGINS=
CROSS_SITE_COOKIE=1
UPLOAD_DIR=./data/uploads
BACKUP_DIR=./data/backups
PG_BIN=$pgBinText
GEMINI_API_KEY=
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000
"@
    Set-Content -Path $envPath -Value $envContent -Encoding UTF8
    Write-Ok '.env written with a freshly generated JWT_SECRET'
  }
  Import-NirEnv -Root $Root | Out-Null
  $env:NIR_DIST_PATH = (Join-Path $Root 'dist')
  $env:NODE_ENV = 'production'
  $env:PORT = $AppPort

  # ---- 3. Directories ---------------------------------------------------------
  Write-Step 'Creating data directories'
  foreach ($d in @('data\uploads', 'data\backups', 'data\config')) { New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
  Write-Ok 'Data directories ready'

  # ---- 4. Migrations ----------------------------------------------------------
  Write-Step 'Applying PostgreSQL schema (migrations)'
  Push-Location $Root
  try {
    & (Join-Path $Root 'runtime\node.exe') (Join-Path $Root 'db-migrate.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
  } finally { Pop-Location }
  Write-Ok 'Schema applied'

  Write-Step 'Verifying schema'
  $tableCount = (& $psql -h $PgHost -p $PgPort -U $PgUser -d $DatabaseName -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','sessions','invoices','products','farmers','formulas','inventory_transactions')" | Out-String).Trim()
  if ([int]$tableCount -lt 7) { throw ('Schema verification failed: expected core tables, found ' + $tableCount + '.') }
  Write-Ok 'Schema verified'

  # ---- 5. Firewall ------------------------------------------------------------
  Write-Step 'Configuring Windows Firewall (NIR LAN access only)'
  $ruleName = 'NIR LAN Server (TCP 3000)'
  Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $AppPort -Profile Any -ErrorAction Stop | Out-Null
  Write-Ok 'Firewall rule for LAN port created (PostgreSQL is NOT exposed)'

  # ---- 6. Auto-start ----------------------------------------------------------
  Write-Step 'Registering NIR auto-start task'
  $runScript = Join-Path $Root 'deploy\windows\RUN-NIR.ps1'
  if (-not (Test-Path -LiteralPath $runScript)) { $runScript = Join-Path $Root 'RUN-NIR.ps1' }
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $runScript + '"')
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName 'NIR Factory Server' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Write-Ok 'Auto-start task registered (NIR Factory Server)'

  # ---- 7. Start + health ------------------------------------------------------
  Write-Step 'Starting NIR'
  Stop-ScheduledTask -TaskName 'NIR Factory Server' -ErrorAction SilentlyContinue
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $nodeExe } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-ScheduledTask -TaskName 'NIR Factory Server'

  $health = $null
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $health = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $AppPort + '/api/health') -TimeoutSec 3
      if ($health.status -eq 'ok') { break }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  if (-not $health -or $health.status -ne 'ok') {
    throw 'NIR did not become healthy. Check logs\install-nir.log and logs\nir-server.log.'
  }
  Write-Ok ('NIR is healthy (database: ' + $health.database.status + ')')

  $lanIp = Get-LocalIPv4
  Write-Host ''
  Write-Host '==============================' -ForegroundColor Green
  Write-Host ' NIR LOCAL INSTALL COMPLETE' -ForegroundColor Green
  Write-Host '==============================' -ForegroundColor Green
  Write-Host ('Local:   http://127.0.0.1:' + $AppPort)
  if ($lanIp) { Write-Host ('LAN:     http://' + $lanIp + ':' + $AppPort) }
  Write-Host ('Domain:  https://' + $Domain + '  (configure with INSTALL-INTERNET.ps1)')
  Write-Host ''

  # ---- 8. Internet ------------------------------------------------------------
  if (-not $SkipInternet) {
    $internetScript = Join-Path $Root 'INSTALL-INTERNET.ps1'
    if (-not (Test-Path -LiteralPath $internetScript)) { $internetScript = Join-Path $Root 'deploy\windows\INSTALL-INTERNET.ps1' }
    if (Test-Path -LiteralPath $internetScript) {
      Write-Step 'Launching Internet access setup'
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $internetScript -Domain $Domain -AppPort $AppPort
    } else {
      Write-Warn 'INSTALL-INTERNET.ps1 not found; skipping Internet setup.'
    }
  } else {
    Write-Warn 'Internet setup skipped (-SkipInternet).'
  }

  Write-Ok 'Done. See README-FACTORY.txt for daily operations.'
}
catch {
  Write-Err ('Installation failed: ' + $_.Exception.Message)
  throw
}
finally {
  try { Stop-Transcript | Out-Null } catch { }
}
exit 0
