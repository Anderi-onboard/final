@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run start.bat once first, it installs what this needs.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" cli.py %*
