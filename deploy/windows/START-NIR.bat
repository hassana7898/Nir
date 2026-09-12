@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [!] Please run this file as Administrator.
  pause
  exit /b 1
)
schtasks /Run /TN "NIR Factory Server" >nul 2>&1
echo [+] NIR start requested. Opening local status...
timeout /t 3 >nul
start "" http://127.0.0.1:3000
endlocal
