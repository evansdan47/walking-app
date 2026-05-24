import { randomUUID } from 'expo-crypto';
import { db } from './client';

export interface TrackPoint {
  id: string;
  walkId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitudeMetres: number | null;
  speedMps: number | null;
  accuracyMetres: number;
  isClean: boolean;
  /** Unix ms when this point was successfully pushed to Convex (live walk). Null if not yet synced. */
  syncedAt: number | null;
}

type TrackPointRow = {
  id: string;
  walk_id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude_metres: number | null;
  speed_mps: number | null;
  accuracy_metres: number;
  is_clean: number;
  synced_at: number | null;
};

function rowToPoint(row: TrackPointRow): TrackPoint {
  return {
    id: row.id,
    walkId: row.walk_id,
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMetres: row.altitude_metres,
    speedMps: row.speed_mps,
    accuracyMetres: row.accuracy_metres,
    isClean: row.is_clean === 1,
    syncedAt: row.synced_at ?? null,
  };
}

export function insertPoint(point: Omit<TrackPoint, 'isClean' | 'syncedAt'>): void {
  db.runSync(
    `INSERT INTO track_points (id, walk_id, timestamp, latitude, longitude, altitude_metres, speed_mps, accuracy_metres, is_clean)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    point.id,
    point.walkId,
    point.timestamp,
    point.latitude,
    point.longitude,
    point.altitudeMetres ?? null,
    point.speedMps ?? null,
    point.accuracyMetres,
  );
}

export function getPointsForWalk(walkId: string): TrackPoint[] {
  const rows = db.getAllSync<TrackPointRow>(
    `SELECT * FROM track_points WHERE walk_id = ? ORDER BY timestamp ASC`,
    walkId,
  );
  return rows.map(rowToPoint);
}

/**
 * Returns a downsampled list of [longitude, latitude] pairs for rendering a
 * route thumbnail. Uses every Nth clean point so the result has at most
 * `maxPoints` entries, preserving the start and end points.
 */
export function getRouteCoordinatesForWalk(
  walkId: string,
  maxPoints = 60,
): [number, number][] {
  // Prefer clean points; fall back to all points.
  const allRows = db.getAllSync<TrackPointRow>(
    `SELECT latitude, longitude FROM track_points WHERE walk_id = ? AND is_clean = 1 ORDER BY timestamp ASC`,
    walkId,
  );
  const rows =
    allRows.length > 0
      ? allRows
      : db.getAllSync<TrackPointRow>(
          `SELECT latitude, longitude FROM track_points WHERE walk_id = ? ORDER BY timestamp ASC`,
          walkId,
        );

  if (rows.length === 0) return [];
  if (rows.length <= maxPoints) return rows.map((r) => [r.longitude, r.latitude]);

  const step = (rows.length - 1) / (maxPoints - 1);
  const sampled: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    const row = rows[Math.min(idx, rows.length - 1)]!;
    sampled.push([row.longitude, row.latitude]);
  }
  return sampled;
}

export function markPointsClean(ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE track_points SET is_clean = 1 WHERE id IN (${placeholders})`,
    ...ids,
  );
}

/**
 * Batch-inserts track points downloaded from Convex.
 * All points are marked is_clean = 1 (Convex only stores clean points).
 * Uses INSERT OR IGNORE so re-running a down-sync is safe.
 */
export function insertDownloadedPoints(
  walkId: string,
  points: Array<{ timestamp: number; latitude: number; longitude: number; altitudeMetres?: number }>,
): void {
  for (const pt of points) {
    db.runSync(
      `INSERT OR IGNORE INTO track_points
         (id, walk_id, timestamp, latitude, longitude, altitude_metres, speed_mps, accuracy_metres, is_clean)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 1)`,
      randomUUID(),
      walkId,
      pt.timestamp,
      pt.latitude,
      pt.longitude,
      pt.altitudeMetres ?? null,
    );
  }
}

export function getCleanPointsForWalk(walkId: string): TrackPoint[] {
  const rows = db.getAllSync<TrackPointRow>(
    `SELECT * FROM track_points WHERE walk_id = ? AND is_clean = 1 ORDER BY timestamp ASC`,
    walkId,
  );
  // Fall back to all points if none have been marked clean yet (e.g. post-processing
  // hasn't run — defensive guard so review never shows an empty route).
  if (rows.length === 0) return getPointsForWalk(walkId);
  return rows.map(rowToPoint);
}

export function getFirstPointForWalk(walkId: string): TrackPoint | null {
  const row = db.getFirstSync<TrackPointRow>(
    `SELECT * FROM track_points WHERE walk_id = ? ORDER BY timestamp ASC LIMIT 1`,
    walkId,
  );
  return row ? rowToPoint(row) : null;
}

/**
 * Returns all points for a walk that have not yet been pushed to Convex
 * (synced_at IS NULL). Used by the live-sync hook to determine what to flush.
 * Ordered oldest-first so Convex receives points in chronological order.
 */
export function getUnsyncedPointsForWalk(walkId: string): TrackPoint[] {
  const rows = db.getAllSync<TrackPointRow>(
    `SELECT * FROM track_points WHERE walk_id = ? AND synced_at IS NULL ORDER BY timestamp ASC`,
    walkId,
  );
  return rows.map(rowToPoint);
}

/**
 * Marks the given track point IDs as successfully synced to Convex.
 * Called after each successful insertBatch during live sync and post-walk upload.
 */
export function markPointsSynced(ids: string[]): void {
  if (ids.length === 0) return;
  const now = Date.now();
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE track_points SET synced_at = ? WHERE id IN (${placeholders})`,
    now,
    ...ids,
  );
}
