@echo off
title NAMO IMS Global Internet Tunnel
echo ==================================================
echo   NAMO IMS — Global Public Internet Access
echo ==================================================
echo Starting local servers and generating HTTPS Global URL...
echo Works on 4G/5G Mobile Data and any Wi-Fi anywhere in the world!
echo.
cd /d "%~dp0backend"
start "NAMO IMS Server" /min node server.js
cd /d "%~dp0frontend"
start "NAMO IMS Web" /min npm run dev
timeout /t 3 >nul
echo.
echo Launching Public Internet Tunnel...
npx -y localtunnel --port 5173
pause
