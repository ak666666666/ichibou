@echo off
chcp 65001 > nul
setlocal

echo ===========================================
echo 一望 Drive 同期機能 デプロイ
echo ===========================================
echo.

REM 作業ディレクトリ
set "DEPLOY_DIR=%~dp0"
set "SOURCE_DIR=%DEPLOY_DIR%..\..\一望"

echo [1/4] ソースファイル確認
if not exist "%SOURCE_DIR%\index.html.html" (
    echo ERROR: index.html.html が見つかりません
    pause
    exit /b 1
)
if not exist "%SOURCE_DIR%\drive-sync.js" (
    echo ERROR: drive-sync.js が見つかりません
    pause
    exit /b 1
)
echo OK

echo.
echo [2/4] ファイルコピー
copy /Y "%SOURCE_DIR%\index.html.html" "%DEPLOY_DIR%index.html" > nul
if errorlevel 1 (
    echo ERROR: index.html のコピーに失敗
    pause
    exit /b 1
)
copy /Y "%SOURCE_DIR%\drive-sync.js" "%DEPLOY_DIR%drive-sync.js" > nul
if errorlevel 1 (
    echo ERROR: drive-sync.js のコピーに失敗
    pause
    exit /b 1
)
echo OK

echo.
echo [3/4] Git コミット + push
cd /d "%DEPLOY_DIR%"
git add index.html drive-sync.js
git commit -m "Add Drive auto-backup module (Cowork autonomous)"
git push origin main
if errorlevel 1 (
    echo ERROR: git push 失敗。手動で push してください
    pause
    exit /b 1
)
echo OK

echo.
echo [4/4] 完了
echo.
echo === デプロイ完了 ===
echo.
echo 数分後に https://ak666666666.github.io/ichibou/ を開いて
echo 右上に「☁ Drive バックアップ OFF」が表示されればOK。
echo.
echo セットアップ手順:
echo C:\クロードコード\一望\_セットアップ_Driveバックアップ.md
echo.
pause
