import type { PlannedRoute } from '@/components/explore/explore-map-layer';
import { db } from '@/lib/db/client';
import type { ExploreViewBounds } from '@/lib/explore/region';
import { CELL_DEGREES } from '@/lib/explore/region';
import { syncExploreRegions, syncOwnRoutes } from '@/lib/explore/sync-engine';
import { useConvex } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';

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

/** Map a SQLite explore_routes row to the PlannedRoute (Doc<'plannedRoutes'>) shape. */
function rowToRoute(row: ExploreRouteRow): PlannedRoute {
  return {
    _id: row.id as PlannedRoute['_id'],
    _creationTime: row.created_at,
    userId: row.author_id as PlannedRoute['userId'],
    authorId: row.author_id as PlannedRoute['authorId'],
    visibility: row.visibility as PlannedRoute['visibility'],
    title: row.title,
    description: row.description ?? undefined,
    legs: JSON.parse(row.legs_json),
    createdAt: row.created_at,
    stats:
      row.distance_km != null
        ? { distanceKm: row.distance_km, elevationGainM: row.elevation_gain_m ?? 0 }
        : undefined,
  };
}

/**
 * Local-first hook for the Explore tab.
 *
 * Always reads from the SQLite explore_routes cache (instant, no loading
 * state). Triggers a background sync when bounds change — the sync makes at
 * most one Convex call per region cell per hour.
 *
 * No Convex useQuery subscriptions are used. Replacing the previous
 * committedMode state machine entirely.
 */
export function useExploreData(bounds: ExploreViewBounds | null): {
  routes: PlannedRoute[];
  isSyncing: boolean;
  lastSyncedAt: number | null;
} {
  const convex = useConvex();
  const [routes, setRoutes] = useState<PlannedRoute[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Prevent concurrent syncs. If bounds change during a sync, the next
  // bounds-change effect will trigger a new sync once this one finishes.
  const syncInFlightRef = useRef(false);

  /** Read routes for the current bounds from SQLite immediately. */
  const loadFromDb = useCallback((b: ExploreViewBounds) => {
    // Query with CELL_DEGREES padding to capture routes in all cells that
    // overlap or border the viewport.
    const pad = CELL_DEGREES;
    const rows = db.getAllSync<ExploreRouteRow>(
      `SELECT id, title, description, author_id, visibility,
              distance_km, elevation_gain_m, centroid_lat, centroid_lng,
              legs_json, created_at
       FROM explore_routes
       WHERE centroid_lat BETWEEN ? AND ?
         AND centroid_lng BETWEEN ? AND ?`,
      b.minLat - pad,
      b.maxLat + pad,
      b.minLng - pad,
      b.maxLng + pad,
    );
    setRoutes(rows.map(rowToRoute));
  }, []);

  useEffect(() => {
    if (!bounds) {
      setRoutes([]);
      return;
    }

    // 1. Immediately populate from cache (no visible loading delay).
    loadFromDb(bounds);

    // 2. Background sync — skip if one is already running.
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setIsSyncing(true);

    // Run region sync and own-routes sync in parallel so that private routes
    // owned by the current user are also picked up before we re-read SQLite.
    Promise.all([
      syncExploreRegions(bounds),
      syncOwnRoutes(convex),
    ])
      .then(() => {
        // Re-read SQLite after both syncs complete so all routes are visible.
        loadFromDb(bounds);
        setLastSyncedAt(Date.now());
      })
      .catch((err) => {
        console.warn('[useExploreData] background sync failed:', err);
      })
      .finally(() => {
        syncInFlightRef.current = false;
        setIsSyncing(false);
      });
  }, [bounds, loadFromDb]);

  return { routes, isSyncing, lastSyncedAt };
}
