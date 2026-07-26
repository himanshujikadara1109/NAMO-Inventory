@echo off
title NAMO IMS Launcher
echo Starting NAMO IMS Backend & Frontend...
cd /d "%~dp0backend"
start "NAMO IMS Server" /min node server.js
cd /d "%~dp0frontend"
start "NAMO IMS Web" /min npm run dev
timeout /t 3 >nul
start msedge --app=http://localhost:5173 --name="NAMO IMS" || start chrome --app=http://localhost:5173
exit
