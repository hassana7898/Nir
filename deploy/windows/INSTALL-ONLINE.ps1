# NIR one-time Windows installation for factory + Internet access.
# Run PowerShell as Administrator from the extracted NIR package.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host '=== NIR Factory Installer ===' -ForegroundColor Cyan

if (-not (Test-Path '.\runtime\node.exe')) { throw 'runtime\node.exe not found. Use the official nir-portable-windows package.' }
if (-not (Test-Path '.\server.cjs')) { throw 'server.cjs not found.' }
if (-not (Test-Path '.\db-migrate.cjs')) { throw 'db-migrate.cjs not found. Rebuild the package from main.' }

# PostgreSQL is intentionally external: it is the authoritative database and should not be bundled with the app.
$pg = Get-Service | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
if (-not $pg) {
  Write-Host 'PostgreSQL was not detected.' -ForegroundColor Yellow
  Write-Host 'Install PostgreSQL 16+ first, then run this script again.'
  Write-Host 'Official installer: https://www.postgresql.org/download/windows/'
  exit 2
}
if ($pg.Status -ne 'Running') { Start-Service $pg.Name }

$pgPassword = Read-Host 'Enter the PostgreSQL password for user postgres' -AsSecureString
$pgPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgPassword))
if ([string]::IsNullOrWhiteSpace($pgPlain)) { throw 'PostgreSQL password cannot be empty.' }

# Create database if it does not exist. psql is supplied by the PostgreSQL Windows installer.
$psql = Get-Command psql.exe -ErrorAction SilentlyContinue
if (-not $psql) { throw 'psql.exe was not found in PATH. Add PostgreSQL\bin to PATH and rerun.' }
$env:PGPASSWORD = $pgPlain
$dbExists = & psql.exe -h 127.0.0.1 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='nir_db'" 2>$null
if (($dbExists | Out-String).Trim() -ne '1') {
  & createdb.exe -h 127.0.0.1 -U postgres nir_db
  if ($LASTEXITCODE -ne 0) { throw 'Could not create nir_db.' }
}

$jwt = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
$envFile = @"
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=postgresql://postgres:$pgPlain@127.0.0.1:5432/nir_db
JWT_SECRET=$jwt
VITE_API_BASE_URL=
API_BASE_URL=
CORS_ORIGIN=https://app.artadan.ir
ALLOWED_ORIGINS=https://app.artadan.ir
CROSS_SITE_COOKIE=1
UPLOAD_DIR=./data/uploads
BACKUP_DIR=./data/backups
GEMINI_API_KEY=
DB_POOL_MAX=20
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000
"@
Set-Content -Path '.\.env' -Value $envFile -Encoding UTF8
$env:DATABASE_URL = "postgresql://postgres:$pgPlain@127.0.0.1:5432/nir_db"
$env:NODE_ENV = 'production'
$env:JWT_SECRET = $jwt
$env:PORT = '3000'
$env:NIR_DIST_PATH = (Join-Path $Root 'dist')

Write-Host 'Applying NIR PostgreSQL schema...' -ForegroundColor Cyan
& '.\runtime\node.exe' '.\db-migrate.cjs'
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }

New-Item -ItemType Directory -Force -Path '.\data\uploads', '.\data\backups' | Out-Null

# NIR starts at Windows boot through Task Scheduler.
$runScript = Join-Path $Root 'deploy\windows\RUN-NIR.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'NIR Factory Server' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'NIR Factory Server'

Write-Host ''
Write-Host 'NIR local server installed.' -ForegroundColor Green
Write-Host 'LAN URL: http://localhost:3000 or http://<factory-PC-IP>:3000'
Write-Host 'Next: configure Cloudflare Tunnel for app.artadan.ir -> http://localhost:3000.' -ForegroundColor Yellow
