import type { TrackPoint } from '../db/track-points';
import { haversineMetres } from './haversine';

const ACCURACY_THRESHOLD_METRES = 50;
const TELEPORT_DISTANCE_METRES = 300;
const TELEPORT_TIME_SECONDS = 10;

/**
 * Filters a raw list of track points to remove:
 * - Points with accuracy worse than the threshold
 * - Exact duplicate timestamps
 * - Teleportation outliers (>300 m jump in <10 s)
 *
 * Returns the ids of points that pass all checks (i.e. are "clean").
 */
export function filterCleanPointIds(points: TrackPoint[]): string[] {
  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const cleanIds: string[] = [];
  let prev: TrackPoint | null = null;
  const seenTimestamps = new Set<number>();

  for (const pt of sorted) {
    if (pt.accuracyMetres > ACCURACY_THRESHOLD_METRES) continue;
    if (seenTimestamps.has(pt.timestamp)) continue;

    if (prev !== null) {
      const distM = haversineMetres(
        prev.latitude,
        prev.longitude,
        pt.latitude,
        pt.longitude,
      );
      const dtSec = (pt.timestamp - prev.timestamp) / 1000;
      if (distM > TELEPORT_DISTANCE_METRES && dtSec < TELEPORT_TIME_SECONDS) {
        continue;
      }
    }

    seenTimestamps.add(pt.timestamp);
    cleanIds.push(pt.id);
    prev = pt;
  }

  return cleanIds;
}
