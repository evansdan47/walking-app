@echo off
setlocal

echo ============================================================
echo  Android Release Build  (AAB for Play Store)
echo ============================================================
echo.

set ROOT=%~dp0
set PROPS=%ROOT%android\gradle.properties

:: ── 0. Auto-increment version ───────────────────────────────
for /f "tokens=2 delims==" %%a in ('findstr /i "^VERSION_CODE=" "%PROPS%"') do set OLD_CODE=%%a
set /a NEW_CODE=%OLD_CODE%+1
powershell -NoProfile -Command "(Get-Content '%PROPS%') -replace '^VERSION_CODE=%OLD_CODE%$', 'VERSION_CODE=%NEW_CODE%' | Set-Content '%PROPS%'"

for /f "tokens=2 delims==" %%a in ('findstr /i "^VERSION_NAME=" "%PROPS%"') do set OLD_NAME=%%a
for /f "tokens=1,2,3 delims=." %%a in ("%OLD_NAME%") do (
    set MAJOR=%%a
    set MINOR=%%b
    set /a PATCH=%%c+1
)
set NEW_NAME=%MAJOR%.%MINOR%.%PATCH%
powershell -NoProfile -Command "(Get-Content '%PROPS%') -replace '^VERSION_NAME=%OLD_NAME%$', 'VERSION_NAME=%NEW_NAME%' | Set-Content '%PROPS%'"

echo Version: %OLD_NAME% ^> %NEW_NAME%  ^(build %OLD_CODE% ^> %NEW_CODE%^)
echo.

:: ── 1. Check keystore.properties exists ─────────────────────
if not exist "%ROOT%android\app\keystore.properties" (
  echo ERROR: android\app\keystore.properties not found.
  echo.
  echo Copy android\app\keystore.properties.template, fill in your
  echo keystore details, and save it as keystore.properties.
  echo.
  pause
  exit /b 1
)

:: ── 2. Sync native config (fast no-op if nothing changed) ────
echo [1/3] Syncing native config with expo prebuild...
call npx expo prebuild --no-install --platform android
if errorlevel 1 (
  echo ERROR: expo prebuild failed.
  pause
  exit /b 1
)
echo.

:: ── 3. Bundle the release AAB via Gradle ─────────────────────
echo [2/3] Building release AAB (this takes ~10 minutes)...
cd /d "%ROOT%android"
call .\gradlew bundleRelease --stacktrace
if errorlevel 1 (
  echo ERROR: Gradle build failed. Check output above.
  cd /d "%ROOT%"
  pause
  exit /b 1
)
cd /d "%ROOT%"
echo.

:: ── 4. Report output location ────────────────────────────────
echo [3/3] Done!
echo.
echo  Output AAB:
echo    android\app\build\outputs\bundle\release\app-release.aab
echo.
echo  Upload this file to the Google Play Console under
echo  Release ^> Production ^> Create new release.
echo ============================================================
echo.

:: Open the output folder in Explorer
explorer "%ROOT%android\app\build\outputs\bundle\release\"

pause
