@echo off
title Stop All PharmaShield Services
echo Stopping all PharmaShield background processes...
powershell -Command "Get-Process -Name node,python -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match 'PharmaShield' -or $_.CommandLine -match 'hardhat|backend|ocr-damage|vite' } | Stop-Process -Force -ErrorAction SilentlyContinue"
echo Done.
pause

