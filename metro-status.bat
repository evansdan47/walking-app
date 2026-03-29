@echo off
echo ============================================================
echo  Metro / Node Process Status
echo ============================================================
echo.
echo --- Port 8081 ---
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; Write-Host ('  PID: ' + $_.OwningProcess + '  Name: ' + $p.Name + '  State: ' + $_.State) }"
echo.
echo --- All Node / Java processes ---
powershell -NoProfile -Command "Get-Process node,java -ErrorAction SilentlyContinue | Format-Table Id,Name,CPU,StartTime -AutoSize"
echo.
pause
