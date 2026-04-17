@echo off
cd /d "%~dp0"

set LOGFILE=%~dp0logs\auto_run_%date:~0,4%%date:~5,2%%date:~8,2%.log

echo ============================== >> "%LOGFILE%"
echo START: %date% %time% >> "%LOGFILE%"
echo ============================== >> "%LOGFILE%"

"C:\Users\andyr\AppData\Roaming\npm\claude.cmd" ^
  --print "/run" ^
  --dangerously-skip-permissions ^
  >> "%LOGFILE%" 2>&1

echo EXIT: %ERRORLEVEL% >> "%LOGFILE%"
echo END: %date% %time% >> "%LOGFILE%"
