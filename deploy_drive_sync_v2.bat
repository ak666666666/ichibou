@echo off
chcp 65001 > nul

echo ===========================================
echo Ichibou Drive Sync Deploy v2
echo ===========================================
echo.

REM Set working directory directly
cd /d "C:\クロードコード\_deploy_temp\ichibou"
if errorlevel 1 (
    echo ERROR: Cannot cd to deploy directory
    pause
    exit /b 1
)
echo Current: %CD%
echo.

REM Remove git lock if exists
if exist ".git\index.lock" (
    echo [PRE] Removing stale git lock...
    del /F /Q ".git\index.lock"
)

echo [1/4] Copy source files
copy /Y "C:\クロードコード\一望\index.html.html" "index.html"
if errorlevel 1 (
    echo ERROR: index.html copy failed
    pause
    exit /b 1
)
copy /Y "C:\クロードコード\一望\drive-sync.js" "drive-sync.js"
if errorlevel 1 (
    echo ERROR: drive-sync.js copy failed
    pause
    exit /b 1
)
echo OK
echo.

echo [2/4] Git add
git add index.html drive-sync.js
if errorlevel 1 (
    echo ERROR: git add failed
    pause
    exit /b 1
)
echo OK
echo.

echo [3/4] Git commit
git commit -m "Add Drive auto-backup module"
if errorlevel 1 (
    echo NOTE: git commit returned non-zero (maybe nothing to commit, OK)
)
echo.

echo [4/4] Git push
git push origin main
if errorlevel 1 (
    echo ERROR: git push failed - try running manually
    pause
    exit /b 1
)

echo.
echo ===========================================
echo DEPLOY COMPLETE
echo ===========================================
echo.
echo Wait 1-2 minutes, then open:
echo https://ak666666666.github.io/ichibou/
echo.
echo Hard reload with Ctrl+Shift+R for cache clear.
echo Look for "Drive backup OFF" indicator top-right.
echo.
pause
