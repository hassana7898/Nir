# =============================================================================
# NIR health check - human readable status of the local install and the
# Internet exposure. Run on the factory PC (or any machine) to diagnose.
# =============================================================================
[CmdletBinding()]
param([string]$Domain = 'app.artadan.ir', [int]$AppPort = 3000)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

$Root = Resolve-NirRoot -Start $PSScriptRoot
$envMap = Read-DotEnv -Path (Join-Path $Root '.env')
if ($envMap['PORT']) { $AppPort = [int]$envMap['PORT'] }

Write-Host ''
Write-Host '=== NIR STATUS ===' -ForegroundColor Cyan

# Local server
$server = if (Test-PortListening -Port $AppPort) { 'RUNNING' } else { 'STOPPED' }
$color = if ($server -eq 'RUNNING') { 'Green' } else { 'Red' }
Write-Host ('NIR server (:' + $AppPort + ') : ') -NoNewline; Write-Host $server -ForegroundColor $color

try {
  $h = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $AppPort + '/api/health') -TimeoutSec 5
  Write-Host ('API health           : ') -NoNewline; Write-Host $h.status -ForegroundColor $(if ($h.status -eq 'ok') { 'Green' } else { 'Yellow' })
  Write-Host ('Database             : ') -NoNewline; Write-Host $h.database.status -ForegroundColor $(if ($h.database.status -eq 'connected') { 'Green' } else { 'Red' })
} catch {
  Write-Host 'API health           : ' -NoNewline; Write-Host 'UNREACHABLE' -ForegroundColor Red
}

# PostgreSQL
$pg = Get-PostgresService
if ($pg) { Write-Host ('PostgreSQL service   : ' + $pg.Status) }
elseif (Test-PortListening -Port 5432) { Write-Host 'PostgreSQL           : RUNNING (portable, 127.0.0.1:5432)' }
else { Write-Host 'PostgreSQL           : NOT DETECTED' -ForegroundColor Yellow }

# Reverse proxy
if (Test-PortListening -Port 443) { Write-Host 'HTTPS proxy (443)    : RUNNING' -ForegroundColor Green }
else { Write-Host 'HTTPS proxy (443)    : not running' -ForegroundColor Yellow }

# Scheduled tasks
foreach ($t in @('NIR Factory Server', 'NIR Caddy Proxy', 'NIR DDNS Updater', 'NIR PostgreSQL')) {
  $task = Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
  if ($task) { Write-Host ('Task ' + $t.PadRight(20) + ': ' + $task.State) }
}

# Network
$lanIp = Get-LocalIPv4
$publicV4 = Get-PublicIPv4
$publicV6 = Get-PublicIPv6
Write-Host ''
Write-Host ('LAN URL   : http://' + $(if ($lanIp) { $lanIp } else { '<pc-ip>' }) + ':' + $AppPort)
Write-Host ('Public v4 : ' + $(if ($publicV4) { $publicV4 } else { 'n/a' }))
Write-Host ('Public v6 : ' + $(if ($publicV6) { $publicV6 } else { 'n/a' }))

# Internet check
Write-Host ''
Write-Host ('Internet  : https://' + $Domain) -NoNewline
try {
  $r = Invoke-WebRequest -Uri ('https://' + $Domain + '/api/health') -TimeoutSec 12 -UseBasicParsing
  if ($r.StatusCode -eq 200) { Write-Host '  REACHABLE' -ForegroundColor Green } else { Write-Host ('  HTTP ' + $r.StatusCode) -ForegroundColor Yellow }
} catch {
  Write-Host '  NOT REACHABLE from here' -ForegroundColor Yellow
  Write-Host '  (Expected until DNS resolves and the router forwards 443; see docs/Internet-Access.md)'
}

# DDNS log tail
$ddnsLog = Join-Path $Root 'logs\ddns.log'
if (Test-Path -LiteralPath $ddnsLog) {
  Write-Host ''
  Write-Host 'Last DDNS updates:'
  Get-Content -LiteralPath $ddnsLog -Tail 3 | ForEach-Object { Write-Host ('  ' + $_) }
}
Write-Host ''
exit 0
