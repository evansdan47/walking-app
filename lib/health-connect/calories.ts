import { Platform } from 'react-native';
import { aggregateRecord } from 'react-native-health-connect';
import { initializeHealthConnect } from './client';

/**
 * Reads active calories burned from Health Connect for the given walk window.
 * Only returns data when a wearable or companion app has already written calorie
 * records (Path A — read only). No calorie estimation is performed.
 *
 * Returns null if HC is unavailable, permission not granted, or no data exists.
 */
export async function readCaloriesForWalk(
  startTimeMs: number,
  endTimeMs: number,
): Promise<number | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const ok = await initializeHealthConnect();
    if (!ok) return null;

    const result = await aggregateRecord({
      recordType: 'ActiveCaloriesBurned',
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(startTimeMs).toISOString(),
        endTime: new Date(endTimeMs).toISOString(),
      },
    });

    const energy = result.ACTIVE_CALORIES_TOTAL;
    if (!energy) return null;

    // Convert to kcal — HC returns energy in kilocalories as inKilocalories
    const kcal = energy.inKilocalories;
    return typeof kcal === 'number' && kcal > 0 ? Math.round(kcal) : null;
  } catch {
    return null;
  }
}
