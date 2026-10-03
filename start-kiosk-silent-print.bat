@echo off
title Generic e-LGU Kiosk Runner (Silent Thermal Print)
echo ============================================================
echo   STARTING E-LGU KIOSK WITH SILENT PRINTING
echo ============================================================
echo.

pushd "%~dp0"
for /f "delims=" %%i in ('node -p "require('./src/lgu.config.json').identity.kioskUrl" 2^>nul') do set "KIOSK_URL=%%i"
if not defined KIOSK_URL (
    echo Unable to read identity.kioskUrl from src\lgu.config.json. Ensure Node.js is installed.
    popd
    exit /b 1
)
echo(%KIOSK_URL%|findstr /b "{{" >nul
if not errorlevel 1 (
    echo Configure identity.kioskUrl in src\lgu.config.json before starting the kiosk.
    popd
    exit /b 1
)
popd

:: Set a dedicated temp profile directory so Chrome ignores your currently open windows
set KIOSK_DATA_DIR=%LOCALAPPDATA%\LguKioskBrowserSession

if not exist "%KIOSK_DATA_DIR%" mkdir "%KIOSK_DATA_DIR%"

:: 1. Check Google Chrome
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo Launching Google Chrome in isolated Kiosk mode...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%KIOSK_DATA_DIR%" --kiosk-printing --app=%KIOSK_URL%
    exit /b
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo Launching Google Chrome in isolated Kiosk mode...
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --user-data-dir="%KIOSK_DATA_DIR%" --kiosk-printing --app=%KIOSK_URL%
    exit /b
)

:: 2. Check Microsoft Edge
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo Launching Microsoft Edge in isolated Kiosk mode...
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%KIOSK_DATA_DIR%" --kiosk-printing --app=%KIOSK_URL%
    exit /b
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    echo Launching Microsoft Edge in isolated Kiosk mode...
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%KIOSK_DATA_DIR%" --kiosk-printing --app=%KIOSK_URL%
    exit /b
)

echo No compatible Chromium browser found!
pause
