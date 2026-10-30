@echo off
title Simulador USAR Rover SAR RESCUE - HOTAS & VR Wi-Fi (Grupo 4 UAI)
cd /d "%~dp0"

echo ====================================================================
echo  SIMULADOR 3D USAR ROVER "SAR RESCUE" • LOGITECH 3D PRO & VR WI-FI
echo ====================================================================

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Iniciando servidor local Wi-Fi para Casco VR en puerto 8090...
    start "Servidor VR Wi-Fi USAR Rover" /min python "%~dp0wifi_vr_server.py"
    timeout /t 1 /nobreak >nul
    start "" "http://localhost:8090"
) else (
    echo [INFO] Abriendo simulador en modo directo...
    start "" "%~dp0index.html"
)
