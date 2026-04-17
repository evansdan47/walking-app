import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { getKv } from '../db/client';
import { insertPoint } from '../db/track-points';
import { getActiveWalkId } from '../db/walks';
import { haversineMetres } from './haversine';

export const BACKGROUND_LOCATION_TASK = 'WALK_LOCATION_TASK';

const ACCURACY_THRESHOLD_METRES = 50;

// Module-level last-recorded position — persists across task invocations
// within the same process lifetime (i.e. while the app or background service
// is running). Cleared to null when a new walk starts by resetting on walkId change.
let lastRecordedWalkId: string | null = null;
let lastRecordedLat: number | null = null;
let lastRecordedLon: number | null = null;

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error('[BackgroundTask] error:', error.message);
      return;
    }

    const walkId = getActiveWalkId();
    if (!walkId) return;

    // Reset last-point tracking when a new walk begins.
    if (walkId !== lastRecordedWalkId) {
      lastRecordedWalkId = walkId;
      lastRecordedLat = null;
      lastRecordedLon = null;
    }

    // Read the multiplier from SQLite (written by useFeatureFlags). Falls back to 1.0.
    const multiplierRaw = getKv('gps_accuracy_multiplier');
    const multiplier = multiplierRaw !== null ? parseFloat(multiplierRaw) : 1.0;

    const locations = data?.locations ?? [];
    for (const loc of locations) {
      const accuracy = loc.coords.accuracy ?? 0;

      // Hard cutoff: ignore readings with known-bad accuracy.
      if (loc.coords.accuracy !== null && accuracy > ACCURACY_THRESHOLD_METRES) continue;

      // Distance filter: only record if we've moved at least accuracy × multiplier metres.
      if (lastRecordedLat !== null && lastRecordedLon !== null) {
        const distMoved = haversineMetres(
          lastRecordedLat, lastRecordedLon,
          loc.coords.latitude, loc.coords.longitude,
        );
        if (distMoved < accuracy * multiplier) continue;
      }

      lastRecordedLat = loc.coords.latitude;
      lastRecordedLon = loc.coords.longitude;

      insertPoint({
        id: randomUUID(),
        walkId,
        timestamp: loc.timestamp,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitudeMetres: loc.coords.altitude ?? null,
        speedMps: loc.coords.speed ?? null,
        accuracyMetres: accuracy,
      });
    }
  },
);
