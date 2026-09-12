# =============================================================================
# NIR DDNS updater - keeps the dynamic DNS record pointed at this factory PC.
# Reads data\config\ddns.config.json. Safe to run repeatedly (scheduled task).
# Providers: duckdns, dynu, noip, custom.
# =============================================================================

[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

function Write-DdnsLog {
  param([string]$Root, [string]$Message)
  $logDir = Join-Path $Root 'logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $line = (Get-Date).ToString('s') + '  ' + $Message
  Add-Content -Path (Join-Path $logDir 'ddns.log') -Value $line -Encoding UTF8
}

try {
  $Root = Resolve-NirRoot -Start $PSScriptRoot
  $cfgPath = Join-Path $Root 'data\config\ddns.config.json'
  if (-not (Test-Path -LiteralPath $cfgPath)) { Write-DdnsLog -Root $Root 'No DDNS config found; nothing to do.'; exit 0 }

  $cfg = Get-Content -LiteralPath $cfgPath -Raw | ConvertFrom-Json
  $provider = [string]$cfg.provider
  if ([string]::IsNullOrWhiteSpace($provider)) { Write-DdnsLog -Root $Root 'DDNS provider not set.'; exit 0 }

  # Choose the address family based on the hostname / provider intent.
  $ip = Get-PublicIPv4
  if ($provider -match 'ipv6' -or ([string]$cfg.hostname) -match '\.ipv6\.') { $ip = Get-PublicIPv6 }
  if ([string]::IsNullOrWhiteSpace($ip)) { Write-DdnsLog -Root $Root 'Could not determine public IP.'; exit 1 }

  $hostname = [string]$cfg.hostname
  $response = ''
  $auth = $null

  switch ($provider.ToLower()) {
    'duckdns' {
      $sub = $hostname -replace '\.duckdns\.org$', ''
      $url = 'https://www.duckdns.org/update?domains=' + [System.Uri]::EscapeDataString($sub) + '&token=' + [System.Uri]::EscapeDataString([string]$cfg.token) + '&ip=' + $ip
      $response = (Invoke-WebRequest -Uri $url -TimeoutSec 20 -UseBasicParsing).Content
    }
    'dynu' {
      $pair = [string]$cfg.username + ':' + [string]$cfg.password
      $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
      $url = 'https://api.dynu.com/nic/update?hostname=' + [System.Uri]::EscapeDataString($hostname) + '&myip=' + $ip
      $response = (Invoke-WebRequest -Uri $url -Headers @{ Authorization = $auth } -TimeoutSec 20 -UseBasicParsing).Content
    }
    'noip' {
      $pair = [string]$cfg.username + ':' + [string]$cfg.password
      $auth = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
      $url = 'https://dynupdate.no-ip.com/nic/update?hostname=' + [System.Uri]::EscapeDataString($hostname) + '&myip=' + $ip
      $response = (Invoke-WebRequest -Uri $url -Headers @{ Authorization = $auth; 'User-Agent' = 'NIR-DDNS/1.0' } -TimeoutSec 20 -UseBasicParsing).Content
    }
    'custom' {
      $template = [string]$cfg.customUrl
      if ([string]::IsNullOrWhiteSpace($template)) { throw 'customUrl is empty in ddns.config.json' }
      $url = $template.Replace('{ip}', $ip).Replace('{host}', $hostname)
      $headers = @{}
      if (-not [string]::IsNullOrWhiteSpace([string]$cfg.username)) {
        $pair = [string]$cfg.username + ':' + [string]$cfg.password
        $headers['Authorization'] = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
      }
      $response = (Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 20 -UseBasicParsing).Content
    }
    default { Write-DdnsLog -Root $Root ('Unknown DDNS provider: ' + $provider); exit 1 }
  }

  $text = ([string]$response).Trim()
  if ($text -match 'good|nochg|200|OK' -or $text -match '"status"\s*:\s*"?(good|success)') {
    Write-DdnsLog -Root $Root ('OK ' + $provider + ' ' + $hostname + ' -> ' + $ip + ' (' + $text + ')')
  } else {
    Write-DdnsLog -Root $Root ('WARN ' + $provider + ' ' + $hostname + ' -> ' + $ip + ' response: ' + $text)
  }
  exit 0
}
catch {
  try { $r = Resolve-NirRoot -Start $PSScriptRoot; Write-DdnsLog -Root $r ('ERROR ' + $_.Exception.Message) } catch { }
  exit 1
}
