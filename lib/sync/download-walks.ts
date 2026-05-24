import type { ConvexReactClient } from 'convex/react';
import { randomUUID } from 'expo-crypto';

import { api } from '@/convex/_generated/api';
import { db } from '../db/client';
import { insertDownloadedPoints } from '../db/track-points';
import { insertDownloadedWalk } from '../db/walks';
import { appLog } from '../diagnostics/logger';

export interface DownloadResult {
  /** Number of walks newly downloaded from Convex. */
  downloaded: number;
  /** Walks already present locally — skipped. */
  skipped: number;
  /** Walks that failed to download due to an error. */
  failed: number;
}

/**
 * Fetches all completed walks for the current user from Convex and inserts
 * any that are missing from the local SQLite database.
 *
 * Idempotent: already-synced walks are identified by convex_id and skipped.
 * Safe to call repeatedly — INSERT OR IGNORE prevents duplicates.
 */
export async function downloadWalksFromCloud(
  convex: ConvexReactClient,
): Promise<DownloadResult> {
  const result: DownloadResult = { downloaded: 0, skipped: 0, failed: 0 };

  // 1 — Fetch all of the user's walks from Convex.
  const cloudWalks = await convex.query(api.walks.listForCurrentUser, {});

  appLog('info', 'down-sync', `Fetched ${cloudWalks.length} walks from Convex`);

  for (const walk of cloudWalks) {
    // Only pull completed walks — in-progress walks are already on-device.
    if (walk.status !== 'completed') {
      result.skipped++;
      continue;
    }

    // 2 — Skip any walk already in local SQLite (matched by convex_id).
    const existing = db.getFirstSync<{ id: string }>(
      `SELECT id FROM walks WHERE convex_id = ?`,
      walk._id,
    );
    if (existing) {
      result.skipped++;
      continue;
    }

    try {
      const localId = randomUUID();

      // 3 — Map Convex stats shape to local WalkStats (field names differ slightly).
      const stats = walk.stats
        ? {
            distanceMetres: walk.stats.distanceMetres,
            durationSeconds: walk.stats.durationSeconds,
            movingTimeSeconds: walk.stats.movingTimeSeconds,
            stoppedTimeSeconds: walk.stats.stoppedTimeSeconds,
            pointCount: walk.stats.pointCount,
            avgPaceSecsPerKm: walk.stats.avgPaceSecsPerKm,
            elevationGainMetres: walk.stats.elevationGainMetres,
            elevationLossMetres: walk.stats.elevationLossMetres,
          }
        : null;

      insertDownloadedWalk({
        id: localId,
        convexId: walk._id,
        title: walk.title ?? null,
        status: walk.status,
        startedAt: walk.startedAt,
        endedAt: walk.endedAt ?? null,
        deviceId: walk.deviceId,
        stats,
        isLive: walk.isLive ?? false,
      });

      // 4 — Fetch and insert the clean track points for this walk.
      const points = await convex.query(api.track_points.getCleanForWalk, {
        walkId: walk._id,
      });

      if (points.length > 0) {
        insertDownloadedPoints(localId, points);
      }

      result.downloaded++;
      appLog('info', 'down-sync', 'Walk downloaded from Convex', undefined, {
        localId,
        convexId: walk._id,
        pointCount: points.length,
      });
    } catch (err) {
      result.failed++;
      appLog('error', 'down-sync', 'Failed to download walk from Convex', err, {
        convexId: walk._id,
      });
    }
  }

  return result;
}
