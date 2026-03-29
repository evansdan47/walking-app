import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { insertPoint } from '../db/track-points';
import { getActiveWalkId } from '../db/walks';

export const BACKGROUND_LOCATION_TASK = 'WALK_LOCATION_TASK';

const ACCURACY_THRESHOLD_METRES = 150;

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error('[BackgroundTask] error:', error.message);
      return;
    }

    const walkId = getActiveWalkId();
    if (!walkId) return;

    const locations = data?.locations ?? [];
    for (const loc of locations) {
      // Only reject points with known-bad accuracy (null = unknown, accept it).
      const accuracy = loc.coords.accuracy;
      if (accuracy !== null && accuracy > ACCURACY_THRESHOLD_METRES) continue;

      insertPoint({
        id: randomUUID(),
        walkId,
        timestamp: loc.timestamp,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitudeMetres: loc.coords.altitude ?? null,
        speedMps: loc.coords.speed ?? null,
        accuracyMetres: accuracy ?? 0,
      });
    }
  },
);
