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
echo [+] NIR stopped.
endlocal
