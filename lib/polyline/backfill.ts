import { getCleanPointsForWalk } from '../db/track-points';
import { listWalksNeedingDisplayPolyline, updateWalkDisplayPolyline } from '../db/walks';
import { rdpSimplify, type LatLng } from './rdp';

/**
 * Increment this constant when the decimation algorithm or tolerance changes.
 * Any walk with `display_polyline_version < CURRENT_DISPLAY_VERSION` will be
 * reprocessed on the next app resume.
 */
export const CURRENT_DISPLAY_VERSION = 1;

/** Tolerance in degrees — ≈ 5 m at the equator. */
const RDP_EPSILON = 0.00005;

let running = false;

/**
 * Background pass: compute and store a decimated display polyline for every
 * completed walk that hasn't been processed at the current version yet.
 *
 * The job is idempotent and safe to call concurrently — a `running` guard
 * drops duplicate invocations. Processing yields to the event loop between
 * walks so it never blocks the UI thread.
 */
export async function runDisplayPolylineBackfill(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const walkIds = listWalksNeedingDisplayPolyline(CURRENT_DISPLAY_VERSION);

    for (const walkId of walkIds) {
      const points = getCleanPointsForWalk(walkId);

      let polylineJson: string;
      if (points.length === 0) {
        polylineJson = '[]';
      } else {
        const coords: LatLng[] = points.map((p) => [p.latitude, p.longitude]);
        const decimated = rdpSimplify(coords, RDP_EPSILON);
        polylineJson = JSON.stringify(decimated);
      }

      updateWalkDisplayPolyline(walkId, polylineJson, CURRENT_DISPLAY_VERSION);

      // Yield between walks to stay non-blocking.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    running = false;
  }
}
