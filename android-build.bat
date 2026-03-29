@echo off
echo ============================================================
echo  Full Android Native Build  (npx expo run:android)
echo ============================================================
echo  Use this when:
echo    - First time setup
echo    - Changed app.json / native permissions
echo    - Added a new native dependency
echo  For JS-only changes just use metro-start.bat instead.
echo ============================================================
echo.
cd /d "%~dp0.."

:: Free port 8081 if something is already holding it
powershell -NoProfile -Command ^
  "$conns = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue;" ^
  "if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique |" ^
  "ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue;" ^
  "Write-Host ('  Freed port 8081 (PID ' + $_ + ')') } }"

npx expo run:android
pause
