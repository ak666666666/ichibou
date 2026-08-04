@echo off
chcp 65001 > nul
cd /d "C:\クロードコード\_deploy_temp\ichibou"
echo === git status === > push_result.txt
git status >> push_result.txt 2>&1
echo. >> push_result.txt
echo === git log -3 === >> push_result.txt
git log --oneline -3 >> push_result.txt 2>&1
echo. >> push_result.txt
echo === git push origin main === >> push_result.txt
git push origin main >> push_result.txt 2>&1
echo. >> push_result.txt
echo === exit code: %ERRORLEVEL% === >> push_result.txt
echo Done. Result in push_result.txt
timeout /t 3 > nul
