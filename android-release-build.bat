@echo off
setlocal

echo ============================================================
echo  Android Release Build  (AAB for Play Store)
echo ============================================================
echo.

set ROOT=%~dp0

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
