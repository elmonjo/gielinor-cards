@echo off
setlocal

cd /d "%~dp0"
title Gielinor Cards - One Click Test

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo First run detected. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency install failed.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting Gielinor Cards...
start "" "http://127.0.0.1:5173"
call npm run dev -- --host 127.0.0.1 --port 5173

endlocal
