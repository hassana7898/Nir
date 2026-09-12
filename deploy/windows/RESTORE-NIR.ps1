# =============================================================================
# NIR restore - restores PostgreSQL + uploads from a backup ZIP produced by
# BACKUP-NIR.ps1. Stops NIR, restores, restarts, verifies health.
# Usage:  .\RESTORE-NIR.ps1 -BackupZip .\data\backups\nir-backup-20260101-120000.zip -Force
# =============================================================================
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupZip,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

$Root = Resolve-NirRoot -Start $PSScriptRoot
if (-not (Test-Path -LiteralPath $BackupZip)) { throw ('Backup not found: ' + $BackupZip) }
if (-not $Force) {
  $confirm = Read-Host 'This will OVERWRITE the current database and uploads. Type RESTORE to continue'
  if ($confirm -ne 'RESTORE') { Write-Warn 'Aborted.'; exit 1 }
}

$envMap = Read-DotEnv -Path (Join-Path $Root '.env')
$dbUrl = [string]$envMap['DATABASE_URL']
if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw 'DATABASE_URL is missing in .env.' }

Write-Step 'Extracting backup'
$work = Join-Path $env:TEMP ('nir-restore-' + (Get-Date).ToString('yyyyMMdd-HHmmss'))
Expand-Archive -LiteralPath $BackupZip -DestinationPath $work -Force
$dumpFile = Join-Path $work 'database.dump'
if (-not (Test-Path -LiteralPath $dumpFile)) { throw 'Backup archive does not contain database.dump.' }

$pgBin = Get-PostgresBin
if (-not $pgBin) { throw 'PostgreSQL tools (pg_restore) not found.' }

Write-Step 'Stopping NIR'
Stop-ScheduledTask -TaskName 'NIR Factory Server' -ErrorAction SilentlyContinue
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Step 'Restoring database'
& (Join-Path $pgBin 'pg_restore.exe') --clean --if-exists --no-owner --no-privileges -d $dbUrl $dumpFile
if ($LASTEXITCODE -ne 0) { Write-Warn 'pg_restore reported warnings; verify data below.' }

Write-Step 'Restoring uploads'
$uploadsBackup = Join-Path $work 'uploads'
if (Test-Path -LiteralPath $uploadsBackup) {
  $uploadsTarget = Join-Path $Root 'data\uploads'
  if (Test-Path -LiteralPath $uploadsTarget) { Remove-Item -LiteralPath $uploadsTarget -Recurse -Force }
  Copy-Item -LiteralPath $uploadsBackup -Destination $uploadsTarget -Recurse -Force
}
Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue

Write-Step 'Starting NIR'
Start-ScheduledTask -TaskName 'NIR Factory Server'
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 3; if ($h.status -eq 'ok') { $ok = $true; break } } catch { }
  Start-Sleep -Milliseconds 500
}
if ($ok) { Write-Ok 'Restore complete; NIR is healthy.' } else { throw 'Restore finished but NIR is not healthy.' }
exit 0
