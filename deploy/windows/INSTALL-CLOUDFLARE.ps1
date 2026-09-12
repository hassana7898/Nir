# Configure the already-created Cloudflare Tunnel on the factory PC.
# The tunnel must have a Published Application route:
#   app.artadan.ir -> http://localhost:3000
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CloudflareDir = 'C:\Cloudflared\bin'
$Exe = Join-Path $CloudflareDir 'cloudflared.exe'

New-Item -ItemType Directory -Force -Path $CloudflareDir | Out-Null
if (-not (Test-Path $Exe)) {
  Write-Host 'Downloading cloudflared...' -ForegroundColor Cyan
  Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $Exe
}

& $Exe --version
Write-Host ''
Write-Host 'In Cloudflare Dashboard, create/select a Tunnel and publish:' -ForegroundColor Yellow
Write-Host '  Hostname: app.artadan.ir'
Write-Host '  Service:  http://localhost:3000'
Write-Host ''
$token = Read-Host 'Paste the Cloudflare Tunnel token'
if ([string]::IsNullOrWhiteSpace($token)) { throw 'Tunnel token is required.' }

# Remove an existing service only if it is present; do not touch other Cloudflare services.
& $Exe service uninstall 2>$null
& $Exe service install $token
if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Tunnel service installation failed.' }
Start-Service cloudflared -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Cloudflare Tunnel service installed and started.' -ForegroundColor Green
Write-Host 'Test: https://app.artadan.ir'
