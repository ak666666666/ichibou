@echo off
chcp 65001 > nul
pushd "%~dp0"
echo ===============================================
echo Ichibou Deploy 2026-07-22 (v2 - lock-buster)
echo ===============================================
echo Working dir: %CD%
echo.

echo [1/6] Force-remove any stale git locks...
if exist ".git\index.lock" (
  del /f /q ".git\index.lock" 2>nul
  echo   deleted index.lock
)
if exist ".git\HEAD.lock" (
  del /f /q ".git\HEAD.lock" 2>nul
  echo   deleted HEAD.lock
)
if exist ".git\refs\heads\main.lock" (
  del /f /q ".git\refs\heads\main.lock" 2>nul
)
echo.

echo [2/6] Copy latest index.html from source...
copy /y "..\..\一望\index.html.html" "index.html" > nul
if errorlevel 1 (
  echo ERROR: copy failed
  pause
  exit /b 1
)
echo   OK
echo.

echo [3/6] git status (before)
git status --short
echo.

echo [4/6] git add
git add index.html
echo.

echo [5/6] git commit
git commit -m "feat(2026-07-18): extend wantAnswer to notes/moyas/tasks (Phase B UI extension)"
echo (commit code above - 0 = new commit, 1 = nothing to commit)
echo.

echo [6/6] git push origin main
git push origin main
echo.

echo ===============================================
echo DONE. Check messages above.
echo Wait 1-2 min then reload: https://ak666666666.github.io/ichibou/
echo ===============================================
popd
pause
