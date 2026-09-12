$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path '.\.env')) { throw 'C:\NIR\.env is missing. Run INSTALL-ONLINE.ps1 first.' }
$envFile = Get-Content '.\.env' | Where-Object { $_ -match '^\s*([^#][^=]*)=(.*)$' }
foreach ($line in $envFile) {
  if ($line -match '^\s*([^#][^=]*)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2], 'Process') }
}
$env:NIR_DIST_PATH = Join-Path $Root 'dist'
$env:NODE_ENV = 'production'
$env:PORT = if ($env:PORT) { $env:PORT } else { '3000' }

while ($true) {
  & '.\runtime\node.exe' '.\server.cjs'
  $exit = $LASTEXITCODE
  Start-Sleep -Seconds 5
}
