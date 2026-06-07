import { api } from '@/convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';

import { getWalk, updateWalkConvexId, type WalkStats } from '../db/walks';
import { getPendingJobForWalk } from '../db/sync-jobs';
import { uploadWalk } from './upload-walk';

function toConvexStats(s: WalkStats) {
  return {
    distanceMetres: s.distanceMetres,
    durationSeconds: s.durationSeconds,
    movingTimeSeconds: s.movingTimeSeconds,
    stoppedTimeSeconds: s.stoppedTimeSeconds,
    pointCount: s.pointCount,
    ...(s.avgPaceSecsPerKm !== undefined ? { avgPaceSecsPerKm: s.avgPaceSecsPerKm } : {}),
    ...(s.elevationGainMetres !== undefined ? { elevationGainMetres: s.elevationGainMetres } : {}),
    ...(s.elevationLossMetres !== undefined ? { elevationLossMetres: s.elevationLossMetres } : {}),
  };
}

/**
 * Ensures a completed local walk exists on Convex (minimal create if not yet synced).
 * Used before the post-walk tagging prompt.
 */
export async function ensureWalkOnConvex(
  walkId: string,
  convex: ConvexReactClient,
): Promise<string> {
  const walk = getWalk(walkId);
  if (!walk) throw new Error('Walk not found');
  if (walk.convexId) return walk.convexId;

  const pendingJob = getPendingJobForWalk(walkId);
  if (pendingJob) {
    await uploadWalk(walkId, convex, {
      jobId: pendingJob.id,
      uploadedPointCount: pendingJob.uploadedPointCount,
    });
    const updated = getWalk(walkId);
    if (!updated?.convexId) throw new Error('Upload did not set convexId');
    return updated.convexId;
  }

  const convexWalkId = await convex.mutation(api.walks.create, {
    status: 'completed',
    startedAt: walk.startedAt,
    deviceId: walk.deviceId,
    endedAt: walk.endedAt ?? Date.now(),
    ...(walk.title ? { title: walk.title } : {}),
    ...(walk.stats ? { stats: toConvexStats(walk.stats) } : {}),
    ...(walk.plannedRouteId ? { plannedRouteId: walk.plannedRouteId as any } : {}),
  });

  updateWalkConvexId(walkId, convexWalkId);
  return convexWalkId;
}
