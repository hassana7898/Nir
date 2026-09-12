$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host 'NIR Local Build - Windows' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed or is not in PATH.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd is not installed or is not in PATH.' }

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:NODE_ENV = 'production'
$env:VITE_API_BASE_URL = ''
$env:npm_config_audit = 'false'
$env:npm_config_fund = 'false'
$env:npm_config_fetch_retries = '1'
$env:npm_config_fetch_timeout = '15000'
$env:npm_config_fetch_retry_mintimeout = '1000'
$env:npm_config_fetch_retry_maxtimeout = '3000'

Write-Host 'Checking local dependency tree...' -ForegroundColor Yellow
$required = @('vite','react','react-dom','react-router-dom','express','esbuild','typescript')
$missing = @()
foreach ($pkg in $required) {
  if (-not (Test-Path (Join-Path 'node_modules' $pkg))) { $missing += $pkg }
}

if ($missing.Count -gt 0) {
  Write-Host ('Missing core packages: ' + ($missing -join ', ')) -ForegroundColor Yellow
  Write-Host 'Rebuilding node_modules using the reachable npm mirror...' -ForegroundColor Yellow

  if (Test-Path 'node_modules') { Remove-Item 'node_modules' -Recurse -Force }

  npm.cmd config set registry https://registry.npmmirror.com/ | Out-Null
  npm.cmd cache verify | Out-Null

  Write-Host 'Installing dependencies with a hard timeout...' -ForegroundColor Yellow
  $npm = (Get-Command npm.cmd).Source
  $npmArgs = @('install','--no-audit','--no-fund','--prefer-online','--fetch-retries=1','--fetch-timeout=15000')
  $process = Start-Process -FilePath $npm -ArgumentList $npmArgs -WorkingDirectory $root -PassThru -Wait
  if ($process.ExitCode -ne 0) {
    throw "npm install failed with exit code $($process.ExitCode). Build stopped."
  }
} else {
  Write-Host 'Core dependency tree is present; skipping npm reinstall.' -ForegroundColor Green
}

if (Test-Path '.env') {
  $envPath = (Resolve-Path '.env').Path
  $raw = Get-Content -Raw $envPath
  $clean = [regex]::Replace($raw, '(?m)^\s*NODE_ENV\s*=.*\r?\n?', '')
  if ($clean -ne $raw) {
    Set-Content -Path $envPath -Value $clean -NoNewline
    Write-Host 'Removed NODE_ENV from .env (Vite controls production mode).' -ForegroundColor DarkYellow
  }
}

Write-Host 'Cleaning generated build output...' -ForegroundColor Yellow
if (Test-Path 'dist') { Remove-Item 'dist' -Recurse -Force }

Write-Host 'Building web and standalone server...' -ForegroundColor Yellow
$build = Start-Process -FilePath $npm -ArgumentList @('run','build') -WorkingDirectory $root -PassThru -Wait
if ($build.ExitCode -ne 0) { throw "NIR build failed with exit code $($build.ExitCode)." }

if (-not (Test-Path 'dist/index.html')) { throw 'Build completed without dist/index.html.' }
if (-not (Test-Path 'dist/server.cjs')) { throw 'Build completed without dist/server.cjs.' }

Write-Host ''
Write-Host 'BUILD SUCCESSFUL' -ForegroundColor Green
Write-Host 'Start with: npm.cmd start' -ForegroundColor Green
