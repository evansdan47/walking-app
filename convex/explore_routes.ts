import { v } from 'convex/values';
import { query } from './_generated/server';

/**
 * Convex queries for the Explore offline-first sync engine.
 *
 * These are one-shot HTTP calls (not reactive subscriptions). The sync engine
 * calls them imperatively via ConvexClient from convex/browser.
 *
 * Hash format: "{routeCount}_{maxCreatedAt}"
 * Known limitation: edits to a route's title, description, or geometry do not
 * change count or maxCreatedAt, so edited routes may not appear updated until
 * a forced refresh. Callers should not overclaim hash correctness.
 */

// ─── Shared helpers (mirrored in lib/explore/region.ts) ──────────────────────
// Duplicated here to avoid importing client-side code into the Convex runtime.

const CELL_DEGREES = 2.0;

function coordToCell(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / CELL_DEGREES) * CELL_DEGREES;
  const cellLng = Math.floor(lng / CELL_DEGREES) * CELL_DEGREES;
  return `${cellLat}:${cellLng}`;
}

function computeCentroid(
  legs: Array<{ points: Array<{ lat: number; lng: number }> }>,
): { lat: number; lng: number } {
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  for (const leg of legs) {
    for (const pt of leg.points) {
      totalLat += pt.lat;
      totalLng += pt.lng;
      count++;
    }
  }
  if (count === 0) return { lat: 0, lng: 0 };
  return { lat: totalLat / count, lng: totalLng / count };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Return a lightweight hash for each requested region key.
 *
 * The client sends the cell keys it wants to check; the server returns
 * { regionKey, hash } for each. A hash of "0_0" means the region has no
 * public routes. The client uses these hashes to decide whether a full
 * region fetch is needed.
 */
export const getRegionHashes = query({
  args: {
    regionKeys: v.array(v.string()),
  },
  handler: async (ctx, { regionKeys }) => {
    const requestedSet = new Set(regionKeys);

    // Full scan — acceptable for MVP route counts. Legacy rows with no
    // visibility field are treated as 'public' for back-compat.
    const allRoutes = await ctx.db.query('plannedRoutes').collect();
    const publicRoutes = allRoutes.filter(
      (r) => (r.visibility ?? 'public') === 'public',
    );

    // Group matching routes by cell key.
    const regionMap = new Map<string, { count: number; maxCreatedAt: number }>();
    for (const route of publicRoutes) {
      const centroid = computeCentroid(route.legs);
      const key = coordToCell(centroid.lat, centroid.lng);
      if (!requestedSet.has(key)) continue;
      const existing = regionMap.get(key) ?? { count: 0, maxCreatedAt: 0 };
      regionMap.set(key, {
        count: existing.count + 1,
        maxCreatedAt: Math.max(existing.maxCreatedAt, route.createdAt),
      });
    }

    // Return an entry for every requested key; empty regions return "0_0".
    return regionKeys.map((key) => {
      const data = regionMap.get(key);
      const hash = data ? `${data.count}_${data.maxCreatedAt}` : '0_0';
      return { regionKey: key, hash };
    });
  },
});

/**
 * Return all public planned routes whose centroid falls within the given
 * region cell key. Called by the sync engine when a hash mismatch is detected.
 */
export const listPublicByRegion = query({
  args: {
    regionKey: v.string(),
  },
  handler: async (ctx, { regionKey }) => {
    const allRoutes = await ctx.db.query('plannedRoutes').collect();

    return allRoutes.filter((route) => {
      if ((route.visibility ?? 'public') !== 'public') return false;
      const centroid = computeCentroid(route.legs);
      return coordToCell(centroid.lat, centroid.lng) === regionKey;
    });
  },
});
