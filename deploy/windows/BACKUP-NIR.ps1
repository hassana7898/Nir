# =============================================================================
# NIR backup - PostgreSQL dump + uploads + configuration, packed into a single
# timestamped ZIP under data\backups. Safe to run any time (no downtime).
# =============================================================================
[CmdletBinding()]
param([int]$Keep = 30)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

$Root = Resolve-NirRoot -Start $PSScriptRoot
$envMap = Read-DotEnv -Path (Join-Path $Root '.env')
$dbUrl = [string]$envMap['DATABASE_URL']
if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw 'DATABASE_URL is missing in .env.' }

$stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$backupDir = Join-Path $Root 'data\backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$work = Join-Path $env:TEMP ('nir-backup-' + $stamp)
New-Item -ItemType Directory -Force -Path $work | Out-Null

Write-Step 'Dumping PostgreSQL'
$pgBin = Get-PostgresBin
if (-not $pgBin) { throw 'PostgreSQL tools (pg_dump) not found. Add PostgreSQL\bin to PATH.' }
$dumpFile = Join-Path $work 'database.dump'
& (Join-Path $pgBin 'pg_dump.exe') $dbUrl -F c -f $dumpFile
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
Write-Ok ('Database dump: ' + (Get-Item $dumpFile).Length + ' bytes')

Write-Step 'Collecting uploads and configuration'
$uploads = Join-Path $Root 'data\uploads'
if (Test-Path -LiteralPath $uploads) { Copy-Item -LiteralPath $uploads -Destination (Join-Path $work 'uploads') -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $Root '.env') -Destination (Join-Path $work '.env') -Force -ErrorAction SilentlyContinue

$zipPath = Join-Path $backupDir ('nir-backup-' + $stamp + '.zip')
Write-Step 'Creating backup archive'
Compress-Archive -Path (Join-Path $work '*') -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
Write-Ok ('Backup created: ' + $zipPath)

# Retention
$old = Get-ChildItem -LiteralPath $backupDir -Filter 'nir-backup-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep
foreach ($f in $old) { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue }
Write-Host ('Kept the newest ' + $Keep + ' backups in ' + $backupDir)
exit 0
