@echo off
echo ============================================================
echo  Launching Rambleio on connected Android emulator/device
echo ============================================================
echo.
echo Connected devices:
adb devices
echo.

:: Try emulator-5554 first, fall back to whatever is attached
set DEVICE=
for /f "skip=1 tokens=1" %%D in ('adb devices') do (
  if not defined DEVICE set DEVICE=%%D
)

if not defined DEVICE (
  echo ERROR: No device found. Start an emulator first.
  pause
  exit /b 1
)

echo Launching on: %DEVICE%
adb -s %DEVICE% shell am start -n com.rambleio.app/.MainActivity
echo.
echo App launched. Metro must already be running (run metro-start.bat if not).
pause
