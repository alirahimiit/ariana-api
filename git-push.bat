@echo off
chcp 65001 >nul
title Git Auto Push
color 0B

echo ═══════════════════════════════════════
echo   Git Auto Commit + Push
echo ═══════════════════════════════════════
echo.

REM ═══ چک کن توی پوشه گیت هستیم ═══
if not exist ".git" (
    echo [ERROR] This folder is not a Git repository!
    echo Please run this script from the project root.
    echo.
    pause
    exit /b 1
)

REM ═══ نمایش وضعیت فعلی ═══
echo [1/5] Current status:
git status --short
echo.

REM ═══ چک کن چیزی برای کامیت هست (شامل untracked) ═══
set HAS_CHANGES=
for /f %%i in ('git status --porcelain') do set HAS_CHANGES=1

if not defined HAS_CHANGES (
    echo [INFO] No changes to commit.
    echo.

    REM چک کن چیزی برای پوش هست
    git status -sb | findstr /C:"ahead" >nul
    if %errorlevel% == 0 (
        echo [INFO] Local commits need to be pushed.
        echo.
        goto :push_only
    ) else (
        echo [INFO] Everything is up to date.
        echo.
        pause
        exit /b 0
    )
)

REM ═══ گرفتن پیام کامیت ═══
echo [2/5] Enter commit message:
echo.
set /p COMMIT_MSG="> "

if "%COMMIT_MSG%"=="" (
    echo.
    echo [WARN] Empty message. Using default...
    set COMMIT_MSG=Update: %date% %time%
)

echo.

REM ═══ Add all changes ═══
echo [3/5] Staging all changes...
git add -A
if %errorlevel% neq 0 (
    echo [ERROR] Failed to stage changes.
    pause
    exit /b 1
)

REM ═══ Commit ═══
echo.
echo [4/5] Committing...
git commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
    echo [ERROR] Commit failed.
    pause
    exit /b 1
)

:push_only
echo.
echo [5/5] Pushing to remote...
git push
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed!
    echo Check your internet connection or remote access.
    echo.
    pause
    exit /b 1
)

echo.
echo ═══════════════════════════════════════
echo   Success! Changes pushed to remote.
echo ═══════════════════════════════════════
echo.
git log -1 --oneline
echo.
pause