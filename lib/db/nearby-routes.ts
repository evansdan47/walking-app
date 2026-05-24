/**
 * findNearbyRoutes
 *
 * Queries the local SQLite `explore_routes` cache for routes whose **start
 * point** (first coordinate of the first leg) is within `radiusM` metres of
 * the given GPS position.
 *
 * A generous centroid bounding-box pre-filter (≈5 km) limits the SQLite scan
 * before the precise haversine check is done in JS on the parsed leg data.
 */
import type { PlannedRoute } from '@/components/explore/explore-map-layer';
import { db } from '@/lib/db/client';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ExploreRouteRow = {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  visibility: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  centroid_lat: number;
  centroid_lng: number;
  legs_json: string;
  created_at: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns routes cached locally in SQLite whose start point lies within
 * `radiusM` metres (default 50) of the supplied GPS position.
 *
 * Returns an empty array on any error (never throws).
 */
export function findNearbyRoutes(
  lat: number,
  lng: number,
  radiusM = 50,
): PlannedRoute[] {
  // ±0.045° ≈ 5 km bounding box on centroid — generous enough to cover routes
  // whose centroid is far from the start (e.g. long out-and-back routes).
  const CENTROID_MARGIN_DEG = 0.045;

  try {
    const rows = db.getAllSync<ExploreRouteRow>(
      `SELECT id, title, description, author_id, visibility,
              distance_km, elevation_gain_m, centroid_lat, centroid_lng,
              legs_json, created_at
       FROM explore_routes
       WHERE centroid_lat BETWEEN ? AND ?
         AND centroid_lng BETWEEN ? AND ?`,
      lat - CENTROID_MARGIN_DEG,
      lat + CENTROID_MARGIN_DEG,
      lng - CENTROID_MARGIN_DEG,
      lng + CENTROID_MARGIN_DEG,
    );

    const nearby: PlannedRoute[] = [];

    for (const row of rows) {
      try {
        const legs = JSON.parse(row.legs_json) as Array<{
          id: string;
          name: string;
          color: string;
          points: Array<{ lat: number; lng: number; isControlPoint?: boolean; isSnapped?: boolean }>;
        }>;

        // Only routes whose first point is within the radius qualify — this
        // matches user intent of "a route starting near me".
        const startPt = legs[0]?.points[0];
        if (!startPt) continue;

        if (haversineM(lat, lng, startPt.lat, startPt.lng) <= radiusM) {
          nearby.push({
            _id:           row.id as PlannedRoute['_id'],
            _creationTime: row.created_at,
            userId:        row.author_id as PlannedRoute['userId'],
            authorId:      row.author_id as PlannedRoute['authorId'],
            visibility:    row.visibility as PlannedRoute['visibility'],
            title:         row.title,
            description:   row.description ?? undefined,
            legs,
            createdAt:     row.created_at,
            stats:
              row.distance_km != null
                ? { distanceKm: row.distance_km, elevationGainM: row.elevation_gain_m ?? 0 }
                : undefined,
          });
        }
      } catch {
        // Skip malformed rows silently.
      }
    }

    return nearby;
  } catch {
    return [];
  }
}
