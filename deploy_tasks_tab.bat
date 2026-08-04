@echo off
chcp 65001 > nul
REM ============================================================
REM タスクタブ追加 デプロイヘルパー(2026-06-07 / Cowork 自律進行)
REM 動作: ローカル一望の index.html.html / public/tasks.json を
REM       _deploy_temp/ichibou/ にコピー → git add/commit/push
REM ============================================================
cd /d "C:\クロードコード\_deploy_temp\ichibou"

echo === [1/5] ソースの最新版をコピー ===
copy /Y "C:\クロードコード\一望\index.html.html" "index.html" > nul
if errorlevel 1 ( echo [ERR] index.html.html → index.html コピー失敗 & pause & exit /b 1 )

if not exist "public" mkdir "public"
copy /Y "C:\クロードコード\一望\public\tasks.json" "public\tasks.json" > nul
if errorlevel 1 ( echo [ERR] public\tasks.json コピー失敗 & pause & exit /b 1 )

echo === [2/5] git status ===
git status > deploy_tasks_result.txt 2>&1
type deploy_tasks_result.txt

echo === [3/5] git add ===
git add index.html public/tasks.json >> deploy_tasks_result.txt 2>&1

echo === [4/5] git commit ===
git -c user.email=akira.kanda7620@gmail.com -c user.name=ak666666666 commit -m "feat(tasks): Phase D-4 ② タスクタブ追加(Drive _次やること.md 同期・案B JSON中継)" >> deploy_tasks_result.txt 2>&1

echo === [5/5] git push ===
git push origin main >> deploy_tasks_result.txt 2>&1

echo. >> deploy_tasks_result.txt
echo === exit code: %ERRORLEVEL% === >> deploy_tasks_result.txt

echo.
echo === 完了 ===
echo 結果は deploy_tasks_result.txt を確認。
echo GitHub Pages 反映 URL: https://ak666666666.github.io/ichibou/
echo 1〜2分後に Galaxy で PWA を再起動。
pause
