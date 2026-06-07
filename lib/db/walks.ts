import { db } from './client';

export interface WalkStats {
  distanceMetres: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  stoppedTimeSeconds: number;
  avgPaceSecsPerKm?: number | undefined;
  elevationGainMetres?: number | undefined;
  elevationLossMetres?: number | undefined;
  pointCount: number;
  stepCount?: number | undefined;
  hcStepCount?: number | undefined;
  // Health Connect enrichment — present only when HC data was read successfully
  caloriesKcal?: number | undefined;
  avgHeartRateBpm?: number | undefined;
  maxHeartRateBpm?: number | undefined;
  hcSynced?: boolean | undefined;
  // Elevation detail — present only when altitude coverage is sufficient (Phase 4b)
  longestAscentMetres?: number | undefined;
  steepestAscentGradientPct?: number | undefined;
  longestDescentMetres?: number | undefined;
  steepestDescentGradientPct?: number | undefined;
}

export interface Walk {
  id: string;
  title: string | null;
  status: 'recording' | 'paused' | 'completed';
  startedAt: number;
  endedAt: number | null;
  deviceId: string;
  stats: WalkStats | null;
  convexId: string | null;
  createdAt: number;
  /** True when the user opted in to Live Broadcast for this walk. */
  isLive: boolean;
  /** Decimated display polyline as JSON-encoded [[lat,lng],…] array. Null until backfill runs. */
  displayPolylineJson: string | null;
  /** Version of the algorithm used to produce displayPolylineJson. */
  displayPolylineVersion: number | null;
  /** Convex planned route id when walk followed a saved route. */
  plannedRouteId: string | null;
}

type WalkRow = {
  id: string;
  title: string | null;
  status: string;
  started_at: number;
  ended_at: number | null;
  device_id: string;
  stats_json: string | null;
  convex_id: string | null;
  created_at: number;
  is_live: number;
  display_polyline_json: string | null;
  display_polyline_version: number | null;
  planned_route_id: string | null;
};

function rowToWalk(row: WalkRow): Walk {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Walk['status'],
    startedAt: row.started_at,
    endedAt: row.ended_at,
    deviceId: row.device_id,
    stats: row.stats_json ? (JSON.parse(row.stats_json) as WalkStats) : null,
    convexId: row.convex_id,
    createdAt: row.created_at,
    isLive: row.is_live === 1,
    displayPolylineJson: row.display_polyline_json ?? null,
    displayPolylineVersion: row.display_polyline_version ?? null,
    plannedRouteId: row.planned_route_id ?? null,
  };
}

export function createWalk(walk: {
  id: string;
  title?: string;
  deviceId: string;
  startedAt: number;
  isLive?: boolean;
  plannedRouteId?: string;
}): void {
  db.runSync(
    `INSERT INTO walks (id, title, status, started_at, device_id, is_live, planned_route_id, created_at) VALUES (?, ?, 'recording', ?, ?, ?, ?, ?)`,
    walk.id,
    walk.title ?? null,
    walk.startedAt,
    walk.deviceId,
    walk.isLive ? 1 : 0,
    walk.plannedRouteId ?? null,
    Date.now(),
  );
}

export function updateWalkPlannedRouteId(id: string, plannedRouteId: string | null): void {
  db.runSync(`UPDATE walks SET planned_route_id = ? WHERE id = ?`, plannedRouteId, id);
}

/**
 * Inserts a completed walk downloaded from Convex into the local SQLite DB.
 * Uses INSERT OR IGNORE so repeated down-sync calls are safe.
 */
export function insertDownloadedWalk(walk: {
  id: string;
  convexId: string;
  title: string | null;
  status: string;
  startedAt: number;
  endedAt: number | null;
  deviceId: string;
  stats: WalkStats | null;
  isLive: boolean;
}): void {
  db.runSync(
    `INSERT OR IGNORE INTO walks
       (id, title, status, started_at, ended_at, device_id, stats_json, convex_id, is_live, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    walk.id,
    walk.title,
    walk.status,
    walk.startedAt,
    walk.endedAt,
    walk.deviceId,
    walk.stats ? JSON.stringify(walk.stats) : null,
    walk.convexId,
    walk.isLive ? 1 : 0,
    Date.now(),
  );
}

export function updateWalkStatus(
  id: string,
  status: Walk['status'],
  endedAt?: number,
): void {
  if (endedAt !== undefined) {
    db.runSync(
      `UPDATE walks SET status = ?, ended_at = ? WHERE id = ?`,
      status,
      endedAt,
      id,
    );
  } else {
    db.runSync(`UPDATE walks SET status = ? WHERE id = ?`, status, id);
  }
}

export function updateWalkStats(id: string, stats: WalkStats): void {
  db.runSync(
    `UPDATE walks SET stats_json = ? WHERE id = ?`,
    JSON.stringify(stats),
    id,
  );
}

export function updateWalkConvexId(id: string, convexId: string): void {
  db.runSync(`UPDATE walks SET convex_id = ? WHERE id = ?`, convexId, id);
}

export function getWalk(id: string): Walk | null {
  const row = db.getFirstSync<WalkRow>(
    `SELECT * FROM walks WHERE id = ?`,
    id,
  );
  return row ? rowToWalk(row) : null;
}

export function listWalks(): Walk[] {
  const rows = db.getAllSync<WalkRow>(
    `SELECT * FROM walks ORDER BY created_at DESC`,
  );
  return rows.map(rowToWalk);
}

export function listCompletedWalks(): Walk[] {
  const rows = db.getAllSync<WalkRow>(
    `SELECT * FROM walks WHERE status = 'completed' ORDER BY started_at DESC`,
  );
  return rows.map(rowToWalk);
}

export function updateWalkTitle(walkId: string, title: string): void {
  db.runSync(`UPDATE walks SET title = ? WHERE id = ?`, title, walkId);
}

export function listCompletedWalksSince(fromTs: number): Walk[] {
  const rows = db.getAllSync<WalkRow>(
    `SELECT * FROM walks WHERE status = 'completed' AND started_at >= ? ORDER BY started_at DESC`,
    fromTs,
  );
  return rows.map(rowToWalk);
}

export interface WeekBucket {
  /** Monday of the week (start of day, local midnight) as a Unix ms timestamp. */
  weekStart: number;
  distanceMetres: number;
  sessionCount: number;
  durationSeconds: number;
}

/**
 * Returns a WeekBucket for each of the last `numWeeks` ISO weeks (Mon–Sun),
 * newest last (so index 0 = oldest, last index = current/most recent week).
 */
export function getWeeklyStats(numWeeks = 8): WeekBucket[] {
  // Find the Monday of the current week in local time.
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon ...
  const daysSinceMonday = (dow + 6) % 7; // Mon=0 ... Sun=6
  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(thisMonday.getDate() - daysSinceMonday);

  const buckets: WeekBucket[] = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    buckets.push({
      weekStart: weekStart.getTime(),
      distanceMetres: 0,
      sessionCount: 0,
      durationSeconds: 0,
    });

    const rows = db.getAllSync<WalkRow>(
      `SELECT * FROM walks WHERE status = 'completed' AND started_at >= ? AND started_at < ?`,
      weekStart.getTime(),
      weekEnd.getTime(),
    );
    for (const row of rows) {
      const walk = rowToWalk(row);
      buckets[buckets.length - 1]!.sessionCount += 1;
      if (walk.stats) {
        buckets[buckets.length - 1]!.distanceMetres += walk.stats.distanceMetres;
        buckets[buckets.length - 1]!.durationSeconds += walk.stats.durationSeconds;
      }
    }
  }
  return buckets;
}

export function deleteWalk(walkId: string): void {

  // Delete dependent rows first, then the walk itself.
  db.runSync(`DELETE FROM track_points WHERE walk_id = ?`, walkId);
  db.runSync(`DELETE FROM walk_photos WHERE walk_id = ?`, walkId);
  db.runSync(`DELETE FROM sync_jobs WHERE walk_id = ?`, walkId);
  db.runSync(`DELETE FROM walks WHERE id = ?`, walkId);
}

const ACTIVE_WALK_KEY = 'active_walk_id';

export function getActiveWalkId(): string | null {
  const row = db.getFirstSync<{ value: string }>(
    `SELECT value FROM kv_store WHERE key = ?`,
    ACTIVE_WALK_KEY,
  );
  return row?.value ?? null;
}

export function setActiveWalkId(id: string): void {
  db.runSync(
    `INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`,
    ACTIVE_WALK_KEY,
    id,
  );
}

export function clearActiveWalkId(): void {
  db.runSync(`DELETE FROM kv_store WHERE key = ?`, ACTIVE_WALK_KEY);
}

/**
 * Returns IDs of completed walks whose display polyline has not yet been
 * computed or was computed at an older algorithm version.
 */
export function listWalksNeedingDisplayPolyline(currentVersion: number): string[] {
  const rows = db.getAllSync<{ id: string }>(
    `SELECT id FROM walks
     WHERE status = 'completed'
       AND (display_polyline_json IS NULL OR display_polyline_version < ?)`,
    currentVersion,
  );
  return rows.map((r) => r.id);
}

export function updateWalkDisplayPolyline(
  id: string,
  polylineJson: string,
  version: number,
): void {
  db.runSync(
    `UPDATE walks SET display_polyline_json = ?, display_polyline_version = ? WHERE id = ?`,
    polylineJson,
    version,
    id,
  );
}
