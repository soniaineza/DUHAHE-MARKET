@echo off
cd /d %~dp0
npx expo start --port 8081 > "%USERPROFILE%\metro_duhahe.log" 2>&1
