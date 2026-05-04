import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getUnsyncedPointsForWalk, markPointsSynced } from '@/lib/db/track-points';
import { getWalk, updateWalkConvexId } from '@/lib/db/walks';
import { LIVE_SYNC_INTERVAL_MS, SYNC_BATCH_SIZE } from '@/lib/sync/sync-config';
import { useConvex } from 'convex/react';
import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useWalkSessionContext } from '@/contexts/walk-session-context';

/**
 * Provides real-time dual-write for Live Broadcast walks.
 *
 * When the active walk has isLive=true, this hook fires every
 * LIVE_SYNC_INTERVAL_MS (default 15 s) while the app is foregrounded.
 * Each tick:
 *   1. Checks network availability — skips if offline.
 *   2. Ensures a Convex walk document exists (creates it if the device was
 *      offline when the walk started).
 *   3. Reads all track_points with synced_at IS NULL from SQLite.
 *   4. Batch-uploads them to Convex via track_points.insertBatch.
 *   5. Marks them synced locally.
 *
 * Failures are logged and silently swallowed — SQLite holds all data and the
 * next tick will retry the gap. The post-walk sync job (use-sync-trigger) acts
 * as a final safety net, uploading any remaining unsynced points after
 * the walk completes.
 *
 * Mount this hook once inside the authenticated tab area (MapScreen).
 */
export function useLiveWalkSync() {
  const { state } = useWalkSessionContext();
  const convex = useConvex();

  // Keep a stable ref to the current walk state so the interval callback
  // always sees the latest value without needing to be recreated.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const flush = async () => {
      const current = stateRef.current;

      // Only run during an active live walk.
      if (
        (current.phase !== 'recording' && current.phase !== 'paused') ||
        !current.isLive
      ) return;

      const { walkId } = current;

      // Check connectivity.
      const network = await Network.getNetworkStateAsync();
      if (!network.isInternetReachable) return;

      try {
        // Ensure the walk exists on Convex (may be missing if device was
        // offline when the walk started).
        const walk = getWalk(walkId);
        if (!walk) return;

        let convexWalkId: Id<'walks'>;

        if (!walk.convexId) {
          // First time we're online — create the walk document.
          convexWalkId = await convex.mutation(api.walks.create, {
            status: 'recording',
            startedAt: walk.startedAt,
            deviceId: walk.deviceId,
            isLive: true,
            ...(walk.title ? { title: walk.title } : {}),
          });
          updateWalkConvexId(walkId, convexWalkId);
        } else {
          convexWalkId = walk.convexId as Id<'walks'>;
        }

        // Fetch all unsynced points and upload in batches.
        const unsynced = getUnsyncedPointsForWalk(walkId);
        if (unsynced.length === 0) return;

        for (let i = 0; i < unsynced.length; i += SYNC_BATCH_SIZE) {
          const batch = unsynced.slice(i, i + SYNC_BATCH_SIZE);
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
          markPointsSynced(batch.map((p) => p.id));
        }
      } catch (err) {
        // Non-fatal — next tick will pick up the gap.
        console.warn('[live-sync] flush failed, will retry:', err instanceof Error ? err.message : err);
      }
    };

    const startTimer = () => {
      if (timer !== null) return;
      timer = setInterval(() => { void flush(); }, LIVE_SYNC_INTERVAL_MS);
    };

    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    // Start immediately if foregrounded.
    startTimer();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void flush(); // catch up immediately on return
        startTimer();
      } else {
        stopTimer();
      }
    });

    return () => {
      stopTimer();
      appStateSub.remove();
    };
  }, [convex]); // convex is stable; stateRef is used inside flush to avoid recreating
}
