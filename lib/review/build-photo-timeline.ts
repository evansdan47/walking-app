import type { WalkPhoto } from '@/lib/db/walk-photos';
import { haversineMetres } from '@/lib/location/haversine';
import type { RoutePoint } from '@/lib/review/build-route';

export interface PhotoTimelineEntry {
  photo: WalkPhoto;
  /** Cumulative distance from walk start to this photo's nearest route point, in metres. */
  distanceMetres: number;
  /** Elapsed time from walk start, formatted as HH:MM:SS. */
  formattedTime: string;
  /** Distance formatted as "X.X km" or "X.X mi". */
  formattedDistance: string;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function formatShortTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Builds a cumulative distance array from the route, indexed to route points.
 */
function buildCumulativeDistances(route: RoutePoint[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1]!;
    const curr = route[i]!;
    cum.push(cum[i - 1]! + haversineMetres(prev.latitude, prev.longitude, curr.latitude, curr.longitude));
  }
  return cum;
}

/**
 * Finds the index of the route point whose timestamp is nearest to the photo timestamp.
 * Uses linear scan — route arrays are at most a few thousand points.
 */
function nearestRouteIndex(routeTimestamps: number[], photoTimestamp: number): number {
  let best = 0;
  let bestDiff = Math.abs(routeTimestamps[0]! - photoTimestamp);
  for (let i = 1; i < routeTimestamps.length; i++) {
    const diff = Math.abs(routeTimestamps[i]! - photoTimestamp);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/**
 * Enriches a list of walk photos with cumulative-distance and elapsed-time metadata
 * derived from the walk route.
 *
 * @param photos      - Photos from getPhotosForWalk()
 * @param route       - Clean route points from buildRoute()
 * @param walkStartedAt - Walk start timestamp (ms)
 * @param unit        - Display unit for distance labels
 */
export function buildPhotoTimeline(
  photos: WalkPhoto[],
  route: RoutePoint[],
  walkStartedAt: number,
  unit: 'km' | 'mi' = 'km',
): PhotoTimelineEntry[] {
  const sorted = [...photos].sort((a, b) => a.timestamp - b.timestamp);

  // No route data — return photos with zero distances
  if (route.length === 0) {
    return sorted.map((photo) => {
      const elapsedSecs = Math.max(0, (photo.timestamp - walkStartedAt) / 1000);
      return {
        photo,
        distanceMetres: 0,
        formattedTime: formatShortTime(photo.timestamp),
        formattedDistance: unit === 'mi' ? '0.0 mi' : '0.0 km',
      };
    });
  }

  const cumulativeDistances = buildCumulativeDistances(route);
  const routeTimestamps = route.map((p) => p.timestamp);

  return sorted.map((photo) => {
    const idx = nearestRouteIndex(routeTimestamps, photo.timestamp);
    const distanceMetres = cumulativeDistances[idx] ?? 0;

    let formattedDistance: string;
    if (unit === 'mi') {
      formattedDistance = `${(distanceMetres / 1609.344).toFixed(1)} mi`;
    } else {
      formattedDistance = `${(distanceMetres / 1000).toFixed(1)} km`;
    }

    return {
      photo,
      distanceMetres,
      formattedTime: formatShortTime(photo.timestamp),
      formattedDistance,
    };
  });
}
