@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Read the WinINET (Windows Internet Options) proxy configuration and
REM convert it to normal HTTP/HTTPS proxy environment variables.
for /f "tokens=1,* delims==" %%A in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; if($p.ProxyEnable -ne 1){Write-Output 'STATE=OFF'; exit}; if($p.ProxyServer){ $raw=[string]$p.ProxyServer; $http=$null; $https=$null; if($raw -match '(^|;)http=([^;]+)'){ $http=$Matches[2] }; if($raw -match '(^|;)https=([^;]+)'){ $https=$Matches[2] }; if(-not $http -and -not $https -and $raw){ $http=$raw; $https=$raw }; if($http){Write-Output ('HTTP_PROXY=http://' + $http)}; if($https){Write-Output ('HTTPS_PROXY=http://' + $https)}; Write-Output 'STATE=ON'; exit}; if($p.AutoConfigURL){Write-Output ('STATE=PAC'); Write-Output ('PAC_URL=' + $p.AutoConfigURL); exit}; Write-Output 'STATE=OFF'"') do set "%%A=%%B"

if /I "%STATE%"=="OFF" (
  echo Windows system proxy is OFF.
  endlocal & exit /b 0
)

if /I "%STATE%"=="PAC" (
  echo Windows is using a PAC file:
  echo %PAC_URL%
  echo.
  echo A PAC URL cannot be used directly by npm/CMD.
  echo Set a fixed HTTP/HTTPS proxy in the proxy application.
  endlocal & exit /b 2
)

if not defined HTTP_PROXY (
  echo Could not determine the Windows HTTP proxy endpoint.
  endlocal & exit /b 3
)
if not defined HTTPS_PROXY set "HTTPS_PROXY=%HTTP_PROXY%"

set "http_proxy=%HTTP_PROXY%"
set "https_proxy=%HTTPS_PROXY%"
set "NO_PROXY=localhost,127.0.0.1,::1,192.168.0.0/16"
set "no_proxy=%NO_PROXY%"

REM Persist for newly opened CMD/PowerShell sessions.
setx HTTP_PROXY "%HTTP_PROXY%" >nul
setx HTTPS_PROXY "%HTTPS_PROXY%" >nul
setx http_proxy "%HTTP_PROXY%" >nul
setx https_proxy "%HTTPS_PROXY%" >nul
setx NO_PROXY "%NO_PROXY%" >nul
setx no_proxy "%NO_PROXY%" >nul

REM Configure npm to use the same proxy.
npm config set proxy "%HTTP_PROXY%" >nul 2>&1
npm config set https-proxy "%HTTPS_PROXY%" >nul 2>&1
npm config set noproxy "%NO_PROXY%" >nul 2>&1

echo.
echo Windows system proxy loaded.
echo HTTP_PROXY=%HTTP_PROXY%
echo HTTPS_PROXY=%HTTPS_PROXY%
echo.
echo npm proxy configuration updated.
echo This CMD window already has the proxy variables.
echo New CMD windows will inherit the saved values too.
endlocal & exit /b 0
