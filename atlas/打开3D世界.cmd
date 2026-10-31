@echo off
cd /d "%~dp0"
python server.py --open --view world3d
if errorlevel 1 pause
