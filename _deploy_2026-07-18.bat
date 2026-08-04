@echo off
chcp 65001 > nul
pushd "%~dp0"
echo ===== Ichibou Deploy 2026-07-18 =====
echo Working dir: %CD%
echo.

echo [1/5] Removing stale git locks (if any)...
powershell -NoProfile -Command "Remove-Item -LiteralPath '.git\index.lock' -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath '.git\HEAD.lock' -Force -ErrorAction SilentlyContinue; Write-Host 'OK'"
echo.

echo [2/5] Copy latest index.html from source...
powershell -NoProfile -Command "Copy-Item -LiteralPath '..\..\一望\index.html.html' -Destination 'index.html' -Force; Write-Host 'OK'"
echo.

echo [3/5] git add index.html
git add index.html
echo.

echo [4/5] git commit
git commit -m "feat(2026-07-18): extend wantAnswer to notes/moyas/tasks (Phase B UI extension)"
echo.

echo [5/5] git push origin main
git push origin main
echo.

echo ===== DONE =====
echo Wait 1-2 minutes then reload: https://ak666666666.github.io/ichibou/
echo.
popd
pause
