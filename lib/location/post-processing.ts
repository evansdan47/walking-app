import { randomUUID } from 'expo-crypto';

import { createSyncJob } from '../db/sync-jobs';
import { getPointsForWalk, markPointsClean } from '../db/track-points';
import { getWalk, updateWalkStats, type WalkStats } from '../db/walks';
import { appLog } from '../diagnostics/logger';
import { readCaloriesForWalk } from '../health-connect/calories';
import { writeExerciseSession } from '../health-connect/exercise-session';
import { readHeartRateForWalk } from '../health-connect/heart-rate';
import { readStepsBetween } from '../health-connect/steps';
import { haversineMetres } from './haversine';
import { filterCleanPointIds } from './point-filter';

const ELEVATION_SMOOTH_WINDOW = 5;
const MIN_ALTITUDE_COVERAGE = 0.5; // 50% of clean points must have altitude

/**
 * Runs the 8-step post-processing pipeline on a completed walk.
 * Writes the resulting stats back to SQLite and creates a sync job.
 */
export async function runPostProcessing(walkId: string, stepCount?: number): Promise<void> {
  try {
    await _runPostProcessing(walkId, stepCount);
  } catch (err) {
    appLog('error', 'post-processing', 'Post-processing pipeline failed', err, { walkId });
    // Re-throw so the caller (walk stop handler) can still navigate to summary.
    throw err;
  }
}

async function _runPostProcessing(walkId: string, stepCount?: number): Promise<void> {
  const walk = getWalk(walkId);
  if (!walk) return;

  // Step 1 – Load raw points
  const rawPoints = getPointsForWalk(walkId);

  // Step 2 – Filter clean points
  const cleanIds = new Set(filterCleanPointIds(rawPoints));
  const clean = rawPoints.filter((p) => cleanIds.has(p.id));
  markPointsClean([...cleanIds]);

  if (clean.length === 0) {
    const emptyStats: WalkStats = {
      distanceMetres: 0,
      durationSeconds: walk.endedAt
        ? Math.round((walk.endedAt - walk.startedAt) / 1000)
        : 0,
      movingTimeSeconds: 0,
      stoppedTimeSeconds: 0,
      pointCount: 0,
      ...(stepCount !== undefined ? { stepCount } : {}),
    };
    updateWalkStats(walkId, emptyStats);
    createSyncJob({
      id: randomUUID(),
      walkId,
      deviceId: walk.deviceId,
    });
    return;
  }

  // Step 3 – Distance (Haversine over clean segment)
  let distanceMetres = 0;
  for (let i = 1; i < clean.length; i++) {
    distanceMetres += haversineMetres(
      clean[i - 1]!.latitude,
      clean[i - 1]!.longitude,
      clean[i]!.latitude,
      clean[i]!.longitude,
    );
  }

  // Step 4 – Time breakdown
  const durationSeconds = walk.endedAt
    ? Math.round((walk.endedAt - walk.startedAt) / 1000)
    : 0;

  // Moving time: sum of inter-point gaps ≤ 60 s (stopped = stationary)
  let movingTimeSeconds = 0;
  for (let i = 1; i < clean.length; i++) {
    const gapSec = (clean[i]!.timestamp - clean[i - 1]!.timestamp) / 1000;
    if (gapSec <= 60) movingTimeSeconds += gapSec;
  }
  const stoppedTimeSeconds = Math.max(0, durationSeconds - movingTimeSeconds);

  // Step 5 – Pace
  const avgPaceSecsPerKm =
    distanceMetres >= 100 && movingTimeSeconds > 0
      ? movingTimeSeconds / (distanceMetres / 1000)
      : undefined;

  // Step 6 – Elevation (optional, smoothed)
  let elevationGainMetres: number | undefined;
  let elevationLossMetres: number | undefined;

  const pointsWithAlt = clean.filter((p) => p.altitudeMetres !== null);
  // smoothed is hoisted here so Step 6b can access it outside the altitude guard block.
  const smoothed: number[] = [];
  if (pointsWithAlt.length / clean.length >= MIN_ALTITUDE_COVERAGE) {
    // Smooth altitudes with a sliding window average
    const alts = clean.map((p) => p.altitudeMetres ?? null);
    for (let i = 0; i < alts.length; i++) {
      const half = Math.floor(ELEVATION_SMOOTH_WINDOW / 2);
      const slice = alts.slice(
        Math.max(0, i - half),
        Math.min(alts.length, i + half + 1),
      );
      const valid = slice.filter((v): v is number => v !== null);
      if (valid.length > 0) {
        smoothed.push(valid.reduce((a, b) => a + b, 0) / valid.length);
      }
    }

    let gain = 0;
    let loss = 0;
    for (let i = 1; i < smoothed.length; i++) {
      const delta = smoothed[i]! - smoothed[i - 1]!;
      if (delta > 0) gain += delta;
      else loss += Math.abs(delta);
    }
    elevationGainMetres = Math.round(gain);
    elevationLossMetres = Math.round(loss);
  }

  // Step 6b – Elevation detail: longest ascent/descent runs + steepest gradient
  // These are only computed when we already have enough altitude data (same guard).
  let longestAscentMetres: number | undefined;
  let longestDescentMetres: number | undefined;
  let steepestAscentGradientPct: number | undefined;
  let steepestDescentGradientPct: number | undefined;

  const nSmoothed = Math.min(smoothed.length, clean.length);
  if (nSmoothed >= 2) {
    // --- Longest continuous ascent/descent run (by vertical metres) ---
    type RunDir = 'ascent' | 'descent';
    let runDir: RunDir | null = null;
    let runVertical = 0;
    let bestAscent = 0;
    let bestDescent = 0;

    for (let i = 1; i < nSmoothed; i++) {
      const delta = smoothed[i]! - smoothed[i - 1]!;
      if (Math.abs(delta) < 0.5) continue; // ignore sub-0.5 m noise
      const dir: RunDir = delta > 0 ? 'ascent' : 'descent';
      if (dir === runDir) {
        runVertical += Math.abs(delta);
      } else {
        if (runDir === 'ascent') bestAscent = Math.max(bestAscent, runVertical);
        else if (runDir === 'descent') bestDescent = Math.max(bestDescent, runVertical);
        runDir = dir;
        runVertical = Math.abs(delta);
      }
    }
    // Capture the final run
    if (runDir === 'ascent') bestAscent = Math.max(bestAscent, runVertical);
    else if (runDir === 'descent') bestDescent = Math.max(bestDescent, runVertical);

    if (bestAscent > 0) longestAscentMetres = Math.round(bestAscent);
    if (bestDescent > 0) longestDescentMetres = Math.round(bestDescent);

    // --- Steepest gradient over a 50 m horizontal sliding window ---
    // Pre-compute horizontal distances between consecutive clean points.
    const GRADIENT_WINDOW_M = 50;
    const horizDist: number[] = [0]; // horizDist[i] = dist from clean[i-1] to clean[i]
    for (let i = 1; i < nSmoothed; i++) {
      horizDist.push(haversineMetres(
        clean[i - 1]!.latitude, clean[i - 1]!.longitude,
        clean[i]!.latitude,     clean[i]!.longitude,
      ));
    }

    let maxAscentGrad = 0;
    let maxDescentGrad = 0;

    for (let start = 0; start < nSmoothed - 1; start++) {
      let cumHoriz = 0;
      for (let end = start + 1; end < nSmoothed; end++) {
        cumHoriz += horizDist[end]!;
        if (cumHoriz >= GRADIENT_WINDOW_M) {
          const vertChange = smoothed[end]! - smoothed[start]!;
          const grad = (Math.abs(vertChange) / cumHoriz) * 100;
          if (vertChange > 0) maxAscentGrad = Math.max(maxAscentGrad, grad);
          else if (vertChange < 0) maxDescentGrad = Math.max(maxDescentGrad, grad);
          break;
        }
      }
    }

    if (maxAscentGrad > 0) steepestAscentGradientPct = Math.round(maxAscentGrad * 10) / 10;
    if (maxDescentGrad > 0) steepestDescentGradientPct = Math.round(maxDescentGrad * 10) / 10;
  }

  // Step 7 – Save initial stats (without HC data — written before the async HC calls)
  const stats: WalkStats = {
    distanceMetres: Math.round(distanceMetres),
    durationSeconds,
    movingTimeSeconds: Math.round(movingTimeSeconds),
    stoppedTimeSeconds: Math.round(stoppedTimeSeconds),
    pointCount: clean.length,
    ...(avgPaceSecsPerKm !== undefined ? { avgPaceSecsPerKm } : {}),
    ...(elevationGainMetres !== undefined ? { elevationGainMetres } : {}),
    ...(elevationLossMetres !== undefined ? { elevationLossMetres } : {}),
    ...(longestAscentMetres !== undefined ? { longestAscentMetres } : {}),
    ...(steepestAscentGradientPct !== undefined ? { steepestAscentGradientPct } : {}),
    ...(longestDescentMetres !== undefined ? { longestDescentMetres } : {}),
    ...(steepestDescentGradientPct !== undefined ? { steepestDescentGradientPct } : {}),
    ...(stepCount !== undefined ? { stepCount } : {}),
  };
  updateWalkStats(walkId, stats);

  // Step 8 – Create sync job
  createSyncJob({ id: randomUUID(), walkId, deviceId: walk.deviceId });

  // Step 9 – Health Connect enrichment (best-effort, non-blocking)
  // Runs after the sync job is created so a HC failure never prevents Convex sync.
  if (walk.endedAt) {
    const [caloriesKcal, heartRate, hcSynced, hcStepCount] = await Promise.all([
      readCaloriesForWalk(walk.startedAt, walk.endedAt),
      readHeartRateForWalk(walk.startedAt, walk.endedAt),
      writeExerciseSession(
        {
          startedAt: walk.startedAt,
          endedAt: walk.endedAt,
          title: walk.title,
          distanceMetres: stats.distanceMetres,
          ...(stats.stepCount != null ? { stepCount: stats.stepCount } : {}),
        },
        clean,
      ),
      readStepsBetween(walk.startedAt, walk.endedAt),
    ]);

    const enriched: WalkStats = {
      ...stats,
      ...(caloriesKcal !== null ? { caloriesKcal } : {}),
      ...(heartRate !== null ? { avgHeartRateBpm: heartRate.avgBpm, maxHeartRateBpm: heartRate.maxBpm } : {}),
      hcSynced,
      ...(hcStepCount !== null ? { hcStepCount } : {}),
    };

    updateWalkStats(walkId, enriched);
  }
}
