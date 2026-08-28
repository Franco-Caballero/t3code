@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Update-T3CodeScroll.ps1"
if errorlevel 1 (
  echo.
  echo Update stopped safely. Read the message above or ask Codex for help.
  pause
  exit /b 1
)
echo.
echo Update complete.
pause
