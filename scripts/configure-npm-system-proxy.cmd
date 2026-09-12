@echo off
setlocal EnableExtensions

REM Detect the fixed WinINET system proxy configured in Windows Internet Options.
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; if($p.ProxyEnable -eq 1 -and $p.ProxyServer){$s=$p.ProxyServer; if($s -match '^https?://'){Write-Output $s} else {Write-Output ('http://' + $s)}}"`) do set "SYSTEM_PROXY=%%A"

if not defined SYSTEM_PROXY (
  echo No fixed Windows system proxy was detected.
  echo If your proxy app uses a PAC script, configure its local HTTP proxy endpoint manually.
  exit /b 1
)

echo Detected Windows proxy: %SYSTEM_PROXY%

REM Configure npm to use the Windows system proxy for both HTTP and HTTPS.
npm config set proxy "%SYSTEM_PROXY%"
npm config set https-proxy "%SYSTEM_PROXY%"
npm config set noproxy "localhost,127.0.0.1,::1,192.168.0.0/16"

REM Keep environment variables aligned for tools that read them instead of npm config.
setx HTTP_PROXY "%SYSTEM_PROXY%" >nul
setx HTTPS_PROXY "%SYSTEM_PROXY%" >nul
setx http_proxy "%SYSTEM_PROXY%" >nul
setx https_proxy "%SYSTEM_PROXY%" >nul
setx NO_PROXY "localhost,127.0.0.1,::1,192.168.0.0/16" >nul
setx no_proxy "localhost,127.0.0.1,::1,192.168.0.0/16" >nul

set "HTTP_PROXY=%SYSTEM_PROXY%"
set "HTTPS_PROXY=%SYSTEM_PROXY%"
set "http_proxy=%SYSTEM_PROXY%"
set "https_proxy=%SYSTEM_PROXY%"
set "NO_PROXY=localhost,127.0.0.1,::1,192.168.0.0/16"
set "no_proxy=%NO_PROXY%"

echo.
echo npm proxy configured.
echo HTTP proxy : %SYSTEM_PROXY%
echo HTTPS proxy: %SYSTEM_PROXY%
echo.
exit /b 0
