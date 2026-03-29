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
  };
}

export function insertPoint(point: Omit<TrackPoint, 'isClean'>): void {
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

export function markPointsClean(ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.runSync(
    `UPDATE track_points SET is_clean = 1 WHERE id IN (${placeholders})`,
    ...ids,
  );
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
