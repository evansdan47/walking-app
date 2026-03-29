import { db } from './client';

export interface WalkPhoto {
  id: string;
  walkId: string;
  timestamp: number;
  latitude: number;
  longitude: number;
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
    `INSERT INTO walk_photos (id, walk_id, timestamp, latitude, longitude, local_uri, caption, convex_id, storage_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    photo.id,
    photo.walkId,
    photo.timestamp,
    photo.latitude,
    photo.longitude,
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
