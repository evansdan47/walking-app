import { db } from './client';

export type PhotoStatus =
  | 'local_only'
  | 'upload_pending'
  | 'uploaded'
  | 'upload_failed'
  | 'upload_skipped';

export interface WalkPhoto {
  id: string;
  walkId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  localUri: string;
  localAssetUri: string | null;
  photoStatus: PhotoStatus;
  nearestTrackPointId: string | null;
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
  local_asset_uri: string | null;
  photo_status: string | null;
  nearest_track_point_id: string | null;
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
    localAssetUri: row.local_asset_uri ?? null,
    photoStatus: (row.photo_status as PhotoStatus | null) ?? 'local_only',
    nearestTrackPointId: row.nearest_track_point_id ?? null,
    caption: row.caption,
    convexId: row.convex_id,
    storageId: row.storage_id,
  };
}

export type InsertPhotoInput = {
  id: string;
  walkId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  localAssetUri: string;
  caption: string | null;
};

export function insertPhoto(photo: InsertPhotoInput): void {
  db.runSync(
    `INSERT INTO walk_photos
       (id, walk_id, timestamp, latitude, longitude, heading,
        local_uri, local_asset_uri, photo_status, caption, convex_id, storage_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local_only', ?, NULL, NULL)`,
    photo.id,
    photo.walkId,
    photo.timestamp,
    photo.latitude,
    photo.longitude,
    photo.heading ?? null,
    photo.localAssetUri,
    photo.localAssetUri,
    photo.caption ?? null,
  );
}

export function updatePhotoStatus(id: string, status: PhotoStatus): void {
  db.runSync(`UPDATE walk_photos SET photo_status = ? WHERE id = ?`, status, id);
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
    `UPDATE walk_photos SET convex_id = ?, storage_id = ?, photo_status = 'uploaded' WHERE id = ?`,
    convexId,
    storageId,
    id,
  );
}
