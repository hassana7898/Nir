# =============================================================================
# NIR Factory - shared PowerShell helpers (Windows PowerShell 5.1 compatible)
# Sourced by all NIR deployment scripts. Location independent.
# =============================================================================

Set-StrictMode -Version Latest

function Resolve-NirRoot {
  [CmdletBinding()]
  param([string]$Start)
  $dir = $Start
  if ([string]::IsNullOrWhiteSpace($dir)) { $dir = $PSScriptRoot }
  if ([string]::IsNullOrWhiteSpace($dir)) { $dir = (Get-Location).Path }
  while ($dir) {
    if (Test-Path (Join-Path $dir 'server.cjs')) { return $dir }
    $parent = Split-Path -Parent $dir
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  throw 'NIR root not found (server.cjs was not located). Run this script from inside the extracted NIR package.'
}

function Write-Step { param([string]$Message) Write-Host ("[*] " + $Message) -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host ("[+] " + $Message) -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host ("[!] " + $Message) -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host ("[x] " + $Message) -ForegroundColor Red }

function New-NirSecret {
  param([int]$Bytes = 48)
  $buf = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($buf)
  return [Convert]::ToBase64String($buf)
}

function Read-DotEnv {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path -LiteralPath $Path)) { return $map }
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $k = $matches[1]
      $v = $matches[2].Trim()
      if ($v.Length -ge 2 -and $v.StartsWith('"') -and $v.EndsWith('"')) { $v = $v.Substring(1, $v.Length - 2) }
      $map[$k] = $v
    }
  }
  return $map
}

function Set-EnvFromFile {
  param([string]$Path)
  $map = Read-DotEnv -Path $Path
  foreach ($k in $map.Keys) { [Environment]::SetEnvironmentVariable($k, $map[$k], 'Process') }
  return $map
}

function Get-LocalIPv4 {
  try {
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
    if ($route) {
      $ip = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1
      if ($ip) { return $ip.IPAddress }
    }
    $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1
    if ($fallback) { return $fallback.IPAddress }
  } catch { }
  return $null
}

function Get-LocalIPv6Global {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv6 -ErrorAction SilentlyContinue | Where-Object {
      $_.IPAddress -notlike 'fe80*' -and $_.IPAddress -notlike '::1' -and $_.AddressState -eq 'Preferred' -and ($_.PrefixOrigin -eq 'RouterAdvertisement' -or $_.PrefixOrigin -eq 'Manual' -or $_.PrefixOrigin -eq 'Dhcp')
    } | Select-Object -First 1
    if ($ip) { return $ip.IPAddress }
  } catch { }
  return $null
}

function Get-DefaultGateway {
  try {
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
    if ($route) { return $route.NextHop }
  } catch { }
  return $null
}

function Get-PublicIPv4 {
  $urls = @('https://api.ipify.org', 'https://ipv4.icanhazip.com', 'https://ifconfig.me/ip', 'https://checkip.amazonaws.com')
  foreach ($u in $urls) {
    try {
      $r = Invoke-WebRequest -Uri $u -TimeoutSec 8 -UseBasicParsing
      $s = ($r.Content | Out-String).Trim()
      if ($s -match '^\d{1,3}(\.\d{1,3}){3}$') { return $s }
    } catch { }
  }
  return $null
}

function Get-PublicIPv6 {
  $urls = @('https://api64.ipify.org', 'https://ipv6.icanhazip.com')
  foreach ($u in $urls) {
    try {
      $r = Invoke-WebRequest -Uri $u -TimeoutSec 8 -UseBasicParsing
      $s = ($r.Content | Out-String).Trim()
      if ($s -match '^[0-9a-fA-F:]{6,}$' -and $s -match ':') { return $s }
    } catch { }
  }
  return $null
}

function Test-CgnatRange {
  param([string]$PublicIp)
  if ([string]::IsNullOrWhiteSpace($PublicIp)) { return $null }
  $p = $PublicIp.Split('.')
  if ($p.Count -ne 4) { return $null }
  $a = [int]$p[0]; $b = [int]$p[1]
  if ($a -eq 100 -and $b -ge 64 -and $b -le 127) { return $true }   # 100.64.0.0/10
  if ($a -eq 10) { return $true }
  if ($a -eq 172 -and $b -ge 16 -and $b -le 31) { return $true }
  if ($a -eq 192 -and $b -eq 168) { return $true }
  return $false
}

function Get-PostgresBin {
  $candidates = @()
  # NIR portable PostgreSQL (pgsql\bin next to the package root)
  $dir = $PSScriptRoot
  while ($dir) {
    $portable = Join-Path $dir 'pgsql\bin'
    if (Test-Path (Join-Path $portable 'psql.exe')) { $candidates += $portable; break }
    $parent = Split-Path -Parent $dir
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
    $dir = $parent
  }
  try {
    $svc = Get-Service | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
    if ($svc) {
      $candidates += (Get-CimInstance Win32_Service -Filter ("Name='" + $svc.Name + "'") -ErrorAction SilentlyContinue).PathName
    }
  } catch { }
  foreach ($base in @('C:\Program Files\PostgreSQL', 'C:\Program Files (x86)\PostgreSQL')) {
    if (Test-Path $base) {
      Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object { $candidates += (Join-Path $_.FullName 'bin') }
    }
  }
  foreach ($c in $candidates) {
    if ([string]::IsNullOrWhiteSpace($c)) { continue }
    if (Test-Path $c -PathType Container) {
      if (Test-Path (Join-Path $c 'psql.exe')) { return $c }
    } elseif (Test-Path $c -PathType Leaf) {
      $d = Split-Path -Parent ($c.Trim('"'))
      if (Test-Path (Join-Path $d 'psql.exe')) { return $d }
    }
  }
  $onPath = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($onPath) { return (Split-Path -Parent $onPath.Source) }
  return $null
}

function Get-PostgresService {
  $svc = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
  return $svc
}

function Test-PortListening {
  param([int]$Port, [string]$Address = '127.0.0.1')
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect($Address, $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(1500)
    if ($ok) { $c.EndConnect($iar) }
    $c.Close()
    return $ok
  } catch { return $false }
}

function Import-NirEnv {
  param([string]$Root)
  $envPath = Join-Path $Root '.env'
  if (-not (Test-Path -LiteralPath $envPath)) { throw ("Missing .env in " + $Root + ". Run INSTALL-NIR.ps1 first.") }
  return (Set-EnvFromFile -Path $envPath)
}

# --- Minimal UPnP IGD client (best effort; safe to fail) -----------------------
function Invoke-NirUpnp {
  [CmdletBinding()]
  param([int]$AddExternalPort = 0, [int]$AddInternalPort = 0, [string]$Description = 'NIR Remote Access')
  $result = [ordered]@{ Available = $false; ExternalIP = $null; Mapped = $false; Error = $null }
  try {
    $msearch = "M-SEARCH * HTTP/1.1`r`nHOST: 239.255.255.250:1900`r`nMAN: `"ssdp:discover`"`r`nMX: 2`r`nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1`r`n`r`n"
    $udp = New-Object System.Net.Sockets.UdpClient
    $udp.Client.ReceiveTimeout = 2500
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($msearch)
    [void]$udp.Send($bytes, $bytes.Length, '239.255.255.250', 1900)
    $ep = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
    $location = $null
    for ($i = 0; $i -lt 4; $i++) {
      try {
        $data = $udp.Receive([ref]$ep)
        $text = [System.Text.Encoding]::ASCII.GetString($data)
        if ($text -match '(?im)^LOCATION:\s*(\S+)\s*$') { $location = $matches[1].Trim(); break }
      } catch { break }
    }
    $udp.Close()
    if (-not $location) { $result.Error = 'No UPnP gateway responded'; return $result }

    $desc = (Invoke-WebRequest -Uri $location -TimeoutSec 6 -UseBasicParsing).Content
    $baseUri = [System.Uri]$location
    $controlPath = $null
    if ($desc -match '(?is)<serviceType>urn:schemas-upnp-org:service:WANIPConnection:\d+</serviceType>.*?<controlURL>(.*?)</controlURL>') {
      $controlPath = $matches[1].Trim()
    } elseif ($desc -match '(?is)<serviceType>urn:schemas-upnp-org:service:WANPPPConnection:\d+</serviceType>.*?<controlURL>(.*?)</controlURL>') {
      $controlPath = $matches[1].Trim()
    }
    $serviceType = if ($desc -match 'WANIPConnection') { 'urn:schemas-upnp-org:service:WANIPConnection:1' } else { 'urn:schemas-upnp-org:service:WANPPPConnection:1' }
    if (-not $controlPath) { $result.Error = 'No WAN connection service exposed'; return $result }
    $controlUrl = (New-Object System.Uri($baseUri, $controlPath)).AbsoluteUri

    $soapIp = @"
<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
<s:Body><u:GetExternalIPAddress xmlns:u="$serviceType"/></s:Body></s:Envelope>
"@
    $hdr = @{ 'SOAPAction' = '"' + $serviceType + '#GetExternalIPAddress"'; 'Content-Type' = 'text/xml; charset="utf-8"' }
    $resp = Invoke-WebRequest -Uri $controlUrl -Method Post -Headers $hdr -Body $soapIp -TimeoutSec 6 -UseBasicParsing
    if ($resp.Content -match '<NewExternalIPAddress>([^<]*)</NewExternalIPAddress>') { $result.ExternalIP = $matches[1].Trim() }
    $result.Available = $true

    if ($AddExternalPort -gt 0 -and $AddInternalPort -gt 0) {
      $local = Get-LocalIPv4
      if ($local) {
        $soapAdd = @"
<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
<s:Body><u:AddPortMapping xmlns:u="$serviceType">
<NewRemoteHost></NewRemoteHost><NewExternalPort>$AddExternalPort</NewExternalPort><NewProtocol>TCP</NewProtocol>
<NewInternalPort>$AddInternalPort</NewInternalPort><NewInternalClient>$local</NewInternalClient>
<NewEnabled>1</NewEnabled><NewPortMappingDescription>$Description</NewPortMappingDescription><NewLeaseDuration>0</NewLeaseDuration>
</u:AddPortMapping></s:Body></s:Envelope>
"@
        $hdr2 = @{ 'SOAPAction' = '"' + $serviceType + '#AddPortMapping"'; 'Content-Type' = 'text/xml; charset="utf-8"' }
        $r2 = Invoke-WebRequest -Uri $controlUrl -Method Post -Headers $hdr2 -Body $soapAdd -TimeoutSec 8 -UseBasicParsing
        $result.Mapped = ($r2.StatusCode -eq 200)
      }
    }
  } catch {
    $result.Error = $_.Exception.Message
  }
  return $result
}
