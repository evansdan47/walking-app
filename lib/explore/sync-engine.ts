import { api } from '@/convex/_generated/api';
import { convexClient } from '@/lib/convex-client';
import { db } from '@/lib/db/client';
import type { ConvexReactClient } from 'convex/react';
import type { ExploreViewBounds } from './region';
import { computeCentroid, coordToCell, viewportToCells } from './region';

/** How long a region hash check result is considered fresh (ms). */
const HASH_CHECK_TTL_MS = 60 * 60 * 1000; // 1 hour

type CachedRegion = {
  content_hash: string | null;
  last_checked_at: number | null;
};

/**
 * Sync public planned routes for all region cells that overlap the given
 * viewport. Reads the local SQLite cache to determine which cells are stale,
 * makes the minimum number of Convex calls needed, and writes results back
 * to SQLite.
 *
 * This function is safe to call on every viewport change — it is a no-op
 * for recently-checked, unchanged regions.
 */
export async function syncExploreRegions(bounds: ExploreViewBounds): Promise<void> {
  const cellKeys = viewportToCells(bounds);
  if (cellKeys.length === 0) return;

  const now = Date.now();

  // Determine which cells need a hash check (stale or never checked).
  const cellsNeedingCheck: string[] = [];
  for (const key of cellKeys) {
    const cached = db.getFirstSync<CachedRegion>(
      `SELECT content_hash, last_checked_at FROM explore_region_cache WHERE region_key = ?`,
      key,
    );
    const lastChecked = cached?.last_checked_at ?? 0;
    if (now - lastChecked > HASH_CHECK_TTL_MS) {
      cellsNeedingCheck.push(key);
    }
  }

  if (cellsNeedingCheck.length === 0) return;

  // Fetch hashes for stale cells in a single Convex call.
  const hashes = await convexClient.query(api.explore_routes.getRegionHashes, {
    regionKeys: cellsNeedingCheck,
  });

  // For each cell, decide whether to fetch full routes or just bump the
  // last_checked_at timestamp.
  for (const { regionKey, hash } of hashes) {
    const cached = db.getFirstSync<CachedRegion>(
      `SELECT content_hash, last_checked_at FROM explore_region_cache WHERE region_key = ?`,
      regionKey,
    );

    const hashChanged = !cached || cached.content_hash !== hash;

    if (hashChanged) {
      // Full region fetch needed.
      const routes = await convexClient.query(api.explore_routes.listPublicByRegion, {
        regionKey,
      });

      // Upsert each route into the local cache.
      for (const route of routes) {
        const centroid = computeCentroid(route.legs);

        db.runSync(
          `INSERT INTO explore_routes
             (id, region_key, title, description, author_id, visibility,
              distance_km, elevation_gain_m, centroid_lat, centroid_lng,
              legs_json, created_at, cached_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             region_key       = excluded.region_key,
             title            = excluded.title,
             description      = excluded.description,
             author_id        = excluded.author_id,
             visibility       = excluded.visibility,
             distance_km      = excluded.distance_km,
             elevation_gain_m = excluded.elevation_gain_m,
             centroid_lat     = excluded.centroid_lat,
             centroid_lng     = excluded.centroid_lng,
             legs_json        = excluded.legs_json,
             created_at       = excluded.created_at,
             cached_at        = excluded.cached_at`,
          route._id,
          regionKey,
          route.title,
          route.description ?? null,
          (route.authorId ?? route.userId) as string,
          route.visibility ?? 'public',
          route.stats?.distanceKm ?? null,
          route.stats?.elevationGainM ?? null,
          centroid.lat,
          centroid.lng,
          JSON.stringify(route.legs),
          route.createdAt,
          now,
        );
      }

      // Update region cache with new hash and route count.
      db.runSync(
        `INSERT INTO explore_region_cache
           (region_key, route_count, content_hash, last_checked_at, last_synced_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(region_key) DO UPDATE SET
           route_count     = excluded.route_count,
           content_hash    = excluded.content_hash,
           last_checked_at = excluded.last_checked_at,
           last_synced_at  = excluded.last_synced_at`,
        regionKey,
        routes.length,
        hash,
        now,
        now,
      );
    } else {
      // Hash unchanged — just refresh the last_checked_at timestamp so
      // this region won't be re-checked until the TTL expires again.
      db.runSync(
        `INSERT INTO explore_region_cache
           (region_key, route_count, content_hash, last_checked_at, last_synced_at)
         VALUES (?, 0, ?, ?, NULL)
         ON CONFLICT(region_key) DO UPDATE SET
           last_checked_at = excluded.last_checked_at`,
        regionKey,
        hash,
        now,
      );
    }
  }
}

/**
 * Immediately upsert a single route into the local explore_routes cache.
 * Called by the planner on save/publish so the user sees their own route in
 * Explore without waiting for the next region sync.
 */
export function upsertExploreRoute(route: {
  _id: string;
  userId: string;
  authorId?: string;
  visibility?: string;
  title: string;
  description?: string;
  legs: Array<{ id: string; name: string; color: string; points: Array<{ lat: number; lng: number }> }>;
  stats?: { distanceKm: number; elevationGainM: number };
  createdAt: number;
}): void {
  const centroid = computeCentroid(route.legs);
  const regionKey = coordToCell(centroid.lat, centroid.lng);
  const now = Date.now();

  db.runSync(
    `INSERT INTO explore_routes
       (id, region_key, title, description, author_id, visibility,
        distance_km, elevation_gain_m, centroid_lat, centroid_lng,
        legs_json, created_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       region_key       = excluded.region_key,
       title            = excluded.title,
       description      = excluded.description,
       visibility       = excluded.visibility,
       distance_km      = excluded.distance_km,
       elevation_gain_m = excluded.elevation_gain_m,
       centroid_lat     = excluded.centroid_lat,
       centroid_lng     = excluded.centroid_lng,
       legs_json        = excluded.legs_json,
       created_at       = excluded.created_at,
       cached_at        = excluded.cached_at`,
    route._id,
    regionKey,
    route.title,
    route.description ?? null,
    route.authorId ?? route.userId,
    route.visibility ?? 'public',
    route.stats?.distanceKm ?? null,
    route.stats?.elevationGainM ?? null,
    centroid.lat,
    centroid.lng,
    JSON.stringify(route.legs),
    route.createdAt,
    now,
  );
}

/**
 * Fetch the authenticated user's public planned routes from Convex and upsert
 * them into the local explore_routes cache. Called on app resume and on mount
 * so own routes are always visible in Explore regardless of which region is
 * currently on-screen (covers the post-reinstall case where trigger-1 fires
 * have never run).
 *
 * This is a no-op when the user is unauthenticated — the Convex query returns
 * an empty array and nothing is written.
 */
export async function syncOwnRoutes(convex: ConvexReactClient): Promise<void> {
  // Fetch ALL of the user's routes (public and private) so that private routes
  // are visible to their author in the Explore tab.
  const routes = await convex.query(api.planned_routes.listForCurrentUser, {});
  if (routes.length === 0) return;

  const now = Date.now();

  for (const route of routes) {
    const centroid = computeCentroid(route.legs);
    const regionKey = coordToCell(centroid.lat, centroid.lng);

    db.runSync(
      `INSERT INTO explore_routes
         (id, region_key, title, description, author_id, visibility,
          distance_km, elevation_gain_m, centroid_lat, centroid_lng,
          legs_json, created_at, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         region_key       = excluded.region_key,
         title            = excluded.title,
         description      = excluded.description,
         visibility       = excluded.visibility,
         distance_km      = excluded.distance_km,
         elevation_gain_m = excluded.elevation_gain_m,
         centroid_lat     = excluded.centroid_lat,
         centroid_lng     = excluded.centroid_lng,
         legs_json        = excluded.legs_json,
         created_at       = excluded.created_at,
         cached_at        = excluded.cached_at`,
      route._id,
      regionKey,
      route.title,
      route.description ?? null,
      (route.authorId ?? route.userId) as string,
      route.visibility ?? 'private',
      route.stats?.distanceKm ?? null,
      route.stats?.elevationGainM ?? null,
      centroid.lat,
      centroid.lng,
      JSON.stringify(route.legs),
      route.createdAt,
      now,
    );
  }
}
