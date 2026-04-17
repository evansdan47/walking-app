import { Platform } from 'react-native';
import { aggregateRecord } from 'react-native-health-connect';
import { initializeHealthConnect } from './client';

export interface HeartRateSummary {
  avgBpm: number;
  maxBpm: number;
}

/**
 * Reads heart rate aggregate data from Health Connect for the given walk window.
 * Only returns data when a connected wearable or companion app has written heart
 * rate records during this time — our app never produces heart rate itself.
 *
 * Returns null if HC is unavailable, permission not granted, or no data exists.
 */
export async function readHeartRateForWalk(
  startTimeMs: number,
  endTimeMs: number,
): Promise<HeartRateSummary | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const ok = await initializeHealthConnect();
    if (!ok) return null;

    const result = await aggregateRecord({
      recordType: 'HeartRate',
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(startTimeMs).toISOString(),
        endTime: new Date(endTimeMs).toISOString(),
      },
    });

    const avg = result.BPM_AVG;
    const max = result.BPM_MAX;

    if (typeof avg !== 'number' || typeof max !== 'number' || avg <= 0) return null;

    return { avgBpm: Math.round(avg), maxBpm: Math.round(max) };
  } catch {
    return null;
  }
}
