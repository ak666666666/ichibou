@echo off
chcp 65001 > nul

echo ===========================================
echo Ichibou Fix Deploy 2026-07-02
echo  - Drive reauth: tap-only (no auto popup)
echo  - Auto resync on return (multi-device)
echo  - Wipe guard (empty-overwrite protection)
echo  - Include public/tasks.json (fix 404)
echo ===========================================
echo.

cd /d "C:\クロードコード\_deploy_temp\ichibou"
if errorlevel 1 (
    echo ERROR: Cannot cd to deploy directory
    pause
    exit /b 1
)
echo Current: %CD%
echo.

if exist ".git\index.lock" (
    echo [PRE] Removing stale git lock...
    del /F /Q ".git\index.lock"
)

echo [1/5] Copy index.html
copy /Y "C:\クロードコード\一望\index.html.html" "index.html"
if errorlevel 1 (
    echo ERROR: index.html copy failed
    pause
    exit /b 1
)

echo [2/5] Copy drive-sync.js
copy /Y "C:\クロードコード\一望\drive-sync.js" "drive-sync.js"
if errorlevel 1 (
    echo ERROR: drive-sync.js copy failed
    pause
    exit /b 1
)

echo [3/5] Copy public\tasks.json
if not exist "public" mkdir "public"
copy /Y "C:\クロードコード\一望\public\tasks.json" "public\tasks.json"
if errorlevel 1 (
    echo ERROR: tasks.json copy failed
    pause
    exit /b 1
)
echo OK
echo.

echo [4/5] Git add + commit
git add index.html drive-sync.js public/tasks.json
if errorlevel 1 (
    echo ERROR: git add failed
    pause
    exit /b 1
)
git commit -m "fix: tap-only Drive reauth (no auto popup) + auto resync on return + wipe guard + include tasks.json"
if errorlevel 1 (
    echo NOTE: git commit returned non-zero (maybe nothing to commit)
)
echo.

echo [5/5] Git push
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
echo Wait 1-2 minutes, then:
echo   1. Open https://ak666666666.github.io/ichibou/
echo      (PC: Ctrl+Shift+R for hard reload)
echo   2. Galaxy: close and restart the Ichibou PWA
echo   3. Badge should show "Drive saibunin (tap)" style
echo      -> tap once, popup opens ONCE, then green
echo   4. Tasks tab: 404 error should be gone
echo.
pause
