@echo off
setlocal
cd /d "%~dp0"
title SOPHENIC Design V8
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALLER-SOPHENIC-AUTO.ps1"
endlocal
