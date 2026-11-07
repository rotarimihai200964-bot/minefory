@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS version from https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS and make sure it is added to PATH.
  pause
  exit /b 1
)

java -version
if errorlevel 1 (
  echo Java is required. Install Java 21 from https://adoptium.net/temurin/releases/?version=21
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  if errorlevel 1 (
    echo Could not create .env from .env.example.
    pause
    exit /b 1
  )
  echo Created .env from .env.example. Keep this file private.
)

if not exist "node_modules" (
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

start "Minefory API" /D "%~dp0" cmd /k "npm run api"
start "Minefory Panel" /D "%~dp0" cmd /k "npm run dev -- --host 127.0.0.1"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"
