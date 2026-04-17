import { PermissionsAndroid, Platform } from 'react-native';
import { getGrantedPermissions, openHealthConnectDataManagement, openHealthConnectSettings, requestPermission } from 'react-native-health-connect';
import { initializeHealthConnect } from './client';

export interface GrantedPermissions {
  readSteps: boolean;
  readDistance: boolean;
  readCalories: boolean;
  readHeartRate: boolean;
  writeExercise: boolean;
  writeExerciseRoute: boolean;
}

const PERMISSIONS_TO_REQUEST = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'Distance' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'write', recordType: 'ExerciseSession' },
] as const;

function parseGranted(granted: Awaited<ReturnType<typeof getGrantedPermissions>>): GrantedPermissions {
  // Log the raw result in development so we can diagnose unexpected shapes.
  if (__DEV__) {
    console.log('[HC] getGrantedPermissions raw:', JSON.stringify(granted));
  }

  const set = new Set(
    granted.map((p) => {
      if ('recordType' in p) return `${p.accessType}:${p.recordType}`;
      if ('recordType' in (p as Record<string, unknown>)) return `write:ExerciseRoute`;
      return '';
    }),
  );

  // Also check for the special WriteExerciseRoute permission object shape
  const hasExerciseRoute = granted.some(
    (p) => 'exerciseRouteAccessType' in p || JSON.stringify(p).includes('ExerciseRoute'),
  );

  return {
    readSteps: set.has('read:Steps'),
    readDistance: set.has('read:Distance'),
    readCalories: set.has('read:ActiveCaloriesBurned'),
    readHeartRate: set.has('read:HeartRate'),
    writeExercise: set.has('write:ExerciseSession'),
    writeExerciseRoute: set.has('write:ExerciseRoute') || hasExerciseRoute,
  };
}

// HC's getGrantedPermissions() silently drops write:ExerciseSession in some Android/HC
// versions even when the user has granted it via the HC settings screen. We cross-check
// write permissions via PermissionsAndroid.check() which reads the actual runtime grant
// and is the authoritative source of truth on Android 14+.
//
// Two permission strings exist for exercise session write:
//   WRITE_EXERCISE_SESSION — used by HC SDK 1.1.0-alpha09+
//   WRITE_EXERCISE         — legacy name used by older HC provider APKs on device
// Both are declared in AndroidManifest.xml; we accept either as granted.
const HC_PERM_WRITE_EXERCISE_SESSION = 'android.permission.health.WRITE_EXERCISE_SESSION';
const HC_PERM_WRITE_EXERCISE_LEGACY  = 'android.permission.health.WRITE_EXERCISE';
const HC_PERM_WRITE_EXERCISE_ROUTE   = 'android.permission.health.WRITE_EXERCISE_ROUTE';

async function mergeWritePermissionsCheck(base: GrantedPermissions): Promise<GrantedPermissions> {
  try {
    const [writeExerciseNew, writeExerciseLegacy, writeExerciseRoute] = await Promise.all([
      PermissionsAndroid.check(HC_PERM_WRITE_EXERCISE_SESSION as never),
      PermissionsAndroid.check(HC_PERM_WRITE_EXERCISE_LEGACY as never),
      PermissionsAndroid.check(HC_PERM_WRITE_EXERCISE_ROUTE as never),
    ]);
    const writeExercise = writeExerciseNew || writeExerciseLegacy;
    if (__DEV__) {
      console.log('[HC] PermissionsAndroid write check —',
        'WRITE_EXERCISE_SESSION:', writeExerciseNew,
        'WRITE_EXERCISE (legacy):', writeExerciseLegacy,
        'WRITE_EXERCISE_ROUTE:', writeExerciseRoute,
      );
    }
    return {
      ...base,
      writeExercise: base.writeExercise || writeExercise,
      writeExerciseRoute: base.writeExerciseRoute || writeExerciseRoute,
    };
  } catch {
    // PermissionsAndroid.check may throw on older Android versions that don't
    // treat HC permissions as runtime permissions — fall back to HC API result.
    return base;
  }
}

/**
 * Checks which Health Connect permissions have already been granted without
 * showing any system dialog.
 */
export async function checkHealthConnectPermissions(): Promise<GrantedPermissions | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const ok = await initializeHealthConnect();
    if (!ok) return null;
    const granted = await getGrantedPermissions();
    const base = parseGranted(granted);
    return mergeWritePermissionsCheck(base);
  } catch {
    return null;
  }
}

/**
 * Requests all Health Connect permissions needed by this app.
 * Shows the Android Health Connect system permission sheet.
 * Returns null if HC is unavailable.
 *
 * Note: requestPermission()'s return value is not reliable across all HC
 * versions — it may only reflect permissions acted on in that specific dialog
 * rather than the full set. We therefore call getGrantedPermissions() after
 * the dialog returns to get the definitive current state.
 */
export async function requestHealthConnectPermissions(): Promise<GrantedPermissions | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const ok = await initializeHealthConnect();
    if (!ok) return null;
    await requestPermission([
      ...PERMISSIONS_TO_REQUEST,
      { accessType: 'write', recordType: 'ExerciseRoute' } as never,
    ]);
    // Re-query the actual granted set rather than trusting the request result.
    const currentlyGranted = await getGrantedPermissions();
    const base = parseGranted(currentlyGranted);
    return mergeWritePermissionsCheck(base);
  } catch {
    return null;
  }
}

/**
 * Opens the Health Connect app directly to this app's permissions management
 * screen. Use this instead of re-calling requestPermission() when permissions
 * have already been granted — re-calling requestPermission() is unreliable on
 * subsequent attempts.
 *
 * The AppState 'active' listener in the calling component will re-check
 * granted permissions automatically when the user returns from HC.
 */
export function openHealthConnectAppSettings(): void {
  if (Platform.OS !== 'android') return;
  openHealthConnectDataManagement('com.rambleio.app');
}

/**
 * Opens the Health Connect main settings screen.
 * From there the user can navigate to "App permissions" → find this app →
 * toggle individual read/write permissions (including write:ExerciseSession).
 *
 * Use this instead of requestPermission() when permissions have already been
 * presented once — requestPermission() won't re-surface already-presented
 * permissions on subsequent calls.
 */
export function openHealthConnectMainSettings(): void {
  if (Platform.OS !== 'android') return;
  openHealthConnectSettings();
}
