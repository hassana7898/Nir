# =============================================================================
# NIR portable PostgreSQL supervisor (used only when the installer created a
# private portable PostgreSQL under the NIR folder).
# =============================================================================
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

$Root = Resolve-NirRoot -Start $PSScriptRoot
$pgCtl = Join-Path $Root 'pgsql\bin\pg_ctl.exe'
$dataDir = Join-Path $Root 'data\pgdata'
$logDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$pgLog = Join-Path $logDir 'postgres.log'

if (-not (Test-Path -LiteralPath $pgCtl)) { throw 'Portable PostgreSQL not found (pgsql\bin\pg_ctl.exe).' }

while ($true) {
  $running = $false
  try { & $pgCtl -D $dataDir status *> $null; $running = ($LASTEXITCODE -eq 0) } catch { $running = $false }
  if (-not $running) {
    Add-Content -Path $pgLog -Value ((Get-Date).ToString('s') + '  starting PostgreSQL') -Encoding UTF8
    & $pgCtl -D $dataDir -l $pgLog start
  }
  Start-Sleep -Seconds 30
}
