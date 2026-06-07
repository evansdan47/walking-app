import {
    MAX_SYNC_RETRIES,
    SYNC_BACKOFF_BASE_MS,
    SYNC_BACKOFF_MAX_MS,
} from '@/lib/sync/sync-config';
import { db } from './client';

export interface SyncJob {
  id: string;
  walkId: string;
  deviceId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  attemptedAt: number | null;
  errorMessage: string | null;
  /** Number of upload attempts made so far. */
  attemptCount: number;
  /** Unix ms timestamp before which this job should not be retried (backoff). */
  nextAttemptAt: number;
  /** Track points already confirmed uploaded to Convex (checkpoint for resume). */
  uploadedPointCount: number;
  /** Walk core-data sync progress: updated per phase inside uploadWalk. */
  coreSyncStatus: 'pending' | 'in_progress' | 'synced';
  /** Photo upload result: set once the photo phase completes. */
  photoSyncStatus: 'none' | 'pending' | 'partial' | 'synced' | 'failed';
  /** Coarse resume checkpoint (1–4 matching the uploadWalk phases). */
  phase: number;
}

type SyncJobRow = {
  id: string;
  walk_id: string;
  device_id: string;
  status: string;
  attempted_at: number | null;
  error_message: string | null;
  attempt_count: number;
  next_attempt_at: number;
  uploaded_point_count: number;
  core_sync_status: string;
  photo_sync_status: string;
  phase: number;
};

function rowToJob(row: SyncJobRow): SyncJob {
  return {
    id: row.id,
    walkId: row.walk_id,
    deviceId: row.device_id,
    status: row.status as SyncJob['status'],
    attemptedAt: row.attempted_at,
    errorMessage: row.error_message,
    attemptCount: row.attempt_count ?? 0,
    nextAttemptAt: row.next_attempt_at ?? 0,
    uploadedPointCount: row.uploaded_point_count ?? 0,
    coreSyncStatus: (row.core_sync_status ?? 'pending') as SyncJob['coreSyncStatus'],
    photoSyncStatus: (row.photo_sync_status ?? 'none') as SyncJob['photoSyncStatus'],
    phase: row.phase ?? 1,
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
  const now = Date.now();
  const rows = db.getAllSync<SyncJobRow>(
    `SELECT * FROM sync_jobs
     WHERE status IN ('pending', 'failed')
       AND next_attempt_at <= ?
     ORDER BY rowid ASC`,
    now,
  );
  return rows.map(rowToJob);
}

export function getPendingJobForWalk(walkId: string): SyncJob | null {
  const row = db.getFirstSync<SyncJobRow>(
    `SELECT * FROM sync_jobs
     WHERE walk_id = ?
       AND status IN ('pending', 'failed', 'in_progress')
     ORDER BY rowid DESC
     LIMIT 1`,
    walkId,
  );
  return row ? rowToJob(row) : null;
}

export function updateJobStatus(
  id: string,
  status: SyncJob['status'],
  errorMessage?: string,
): void {
  const now = Date.now();
  if (status === 'failed') {
    // Fetch current attempt count to compute backoff.
    const row = db.getFirstSync<{ attempt_count: number }>(
      `SELECT attempt_count FROM sync_jobs WHERE id = ?`,
      id,
    );
    const attempts = (row?.attempt_count ?? 0) + 1;
    const backoffMs = Math.min(
      SYNC_BACKOFF_BASE_MS * Math.pow(2, attempts - 1),
      SYNC_BACKOFF_MAX_MS,
    );
    const nextAttemptAt = attempts >= MAX_SYNC_RETRIES ? Number.MAX_SAFE_INTEGER : now + backoffMs;
    db.runSync(
      `UPDATE sync_jobs
       SET status = ?, attempted_at = ?, error_message = ?,
           attempt_count = ?, next_attempt_at = ?
       WHERE id = ?`,
      status,
      now,
      errorMessage ?? null,
      attempts,
      nextAttemptAt,
      id,
    );
  } else {
    db.runSync(
      `UPDATE sync_jobs SET status = ?, attempted_at = ?, error_message = ? WHERE id = ?`,
      status,
      now,
      errorMessage ?? null,
      id,
    );
  }
}

/**
 * Persists a mid-upload checkpoint so that a retry can resume from where
 * the previous attempt left off rather than re-uploading from scratch.
 */
export function updateJobProgress(id: string, uploadedPointCount: number): void {
  db.runSync(
    `UPDATE sync_jobs SET uploaded_point_count = ? WHERE id = ?`,
    uploadedPointCount,
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

// ── Phase-tracking helpers ────────────────────────────────────────────────────

export function updateCoreSyncStatus(id: string, status: SyncJob['coreSyncStatus']): void {
  db.runSync(`UPDATE sync_jobs SET core_sync_status = ? WHERE id = ?`, status, id);
}

export function updatePhotoSyncStatus(id: string, status: SyncJob['photoSyncStatus']): void {
  db.runSync(`UPDATE sync_jobs SET photo_sync_status = ? WHERE id = ?`, status, id);
}

export function updateJobPhase(id: string, phase: number): void {
  db.runSync(`UPDATE sync_jobs SET phase = ? WHERE id = ?`, phase, id);
}

/** Walk-level sync status surfaced to UI (most-recent job per walk). */
export interface WalkSyncStatus {
  coreSyncStatus: SyncJob['coreSyncStatus'];
  photoSyncStatus: SyncJob['photoSyncStatus'];
}

/**
 * Returns a map of walkId → WalkSyncStatus for the given walk IDs.
 * Uses the most-recent sync job for each walk (highest rowid).
 */
export function getSyncStatusMap(walkIds: string[]): Map<string, WalkSyncStatus> {
  if (walkIds.length === 0) return new Map();
  const placeholders = walkIds.map(() => '?').join(',');
  const rows = db.getAllSync<{ walk_id: string; core_sync_status: string; photo_sync_status: string }>(
    `SELECT walk_id, core_sync_status, photo_sync_status
     FROM sync_jobs
     WHERE walk_id IN (${placeholders})
     ORDER BY rowid DESC`,
    ...walkIds,
  );
  const map = new Map<string, WalkSyncStatus>();
  for (const row of rows) {
    if (!map.has(row.walk_id)) {
      // ORDER BY rowid DESC → first occurrence per walk_id is the most recent job.
      map.set(row.walk_id, {
        coreSyncStatus: (row.core_sync_status ?? 'pending') as SyncJob['coreSyncStatus'],
        photoSyncStatus: (row.photo_sync_status ?? 'none') as SyncJob['photoSyncStatus'],
      });
    }
  }
  return map;
}
