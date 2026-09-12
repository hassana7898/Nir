# =============================================================================
# NIR server supervisor - keeps the production server running.
# Started at boot by the "NIR Factory Server" scheduled task (SYSTEM).
# =============================================================================
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_nir-common.ps1')

$Root = Resolve-NirRoot -Start $PSScriptRoot
Set-Location $Root
$envMap = Import-NirEnv -Root $Root
$env:NIR_DIST_PATH = Join-Path $Root 'dist'
$env:NODE_ENV = 'production'
if (-not $env:PORT) { $env:PORT = '3000' }

$logDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'nir-server.log'
$nodeExe = Join-Path $Root 'runtime\node.exe'
$serverJs = Join-Path $Root 'server.cjs'

while ($true) {
  try {
    Add-Content -Path $logFile -Value ((Get-Date).ToString('s') + '  starting NIR server') -Encoding UTF8
    & $nodeExe $serverJs *>> $logFile
    $code = $LASTEXITCODE
    Add-Content -Path $logFile -Value ((Get-Date).ToString('s') + '  NIR server exited with code ' + $code) -Encoding UTF8
  } catch {
    Add-Content -Path $logFile -Value ((Get-Date).ToString('s') + '  supervisor error: ' + $_.Exception.Message) -Encoding UTF8
  }
  Start-Sleep -Seconds 5
}
