@echo off
chcp 65001 >nul 2>&1
title JD Scraper v2.3

cd /d "%~dp0"

echo.
echo ===============================================================
echo.
echo              JD Scraper v2.3
echo.
echo ===============================================================
echo.

REM Check Node.js
if exist "%~dp0node\node.exe" (
    set NODE_EXE=%~dp0node\node.exe
    goto check_chrome
)

node --version >nul 2>&1
if %errorlevel% equ 0 (
    set NODE_EXE=node
    goto check_chrome
)

echo [ERROR] Node.js not found!
pause
exit /b 1

:check_chrome
echo [OK] Node.js ready

where chrome >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%~dp0chrome\chrome.exe" (
        echo [INFO] Local Chrome found
    )
)

:menu
cls
echo.
echo ===============================================================
echo.
echo              JD Scraper v2.3
echo.
echo ===============================================================
echo.
echo   1. Start scraping
echo   2. Change save path
echo   3. Exit
echo.

set /p choice="Select (1-3): "

if "%choice%"=="" set choice=1

if "%choice%"=="1" goto scrape
if "%choice%"=="2" goto change_path
if "%choice%"=="3" goto end

echo [ERROR] Invalid choice
timeout /t 2 >nul
goto menu

:scrape
cls
echo.
echo Starting scraper...
echo.
%NODE_EXE% src\scraper.js
echo.
echo Done!
pause
goto menu

:change_path
cls
echo.
echo ===============================================================
echo                   Change Save Path
echo ===============================================================
echo.
echo Current:
type src\config.json
echo.
set /p newpath="New path (empty=default): "

if "%newpath%"=="" (
    echo {"outputPath": ""} > src\config.json
    echo Path reset
) else (
    echo {"outputPath": "%newpath%"} > src\config.json
    echo Path updated: %newpath%
)
echo.
pause
goto menu

:end
cls
echo.
echo Goodbye!
echo.
timeout /t 1 >nul
exit /b 0
