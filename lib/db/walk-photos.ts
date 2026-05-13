import { db } from './client';

export interface WalkPhoto {
  id: string;
  walkId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  localUri: string;
  caption: string | null;
  convexId: string | null;
  storageId: string | null;
}

type WalkPhotoRow = {
  id: string;
  walk_id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  local_uri: string;
  caption: string | null;
  convex_id: string | null;
  storage_id: string | null;
};

function rowToPhoto(row: WalkPhotoRow): WalkPhoto {
  return {
    id: row.id,
    walkId: row.walk_id,
    timestamp: row.timestamp,
    latitude: row.latitude,
    longitude: row.longitude,
    heading: row.heading,
    localUri: row.local_uri,
    caption: row.caption,
    convexId: row.convex_id,
    storageId: row.storage_id,
  };
}

export function insertPhoto(
  photo: Omit<WalkPhoto, 'convexId' | 'storageId'>,
): void {
  db.runSync(
    `INSERT INTO walk_photos (id, walk_id, timestamp, latitude, longitude, heading, local_uri, caption, convex_id, storage_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    photo.id,
    photo.walkId,
    photo.timestamp,
    photo.latitude,
    photo.longitude,
    photo.heading ?? null,
    photo.localUri,
    photo.caption ?? null,
  );
}

export function getPhotosForWalk(walkId: string): WalkPhoto[] {
  const rows = db.getAllSync<WalkPhotoRow>(
    `SELECT * FROM walk_photos WHERE walk_id = ? ORDER BY timestamp ASC`,
    walkId,
  );
  return rows.map(rowToPhoto);
}

/**
 * Returns a map of walkId → photo count for the given walk IDs.
 * Uses a single GROUP BY query for efficiency.
 */
export function getPhotoCountsForWalks(walkIds: string[]): Map<string, number> {
  if (walkIds.length === 0) return new Map();
  const placeholders = walkIds.map(() => '?').join(',');
  const rows = db.getAllSync<{ walk_id: string; cnt: number }>(
    `SELECT walk_id, COUNT(*) as cnt FROM walk_photos WHERE walk_id IN (${placeholders}) GROUP BY walk_id`,
    ...walkIds,
  );
  return new Map(rows.map((r) => [r.walk_id, r.cnt]));
}

/**
 * Returns the first N photos for each walk in the given list, ordered by timestamp.
 * Returns a map of walkId → WalkPhoto[].
 */
export function getFirstPhotosForWalks(walkIds: string[], limit = 5): Map<string, WalkPhoto[]> {
  if (walkIds.length === 0) return new Map();
  const result = new Map<string, WalkPhoto[]>();
  for (const id of walkIds) {
    const rows = db.getAllSync<WalkPhotoRow>(
      `SELECT * FROM walk_photos WHERE walk_id = ? ORDER BY timestamp ASC LIMIT ?`,
      id,
      limit,
    );
    result.set(id, rows.map(rowToPhoto));
  }
  return result;
}

export function updatePhotoAfterSync(
  id: string,
  convexId: string,
  storageId: string,
): void {
  db.runSync(
    `UPDATE walk_photos SET convex_id = ?, storage_id = ? WHERE id = ?`,
    convexId,
    storageId,
    id,
  );
}
