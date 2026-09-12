@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [!] Please run this file as Administrator.
  pause
  exit /b 1
)
schtasks /End /TN "NIR Factory Server" >nul 2>&1
timeout /t 2 >nul
schtasks /Run /TN "NIR Factory Server" >nul 2>&1
timeout /t 3 >nul
echo [+] NIR restarted. Opening local status...
start "" http://127.0.0.1:3000
endlocal
