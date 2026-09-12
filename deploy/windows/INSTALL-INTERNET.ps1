# =============================================================================
# NIR Factory - Internet exposure setup (NO Cloudflare, NO VPS).
# Chooses the cheapest viable public-access strategy automatically:
#   A) Public IPv4  -> DDNS + reverse proxy (Caddy/HTTPS) + router port-forward
#   B) Public IPv6  -> AAAA record + reverse proxy (Caddy/HTTPS), no port-forward
#   C) CGNAT only   -> clear guidance + documented zero/low-cost fallbacks
# Reverse proxy terminates HTTPS on 443 and forwards to the NIR server on 3000.
# Never touches camera forwarding (ports 80/81). PostgreSQL is never exposed.
# =============================================================================

[CmdletBinding()]
param(
  [string]$Domain = 'app.artadan.ir',
  [int]$AppPort = 3000,
  [ValidateSet('auto', 'public-ipv4', 'ipv6', 'none')][string]$Strategy = 'auto',
  [string]$DdnsProvider = '',
  [string]$DdnsHostname = '',
  [string]$DdnsToken = '',
  [string]$DdnsUser = '',
  [string]$DdnsPassword = '',
  [switch]$SkipCaddy,
  [switch]$SkipDdns
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

function Get-CaddyExe {
  param([string]$Root)
  $dir = Join-Path $Root 'bin'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $exe = Join-Path $dir 'caddy.exe'
  if (Test-Path -LiteralPath $exe) { return $exe }
  Write-Step 'Downloading Caddy reverse proxy (automatic HTTPS)'
  $zip = Join-Path $env:TEMP 'caddy-win.zip'
  try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri 'https://github.com/caddyserver/caddy/releases/latest/download/caddy_windows_amd64.zip' -OutFile $zip -TimeoutSec 300 -UseBasicParsing
    Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force
  } catch {
    throw ('Could not download Caddy: ' + $_.Exception.Message)
  }
  if (-not (Test-Path -LiteralPath $exe)) { throw 'Caddy executable not found after extraction.' }
  return $exe
}

function Write-Caddyfile {
  param([string]$Root, [string]$Domain, [int]$AppPort, [string]$Email)
  $caddyfile = @"
{
    email $Email
    admin off
}

$Domain {
    encode gzip zstd
    reverse_proxy 127.0.0.1:$AppPort {
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {remote_host}
    }
}
"@
  $path = Join-Path $Root 'Caddyfile'
  Set-Content -Path $path -Value $caddyfile -Encoding ASCII
  return $path
}

function Register-CaddyTask {
  param([string]$Root, [string]$CaddyExe, [string]$Caddyfile)
  $action = New-ScheduledTaskAction -Execute $CaddyExe -Argument ('run --config "' + $Caddyfile + '" --adapter caddyfile') -WorkingDirectory $Root
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName 'NIR Caddy Proxy' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
}

function Set-DdnsConfig {
  param([string]$Root, [string]$Provider, [string]$Hostname, [string]$Token, [string]$User, [string]$Password)
  $dir = Join-Path $Root 'data\config'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $cfg = [ordered]@{
    provider = $Provider
    hostname = $Hostname
    token    = $Token
    username = $User
    password = $Password
    updatedAt = (Get-Date).ToString('o')
  }
  ($cfg | ConvertTo-Json) | Set-Content -Path (Join-Path $dir 'ddns.config.json') -Encoding UTF8
  return (Join-Path $dir 'ddns.config.json')
}

function Register-DdnsTask {
  param([string]$Root)
  $script = Join-Path $Root 'deploy\windows\NIR-DDNS.ps1'
  if (-not (Test-Path -LiteralPath $script)) { $script = Join-Path $Root 'NIR-DDNS.ps1' }
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $script + '"')
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  Register-ScheduledTask -TaskName 'NIR DDNS Updater' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
}

$Root = Resolve-NirRoot -Start $PSScriptRoot
Import-NirEnv -Root $Root | Out-Null
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Start-Transcript -Path (Join-Path $LogDir 'install-internet.log') -Append | Out-Null

try {
  Write-Host ''
  Write-Host '=== NIR Internet Access Setup ===' -ForegroundColor Cyan

  # ---- 1. Network detection ---------------------------------------------------
  Write-Step 'Detecting network capabilities'
  $lanIp = Get-LocalIPv4
  $gateway = Get-DefaultGateway
  $publicV4 = Get-PublicIPv4
  $publicV6 = Get-PublicIPv6
  $cgnat = Test-CgnatRange -PublicIp $publicV4
  $upnp = Invoke-NirUpnp

  Write-Host ('  Local IPv4      : ' + $lanIp)
  Write-Host ('  Default gateway : ' + $gateway)
  Write-Host ('  Public IPv4     : ' + $(if ($publicV4) { $publicV4 } else { '(not reachable)' }))
  Write-Host ('  Public IPv6     : ' + $(if ($publicV6) { $publicV6 } else { '(none)' }))
  Write-Host ('  CGNAT detected  : ' + $(if ($cgnat -eq $true) { 'yes' } elseif ($cgnat -eq $false) { 'no' } else { 'unknown' }))
  if ($upnp.Available) { Write-Host ('  Router (UPnP)   : reachable, WAN IP ' + $upnp.ExternalIP) }
  else { Write-Host ('  Router (UPnP)   : not reachable (' + $upnp.Error + ')') }

  # A router WAN IP that differs from the public IP is a strong CGNAT signal.
  if ($upnp.Available -and $upnp.ExternalIP -and $publicV4 -and $upnp.ExternalIP -ne $publicV4) { $cgnat = $true }

  # ---- 2. Strategy selection --------------------------------------------------
  $chosen = $Strategy
  if ($chosen -eq 'auto') {
    if ($publicV4 -and $cgnat -ne $true) { $chosen = 'public-ipv4' }
    elseif ($publicV6) { $chosen = 'ipv6' }
    else { $chosen = 'none' }
  }
  Write-Step ('Selected strategy: ' + $chosen)

  $dnsRecord = $null
  if ($chosen -eq 'public-ipv4') { $dnsRecord = $publicV4 }
  elseif ($chosen -eq 'ipv6') { $dnsRecord = $publicV6 }

  # ---- 3. DDNS ----------------------------------------------------------------
  if ($chosen -in @('public-ipv4', 'ipv6') -and -not $SkipDdns) {
    if ([string]::IsNullOrWhiteSpace($DdnsProvider) -and -not $SkipDdns) {
      Write-Host ''
      Write-Host 'Dynamic DNS keeps the A/AAAA record pointing at the factory as the IP changes.' -ForegroundColor Yellow
      Write-Host 'Supported providers: duckdns, dynu, noip, custom. Leave blank to skip.' -ForegroundColor Yellow
      $DdnsProvider = Read-Host 'DDNS provider (duckdns/dynu/noip/custom, or blank)'
    }
    if (-not [string]::IsNullOrWhiteSpace($DdnsProvider)) {
      if ([string]::IsNullOrWhiteSpace($DdnsHostname)) { $DdnsHostname = Read-Host 'DDNS hostname (e.g. artadan.duckdns.org)' }
      switch ($DdnsProvider.ToLower()) {
        'duckdns' { if ([string]::IsNullOrWhiteSpace($DdnsToken)) { $DdnsToken = Read-Host 'DuckDNS token' } }
        'dynu'    { if ([string]::IsNullOrWhiteSpace($DdnsUser)) { $DdnsUser = Read-Host 'Dynu username' }; if ([string]::IsNullOrWhiteSpace($DdnsPassword)) { $DdnsPassword = Read-Host 'Dynu password/API key' -AsSecureString | ForEach-Object { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) } } }
        'noip'    { if ([string]::IsNullOrWhiteSpace($DdnsUser)) { $DdnsUser = Read-Host 'No-IP username' }; if ([string]::IsNullOrWhiteSpace($DdnsPassword)) { $DdnsPassword = Read-Host 'No-IP password' -AsSecureString | ForEach-Object { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) } } }
        'custom'  { Write-Warn 'Custom provider: edit data\config\ddns.config.json afterwards (template key "customUrl").' }
      }
      $cfgPath = Set-DdnsConfig -Root $Root -Provider $DdnsProvider -Hostname $DdnsHostname -Token $DdnsToken -User $DdnsUser -Password $DdnsPassword
      Write-Ok ('DDNS config written: ' + $cfgPath)
      Register-DdnsTask -Root $Root
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'deploy\windows\NIR-DDNS.ps1') | Out-Null
      Write-Ok 'DDNS updater installed (runs every 5 minutes at startup)'
      if ($DdnsHostname) { $dnsRecord = $DdnsHostname }
    }
  }

  # ---- 4. Reverse proxy + HTTPS (Caddy) ---------------------------------------
  $caddyInstalled = $false
  if ($chosen -in @('public-ipv4', 'ipv6') -and -not $SkipCaddy) {
    Write-Step 'Installing reverse proxy (Caddy) with automatic HTTPS (Let''s Encrypt)'
    $caddyExe = Get-CaddyExe -Root $Root
    $email = 'admin@' + ($Domain -replace '^[^.]+\.', '')
    $caddyfile = Write-Caddyfile -Root $Root -Domain $Domain -AppPort $AppPort -Email $email
    Register-CaddyTask -Root $Root -CaddyExe $caddyExe -Caddyfile $caddyfile

    $ruleName = 'NIR HTTPS Proxy (TCP 443)'
    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Any -ErrorAction SilentlyContinue | Out-Null

    Stop-ScheduledTask -TaskName 'NIR Caddy Proxy' -ErrorAction SilentlyContinue
    Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName 'NIR Caddy Proxy'
    Start-Sleep -Seconds 3
    $caddyInstalled = $true
    Write-Ok 'Caddy proxy installed and started (HTTPS on 443 -> NIR on 3000)'

    # ---- Router port-forwarding ------------------------------------------------
    if ($chosen -eq 'public-ipv4') {
      Write-Step 'Configuring router port-forwarding (external 443 -> this PC 443)'
      if ($upnp.Available) {
        $map = Invoke-NirUpnp -AddExternalPort 443 -AddInternalPort 443 -Description 'NIR HTTPS'
        if ($map.Mapped) { Write-Ok 'Router port 443 mapped automatically via UPnP' }
        else { Write-Warn ('Automatic UPnP mapping failed (' + $map.Error + '). Forward external TCP 443 -> this PC:443 manually in the router.') }
      } else {
        Write-Warn 'Router does not expose UPnP. Forward external TCP 443 -> this PC:443 in the router manually.'
      }
      Write-Warn 'Do NOT change or remove the existing camera rules (external 80 -> 192.168.0.100, external 81 -> 192.168.0.200).'
    }
  }

  # ---- 5. Result --------------------------------------------------------------
  Write-Host ''
  Write-Host '==============================' -ForegroundColor Green
  Write-Host ' NIR INTERNET SETUP SUMMARY' -ForegroundColor Green
  Write-Host '==============================' -ForegroundColor Green

  switch ($chosen) {
    'public-ipv4' {
      Write-Host ('Strategy      : Public IPv4 + DDNS + Caddy HTTPS')
      Write-Host ('DNS to create : A  ' + $Domain + '  ->  ' + $dnsRecord)
    }
    'ipv6' {
      Write-Host ('Strategy      : Public IPv6 + Caddy HTTPS')
      Write-Host ('DNS to create : AAAA  ' + $Domain + '  ->  ' + $dnsRecord)
      Write-Host 'Note          : ensure the ISP allows inbound IPv6 on 443.'
    }
    default {
      Write-Host ('Strategy      : NONE (no usable public IPv4/IPv6 detected)')
      Write-Host 'This connection appears to be behind CGNAT with no public IPv6.'
      Write-Host 'Zero-cost public HTTPS with a custom domain is not possible without'
      Write-Host 'either a public IP or a relay. Practical options (pick one):'
      Write-Host '  1) Ask the ISP for a public/static IPv4 (often a small monthly fee).'
      Write-Host '  2) Use an IPv6-capable ISP/plan and re-run with -Strategy ipv6.'
      Write-Host '  3) Use a zero-cost public relay where viewers need no client, then'
      Write-Host '     point app.artadan.ir at it via CNAME (see docs/Internet-Access.md).'
      Write-Host 'LAN access and all factory operations keep working meanwhile.'
    }
  }

  if ($caddyInstalled) {
    Write-Host ''
    Write-Host ('Verify HTTPS locally : https://127.0.0.1 (cert issued after DNS resolves)')
    Write-Host ('Verify from Internet : run NIR-HEALTH.ps1 on any external network')
  }
  Write-Host ''
}
catch {
  Write-Err ('Internet setup failed: ' + $_.Exception.Message)
  throw
}
finally {
  try { Stop-Transcript | Out-Null } catch { }
}
exit 0
