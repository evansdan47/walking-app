import { Platform } from 'react-native';
import { aggregateRecord } from 'react-native-health-connect';
import { initializeHealthConnect } from './client';

/**
 * Reads the total step count from Health Connect for the given time window.
 * Returns null if Health Connect is unavailable, the permission is not granted,
 * or no step data exists for the window.
 */
export async function readStepsBetween(
  startTimeMs: number,
  endTimeMs: number,
): Promise<number | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const ok = await initializeHealthConnect();
    if (!ok) return null;

    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(startTimeMs).toISOString(),
        endTime: new Date(endTimeMs).toISOString(),
      },
    });

    // COUNT_TOTAL is 0 when no data is present — treat 0 as null so callers
    // can distinguish "no data" from "zero steps recorded".
    const count = result.COUNT_TOTAL;
    if (__DEV__) {
      console.log('[steps] readStepsBetween result:', { COUNT_TOTAL: count, start: new Date(startTimeMs).toISOString(), end: new Date(endTimeMs).toISOString() });
    }
    return typeof count === 'number' && count > 0 ? count : null;
  } catch (e) {
    if (__DEV__) console.log('[steps] readStepsBetween error:', e);
    return null;
  }
}
