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
  };
}

export function createWalk(walk: {
  id: string;
  title?: string;
  deviceId: string;
  startedAt: number;
}): void {
  db.runSync(
    `INSERT INTO walks (id, title, status, started_at, device_id, created_at) VALUES (?, ?, 'recording', ?, ?, ?)`,
    walk.id,
    walk.title ?? null,
    walk.startedAt,
    walk.deviceId,
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
