@echo off
echo Starting LuxeCart...
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js not found. Install from https://nodejs.org then run this again.
  pause
  exit /b 1
)
node server.js
pause
