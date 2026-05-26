@echo off
echo Starting LuxeCart...
set "PATH=%PATH%;C:\Program Files\nodejs"
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo Node.js not found. Restart PC after install, or install from https://nodejs.org
  pause
  exit /b 1
)
echo Open http://localhost:3000 in your browser
node server.js
pause
