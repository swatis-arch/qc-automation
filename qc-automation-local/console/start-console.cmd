@echo off
rem Starts the QC Console and its ngrok tunnel in two minimised windows.
rem Double-click it, or run it at Windows login (see README "QC Console").
cd /d "%~dp0.."
start "QC Console" /min cmd /k "node console\server.js"
start "QC Console tunnel" /min cmd /k "ngrok http 4000 --url https://trial-bungee-baked.ngrok-free.dev"
