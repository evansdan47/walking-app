@echo off
echo ============================================================
echo  Stopping Metro (killing port 8081)
echo ============================================================
echo.
powershell -NoProfile -Command ^
  "$conns = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue;" ^
  "if (-not $conns) { Write-Host '  Port 8081 is already free.' }" ^
  "else { $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique;" ^
  "foreach ($id in $pids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue;" ^
  "Stop-Process -Id $id -Force -ErrorAction SilentlyContinue;" ^
  "Write-Host ('  Killed PID ' + $id + ' (' + $p.Name + ')') } }"
echo.
echo Done.
pause
