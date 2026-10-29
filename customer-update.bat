@echo off
setlocal
title ArianaAPI - Customer Update

:: ═══ چک کردن دسترسی Administrator ═══
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================================
    echo [ERROR] Please Run this file as ADMINISTRATOR!
    echo ========================================================
    pause
    exit /b 1
)

echo ========================================
echo * ArianaAPI - Customer Update Script  *
echo ========================================
echo.

if not exist "C:\Update\ArianaAPI.Web.dll" (
    echo [ERROR] Folder C:\Update not found or is empty!
    pause
    exit /b 1
)

:: ═══ [1/5] Stop services & Kill processes ═══
echo [1/5] Stopping services and processes...
C:\ArianaAPI\nssm.exe stop ArianaTunnel 2>nul
C:\ArianaAPI\nssm.exe stop ArianaAPI 2>nul

:: ⭐ این دو خط اضافه شد تا فایل‌های قفل شده آزاد شوند
taskkill /F /IM ArianaAPI.Web.exe 2>nul
taskkill /F /IM dotnet.exe 2>nul
timeout /t 5 /nobreak >nul

:: ═══ [2/5] Backup ═══
echo [2/5] Backing up current version...
set BK=C:\ArianaAPI-Backup\%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%
mkdir "%BK%" 2>nul
robocopy C:\ArianaAPI "%BK%" /E /NFL /NDL /NJH /NJS /XF *.log >nul
echo      Backup saved at: %BK%

:: ═══ [3/5] Copy new files ═══
echo [3/5] Copying new files...
robocopy C:\Update C:\ArianaAPI /E /NFL /NDL /NJH /NJS ^
    /XF appsettings.Production.json appsettings.json appsettings.Development.json ariana.lic *.lic nssm.exe deploy.bat customer-update.bat ^
    /XD logs .ssh Temp >nul

if not exist "C:\ArianaAPI\ArianaAPI.Web.dll" (
    echo [ERROR] Copy failed! ArianaAPI.Web.dll is missing in C:\ArianaAPI
    pause
    exit /b 1
)
echo      *** Copy Success

:: ═══ [4/5] Clean up ═══
echo [4/5] Cleaning up...
rmdir /s /q C:\Update 2>nul

:: ═══ [5/5] Start services ═══
echo [5/5] Starting services...
C:\ArianaAPI\nssm.exe start ArianaAPI
timeout /t 3 /nobreak >nul
C:\ArianaAPI\nssm.exe start ArianaTunnel
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo * Update Complete!                   *
echo * URL: https://ariana.iewco.ir        *
echo ========================================
C:\ArianaAPI\nssm.exe status ArianaAPI
C:\ArianaAPI\nssm.exe status ArianaTunnel
pause