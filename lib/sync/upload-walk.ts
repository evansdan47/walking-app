import * as FileSystem from 'expo-file-system/legacy';

import { api } from '@/convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';
import { db } from '../db/client';
import { updateCoreSyncStatus, updateJobPhase, updateJobProgress, updatePhotoSyncStatus, type SyncJob } from '../db/sync-jobs';
import { getPointsForWalk, getUnsyncedPointsForWalk, markPointsSynced } from '../db/track-points';
import { getPhotosForWalk, updatePhotoAfterSync, updatePhotoStatus } from '../db/walk-photos';
import type { WalkStats } from '../db/walks';
import { getWalk, updateWalkConvexId } from '../db/walks';
import { emitBadgeUnlocks } from '@/lib/badges/badge-unlock-events';
import { appLog } from '../diagnostics/logger';
import { SYNC_BATCH_SIZE } from './sync-config';

type ConvexStats = {
  distanceMetres: number;
  durationSeconds: number;
  movingTimeSeconds: number;
  stoppedTimeSeconds: number;
  pointCount: number;
  avgPaceSecsPerKm?: number;
  elevationGainMetres?: number;
  elevationLossMetres?: number;
};

/** Strips keys with value `undefined` so exactOptionalPropertyTypes is satisfied. */
function omitUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

function toConvexStats(s: WalkStats): ConvexStats {
  const base: ConvexStats = {
    distanceMetres: s.distanceMetres,
    durationSeconds: s.durationSeconds,
    movingTimeSeconds: s.movingTimeSeconds,
    stoppedTimeSeconds: s.stoppedTimeSeconds,
    pointCount: s.pointCount,
  };
  if (s.avgPaceSecsPerKm !== undefined) base.avgPaceSecsPerKm = s.avgPaceSecsPerKm;
  if (s.elevationGainMetres !== undefined) base.elevationGainMetres = s.elevationGainMetres;
  if (s.elevationLossMetres !== undefined) base.elevationLossMetres = s.elevationLossMetres;
  return base;
}

export interface UploadWalkOpts {
  /** The local sync-job id — used to save mid-upload checkpoints. */
  jobId: string;
  /** Track points already confirmed on Convex (resume after a partial failure). */
  uploadedPointCount: number;
}

/**
 * Uploads a single completed walk (and all its track points / photos) to Convex.
 *
 * Supports checkpoint-based resumption: if a previous attempt uploaded some
 * batches before failing, `opts.uploadedPointCount` lets us skip those and
 * continue from where we left off. After every successful batch the checkpoint
 * is persisted so the next retry never re-uploads confirmed data.
 *
 * After all batches complete a reconciliation step queries the server count and
 * re-uploads any gap, guaranteeing no data loss.
 *
 * Returns the Convex walk ID on success.
 */
export async function uploadWalk(
  walkId: string,
  convex: ConvexReactClient,
  opts: UploadWalkOpts,
): Promise<string> {
  const walk = getWalk(walkId);
  if (!walk) throw new Error(`Walk ${walkId} not found in SQLite`);

  // 1 – Create or reuse the walk document on the server.
  // For live walks the Convex document was already created by use-live-walk-sync;
  // reuse that ID rather than inserting a duplicate.
  let convexWalkId: string;

  if (walk.convexId) {
    // Live walk already has a server document — patch it to completed state.
    convexWalkId = walk.convexId;
    await convex.mutation(api.walks.complete, {
      walkId: walk.convexId as any,
      endedAt: walk.endedAt ?? Date.now(),
      ...(walk.stats !== null ? { stats: toConvexStats(walk.stats) } : {}),
      ...(walk.plannedRouteId ? { plannedRouteId: walk.plannedRouteId as any } : {}),
    });
  } else {
    // Normal (non-live) walk — create from scratch.
    convexWalkId = await convex.mutation(api.walks.create, {
      status: walk.status,
      startedAt: walk.startedAt,
      deviceId: walk.deviceId,
      ...(walk.title ? { title: walk.title } : {}),
      ...(walk.endedAt !== null ? { endedAt: walk.endedAt } : {}),
      ...(walk.stats !== null ? { stats: toConvexStats(walk.stats) } : {}),
      ...(walk.plannedRouteId ? { plannedRouteId: walk.plannedRouteId as any } : {}),
    });
    updateWalkConvexId(walkId, convexWalkId);
  }

  // Phase 1 complete: walk exists on Convex.
  updateCoreSyncStatus(opts.jobId, 'in_progress');
  updateJobPhase(opts.jobId, 2);

  // 2 – Upload remaining track points.
  // For live walks, most points were already sent by use-live-walk-sync so we
  // only upload points with synced_at IS NULL. For normal walks, upload all.
  const pointsToUpload = walk.isLive
    ? getUnsyncedPointsForWalk(walkId)
    : getPointsForWalk(walkId);

  // For non-live walks use the checkpoint offset to resume after a partial failure.
  const startOffset = walk.isLive ? 0 : opts.uploadedPointCount;
  let confirmedCount = startOffset;

  for (let i = startOffset; i < pointsToUpload.length; i += SYNC_BATCH_SIZE) {
    const batch = pointsToUpload.slice(i, i + SYNC_BATCH_SIZE);
    await convex.mutation(api.track_points.insertBatch, {
      walkId: convexWalkId as any,
      points: batch.map((p) => ({
        timestamp: p.timestamp,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracyMetres: p.accuracyMetres,
        isClean: p.isClean,
        ...(p.altitudeMetres !== null ? { altitudeMetres: p.altitudeMetres } : {}),
        ...(p.speedMps !== null ? { speedMps: p.speedMps } : {}),
      })),
    });
    confirmedCount += batch.length;
    // Persist checkpoint (non-live) / mark synced (live) after each batch.
    if (walk.isLive) {
      markPointsSynced(batch.map((p) => p.id));
    } else {
      updateJobProgress(opts.jobId, confirmedCount);
    }
  }

  // 3a – Reconciliation: verify server count matches local clean-point count.
  // This catches any gap caused by a batch that was sent but whose checkpoint
  // write failed (e.g. app killed between mutation success and SQLite write).
  const serverCount: number = await convex.query(api.track_points.countForWalk, {
    walkId: convexWalkId as any,
  });
  const localRow = db.getFirstSync<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM track_points WHERE walk_id = ? AND is_clean = 1`,
    walkId,
  );
  const localCount = localRow?.cnt ?? 0;

  if (serverCount < localCount) {
    // Re-upload the missing tail using all clean points from the offset.
    const allCleanPoints = getPointsForWalk(walkId).filter((p) => p.isClean);
    const missingPoints = allCleanPoints.slice(serverCount);
    for (let i = 0; i < missingPoints.length; i += SYNC_BATCH_SIZE) {
      const batch = missingPoints.slice(i, i + SYNC_BATCH_SIZE);
      await convex.mutation(api.track_points.insertBatch, {
        walkId: convexWalkId as any,
        points: batch.map((p) => ({
          timestamp: p.timestamp,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracyMetres: p.accuracyMetres,
          isClean: p.isClean,
          ...(p.altitudeMetres !== null ? { altitudeMetres: p.altitudeMetres } : {}),
          ...(p.speedMps !== null ? { speedMps: p.speedMps } : {}),
        })),
      });
    }
    console.log(
      `[sync] reconciliation: re-uploaded ${localCount - serverCount} missing points for walk ${walkId}`,
    );
  }

  // Phase 2 complete: all track points confirmed on Convex.
  updateJobPhase(opts.jobId, 3);

  // 3 – Upload photos (failures are non-fatal: core sync completes regardless)
  const photos = getPhotosForWalk(walkId);
  const photosToUpload = photos.filter((p) => !p.convexId);

  if (photosToUpload.length > 0) {
    updatePhotoSyncStatus(opts.jobId, 'pending');
    let successCount = 0;
    let failCount = 0;

    for (const photo of photosToUpload) {
      const localUri = photo.localAssetUri ?? photo.localUri;

      // Asset may have been deleted from the device since capture.
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (!fileInfo.exists) {
        console.warn(`[sync] photo asset not found, skipping: ${localUri}`);
        updatePhotoStatus(photo.id, 'upload_skipped');
        continue;
      }

      try {
        const uploadUrl: string = await convex.action(
          api.walk_photos.generateUploadUrl,
          {},
        );

        const uploadResult = await FileSystem.uploadAsync(uploadUrl, localUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          mimeType: 'image/jpeg',
        });

        const { storageId } = JSON.parse(uploadResult.body) as { storageId: string };

        const convexPhotoId = await convex.mutation(api.walk_photos.create, {
          walkId: convexWalkId as any,
          timestamp: photo.timestamp,
          latitude: photo.latitude,
          longitude: photo.longitude,
          storageId: storageId as any,
          ...(photo.caption ? { caption: photo.caption } : {}),
        });

        // updatePhotoAfterSync sets photo_status = 'uploaded' as well as convex_id/storage_id
        updatePhotoAfterSync(photo.id, convexPhotoId, storageId);
        successCount++;
      } catch (err) {
        console.warn(`[sync] photo upload failed for photo ${photo.id}:`, err);
        appLog('warn', 'sync', `Photo upload failed`, err, { photoId: photo.id });
        updatePhotoStatus(photo.id, 'upload_failed');
        failCount++;
      }
    }

    const photoSyncStatus: SyncJob['photoSyncStatus'] =
      failCount === 0 ? 'synced' : successCount === 0 ? 'failed' : 'partial';
    updatePhotoSyncStatus(opts.jobId, photoSyncStatus);
  }

  // Phase 4 complete: walk core data fully synced regardless of photo outcome.
  updateCoreSyncStatus(opts.jobId, 'synced');
  updateJobPhase(opts.jobId, 4);

  if (walk.status === 'completed') {
    const badgeResult = await convex.mutation(api.walks.finalizeSync, {
      walkId: convexWalkId as any,
    });
    if (badgeResult?.newlyUnlocked?.length) {
      emitBadgeUnlocks(badgeResult.newlyUnlocked);
    }
  }

  return convexWalkId;
}
