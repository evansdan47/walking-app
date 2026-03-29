import * as FileSystem from 'expo-file-system/legacy';

import { api } from '@/convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';
import { getPointsForWalk } from '../db/track-points';
import { getPhotosForWalk, updatePhotoAfterSync } from '../db/walk-photos';
import type { WalkStats } from '../db/walks';
import { getWalk, updateWalkConvexId } from '../db/walks';

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

const BATCH_SIZE = 500;

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

/**
 * Uploads a single completed walk (and all its track points / photos) to Convex.
 * Returns the Convex walk ID on success.
 */
export async function uploadWalk(
  walkId: string,
  convex: ConvexReactClient,
): Promise<string> {
  const walk = getWalk(walkId);
  if (!walk) throw new Error(`Walk ${walkId} not found in SQLite`);

  // 1 – Create the walk document on the server
  const convexWalkId = await convex.mutation(api.walks.create, {
    status: walk.status,
    startedAt: walk.startedAt,
    deviceId: walk.deviceId,
    ...(walk.title ? { title: walk.title } : {}),
    ...(walk.endedAt !== null ? { endedAt: walk.endedAt } : {}),
    ...(walk.stats !== null ? { stats: toConvexStats(walk.stats) } : {}),
  });

  // Update local record so we can skip re-sync on retry
  updateWalkConvexId(walkId, convexWalkId);

  // 2 – Upload track points in batches
  const points = getPointsForWalk(walkId);
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await convex.mutation(api.track_points.insertBatch, {
      walkId: convexWalkId,
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

  // 3 – Upload photos
  const photos = getPhotosForWalk(walkId);
  for (const photo of photos) {
    if (photo.convexId) continue; // already uploaded

    const uploadUrl: string = await convex.action(
      api.walk_photos.generateUploadUrl,
      {},
    );

    const uploadResult = await FileSystem.uploadAsync(uploadUrl, photo.localUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      mimeType: 'image/jpeg',
    });

    const { storageId } = JSON.parse(uploadResult.body) as { storageId: string };

    const convexPhotoId = await convex.mutation(api.walk_photos.create, {
      walkId: convexWalkId,
      timestamp: photo.timestamp,
      latitude: photo.latitude,
      longitude: photo.longitude,
      storageId: storageId as any,
      ...(photo.caption ? { caption: photo.caption } : {}),
    });

    updatePhotoAfterSync(photo.id, convexPhotoId, storageId);
  }

  return convexWalkId;
}
