@echo off
title PharmaShield AI Platform Launcher
echo ============================================================
echo   STARTING ALL PHARMASHIELD AI PLATFORM SERVICES
echo ============================================================

echo [1/5] Starting Hardhat Ethereum Ledger on port 8545...
start "PharmaShield - Blockchain Ledger (Port 8545)" powershell -NoExit -Command "cd 'pharmashield-blockchain'; npx hardhat node"

timeout /t 4 /nobreak >nul

echo [2/5] Starting Local OCR & Damage Service on port 5001...
start "PharmaShield - OCR & Damage Service (Port 5001)" powershell -NoExit -Command "cd 'ocr-damage\server'; node src/server.js"

timeout /t 2 /nobreak >nul

echo [3/5] Starting Flask REST Backend API on port 5000...
start "PharmaShield - Flask Backend API (Port 5000)" powershell -NoExit -Command "python backend/app.py"

timeout /t 3 /nobreak >nul

echo [4/5] Starting Authority Portal Frontend on port 5173...
start "PharmaShield - Authority Portal (Port 5173)" powershell -NoExit -Command "cd 'authority-portal'; npm run dev"

echo [5/5] Starting Transport App Frontend on port 5174...
start "PharmaShield - Transport & Supply App (Port 5174)" powershell -NoExit -Command "cd 'transport-app'; npm run dev"

echo ============================================================
echo All 5 services launched in dedicated terminal windows!
echo - Hardhat Blockchain: http://127.0.0.1:8545
echo - OCR / Damage:       http://127.0.0.1:5001
echo - Flask Backend:      http://127.0.0.1:5000
echo - Authority Portal:   http://localhost:5173
echo - Transport App:       http://localhost:5174
echo ============================================================
pause

