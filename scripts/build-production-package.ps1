# =============================================================================
# Build the production package: NIR-Factory-Production-Windows.zip
# Local equivalent of the GitHub Actions packaging step.
# Requires: node + npm available, `npm run build` already run (dist/ present).
# =============================================================================
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Release = Join-Path $Root 'release'
$ZipPath = Join-Path $Root 'NIR-Factory-Production-Windows.zip'

function Step($m) { Write-Host ("[*] " + $m) -ForegroundColor Cyan }
function Ok($m) { Write-Host ("[+] " + $m) -ForegroundColor Green }

if (-not (Test-Path 'dist\index.html')) { throw 'dist\index.html missing. Run: npm run build' }
if (-not (Test-Path 'dist\server.cjs')) { throw 'dist\server.cjs missing. Run: npm run build' }
if (-not (Test-Path 'dist\db-migrate.cjs')) {
  Step 'Bundling database migration'
  npx esbuild server/db/migrate.ts --bundle --platform=node --format=cjs --packages=bundle --external:pg-native --outfile=dist/db-migrate.cjs
}

Step 'Cleaning previous output'
if (Test-Path $Release) { Remove-Item $Release -Recurse -Force }
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
foreach ($d in @('dist', 'deploy', 'data\uploads', 'data\backups', 'data\config', 'runtime')) { New-Item -ItemType Directory -Force -Path (Join-Path $Release $d) | Out-Null }

Step 'Copying application'
Copy-Item -Recurse -Force (Join-Path $Root 'dist\*') (Join-Path $Release 'dist')
Copy-Item -Force (Join-Path $Release 'dist\server.cjs') (Join-Path $Release 'server.cjs')
Copy-Item -Force (Join-Path $Release 'dist\db-migrate.cjs') (Join-Path $Release 'db-migrate.cjs')
Remove-Item -Force (Join-Path $Release 'dist\server.cjs'), (Join-Path $Release 'dist\server.cjs.map'), (Join-Path $Release 'dist\db-migrate.cjs') -ErrorAction SilentlyContinue
Copy-Item -Force (Join-Path $Root '.env.example') (Join-Path $Release '.env.example')
Copy-Item -Recurse -Force (Join-Path $Root 'deploy\*') (Join-Path $Release 'deploy')

Step 'Copying operator scripts to package root'
$rootScripts = @('INSTALL-NIR.ps1','INSTALL-INTERNET.ps1','BACKUP-NIR.ps1','RESTORE-NIR.ps1','UNINSTALL-NIR.ps1','NIR-HEALTH.ps1','START-NIR.bat','STOP-NIR.bat','RESTART-NIR.bat','README-FACTORY.txt')
foreach ($f in $rootScripts) { Copy-Item -Force (Join-Path $Root ("deploy\windows\" + $f)) (Join-Path $Release $f) }

Step 'Bundling Windows Node runtime'
$nodeVersion = (& node -p 'process.versions.node').Trim()
$nodeZip = Join-Path $env:TEMP ('node-v' + $nodeVersion + '-win-x64.zip')
if (-not (Test-Path $nodeZip)) {
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri ('https://nodejs.org/dist/v' + $nodeVersion + '/node-v' + $nodeVersion + '-win-x64.zip') -OutFile $nodeZip -TimeoutSec 600 -UseBasicParsing
}
$runtimeTemp = Join-Path $env:TEMP ('nir-runtime-' + [Guid]::NewGuid().ToString('N'))
Expand-Archive -LiteralPath $nodeZip -DestinationPath $runtimeTemp -Force
Copy-Item -Recurse -Force (Join-Path $runtimeTemp ('node-v' + $nodeVersion + '-win-x64\*')) (Join-Path $Release 'runtime')
Remove-Item $runtimeTemp -Recurse -Force -ErrorAction SilentlyContinue

Step 'Validating package'
foreach ($f in @('server.cjs','db-migrate.cjs','runtime\node.exe','dist\index.html','INSTALL-NIR.ps1','README-FACTORY.txt','deploy\windows\_nir-common.ps1')) {
  if (-not (Test-Path (Join-Path $Release $f))) { throw ('Package missing: ' + $f) }
}
if (Test-Path (Join-Path $Release 'dist\server.cjs')) { throw 'server.cjs must not remain in dist/.' }

Step 'Creating ZIP'
Compress-Archive -Path (Join-Path $Release '*') -DestinationPath $ZipPath -Force
Ok ('Package: ' + $ZipPath + '  (' + [Math]::Round((Get-Item $ZipPath).Length / 1MB, 1) + ' MB)')
