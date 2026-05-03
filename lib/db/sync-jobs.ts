import { db } from './client';

export interface SyncJob {
  id: string;
  walkId: string;
  deviceId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attemptedAt: number | null;
  errorMessage: string | null;
}

type SyncJobRow = {
  id: string;
  walk_id: string;
  device_id: string;
  status: string;
  attempted_at: number | null;
  error_message: string | null;
};

function rowToJob(row: SyncJobRow): SyncJob {
  return {
    id: row.id,
    walkId: row.walk_id,
    deviceId: row.device_id,
    status: row.status as SyncJob['status'],
    attemptedAt: row.attempted_at,
    errorMessage: row.error_message,
  };
}

export function createSyncJob(job: {
  id: string;
  walkId: string;
  deviceId: string;
}): void {
  db.runSync(
    `INSERT INTO sync_jobs (id, walk_id, device_id, status, attempted_at, error_message)
     VALUES (?, ?, ?, 'pending', NULL, NULL)`,
    job.id,
    job.walkId,
    job.deviceId,
  );
}

export function getPendingJobs(): SyncJob[] {
  const rows = db.getAllSync<SyncJobRow>(
    `SELECT * FROM sync_jobs WHERE status IN ('pending','failed') ORDER BY rowid ASC`,
  );
  return rows.map(rowToJob);
}

export function updateJobStatus(
  id: string,
  status: SyncJob['status'],
  errorMessage?: string,
): void {
  db.runSync(
    `UPDATE sync_jobs SET status = ?, attempted_at = ?, error_message = ? WHERE id = ?`,
    status,
    Date.now(),
    errorMessage ?? null,
    id,
  );
}

/**
 * Ensures a pending sync job exists for the given walk.
 * If there is already a pending or in-progress job, does nothing.
 * Pass a pre-generated UUID as `newId`.
 */
export function ensurePendingSyncJob(walkId: string, deviceId: string, newId: string): void {
  const existing = db.getFirstSync<{ id: string }>(
    `SELECT id FROM sync_jobs WHERE walk_id = ? AND status IN ('pending', 'in_progress') LIMIT 1`,
    walkId,
  );
  if (!existing) {
    db.runSync(
      `INSERT INTO sync_jobs (id, walk_id, device_id, status, attempted_at, error_message)
       VALUES (?, ?, ?, 'pending', NULL, NULL)`,
      newId,
      walkId,
      deviceId,
    );
  }
}
