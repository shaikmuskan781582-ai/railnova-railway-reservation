@echo off
title RailNova Railway Reservation System

cd /d "%~dp0"

echo ========================================
echo   RailNova Railway Reservation System
echo ========================================
echo.

if not exist "server.exe" (
echo Building the C++ backend...
g++ -std=c++17 -pthread backend\main.cpp -o server.exe
if errorlevel 1 (
echo.
echo ERROR: Compilation failed.
echo Make sure your C++ compiler is installed.
pause
exit /b 1
)
)

echo Starting RailNova server...
start "RailNova Backend" cmd /k "cd /d "%~dp0" && server.exe 10000 frontend"

timeout /t 3 /nobreak >nul

start "" "http://localhost:10000"

echo.
echo RailNova is starting in your browser!
echo Keep the backend terminal open while using the website.
pause
