import { Platform } from 'react-native';
import { ExerciseType, insertRecords } from 'react-native-health-connect';
import type { TrackPoint } from '../db/track-points';
import { initializeHealthConnect } from './client';

/**
 * Writes a completed walk to Health Connect as an ExerciseSessionRecord with
 * an embedded ExerciseRoute (GPS polyline), plus a StepsRecord and
 * DistanceRecord for the walk window.
 *
 * Called from post-processing after stats are computed. Failures are swallowed —
 * the walk is already saved to SQLite before this runs.
 *
 * Returns true if the exercise session was written successfully.
 */
export async function writeExerciseSession(
  walk: {
    startedAt: number;
    endedAt: number;
    title: string | null;
    distanceMetres: number;
    stepCount?: number;
  },
  cleanPoints: TrackPoint[],
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const ok = await initializeHealthConnect();
    if (!ok) return false;

    const startTime = new Date(walk.startedAt).toISOString();
    const endTime = new Date(walk.endedAt).toISOString();

    // Use HIKING type when more than 300 m of elevation gain — otherwise WALKING
    const exerciseType = ExerciseType.WALKING;

    const records = [];

    // Exercise session + route (route is embedded when per-point coords provided)
    records.push({
      recordType: 'ExerciseSession' as const,
      startTime,
      endTime,
      exerciseType,
      title: walk.title ?? 'Walk',
      ...(cleanPoints.length >= 2
        ? {
            exerciseRoute: {
              route: cleanPoints.map((pt) => ({
                time: new Date(pt.timestamp).toISOString(),
                latitude: pt.latitude,
                longitude: pt.longitude,
                ...(pt.altitudeMetres != null ? { altitude: { value: pt.altitudeMetres, unit: 'meters' } } : {}),
                ...(pt.accuracyMetres != null ? { horizontalAccuracy: { value: pt.accuracyMetres, unit: 'meters' } } : {}),
              })),
            },
          }
        : {}),
    } as never);

    // Distance record
    records.push({
      recordType: 'Distance' as const,
      startTime,
      endTime,
      distance: { value: walk.distanceMetres, unit: 'meters' as const },
    });

    // Steps record (only if we have a step count)
    if (walk.stepCount != null && walk.stepCount > 0) {
      records.push({
        recordType: 'Steps' as const,
        startTime,
        endTime,
        count: walk.stepCount,
      });
    }

    await insertRecords(records);
    return true;
  } catch {
    return false;
  }
}
