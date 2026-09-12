# =============================================================================
# NIR uninstall - removes tasks, firewall rules and running processes.
# Data (database dumps, uploads, backups) is preserved unless -RemoveData.
# =============================================================================
[CmdletBinding()]
param([switch]$RemoveData)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

$Root = Resolve-NirRoot -Start $PSScriptRoot
Write-Warn ('Uninstalling NIR from ' + $Root)

foreach ($t in @('NIR Factory Server', 'NIR Caddy Proxy', 'NIR DDNS Updater', 'NIR PostgreSQL')) {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue
    Write-Ok ('Removed task: ' + $t)
  }
}

foreach ($rule in @('NIR LAN Server (TCP 3000)', 'NIR HTTPS Proxy (TCP 443)')) {
  Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  Write-Ok ('Removed firewall rule: ' + $rule)
}

Get-Process node, caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if ($RemoveData) {
  foreach ($d in @('data', 'logs', 'dist', 'runtime', 'server.cjs', 'db-migrate.cjs', '.env', 'Caddyfile')) {
    $p = Join-Path $Root $d
    if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue; Write-Ok ('Deleted: ' + $d) }
  }
  Write-Warn 'All NIR data has been deleted. PostgreSQL database (nir_db) was left intact.'
} else {
  Write-Host 'Data folders were preserved (data\, logs\).'
}
Write-Ok 'Uninstall complete.'
exit 0
