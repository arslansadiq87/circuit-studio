@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Circuit Studio 3D...
echo Keep this window open while using the app. Press Ctrl+C to stop the server.
start "Circuit Studio 3D" http://localhost:5173
call npm run dev -- --open http://localhost:5173
endlocal
