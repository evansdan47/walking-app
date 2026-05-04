import type { ConvexReactClient } from 'convex/react';
import * as Network from 'expo-network';

import { getPendingJobs, updateJobStatus } from '../db/sync-jobs';
import { MAX_SYNC_RETRIES } from './sync-config';
import { uploadWalk } from './upload-walk';

let _isRunning = false;

/**
 * Processes all pending sync jobs sequentially.
 * Safe to call at any time — re-entrant calls are ignored.
 *
 * Jobs that have been retried MAX_SYNC_RETRIES times are permanently marked
 * as failed and will not be re-queued. All others are retried with exponential
 * backoff (next_attempt_at is set by updateJobStatus).
 */
export async function processPendingJobs(convex: ConvexReactClient): Promise<void> {
  if (_isRunning) return;

  const network = await Network.getNetworkStateAsync();
  if (!network.isInternetReachable) return;

  _isRunning = true;
  try {
    const jobs = getPendingJobs();
    for (const job of jobs) {
      updateJobStatus(job.id, 'in_progress');
      try {
        await uploadWalk(job.walkId, convex, {
          jobId: job.id,
          uploadedPointCount: job.uploadedPointCount,
        });
        updateJobStatus(job.id, 'completed');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (job.attemptCount + 1 >= MAX_SYNC_RETRIES) {
          // Exhausted retries — mark permanently failed so it stops being queued.
          updateJobStatus(job.id, 'failed', `[exhausted] ${message}`);
        } else {
          updateJobStatus(job.id, 'failed', message);
        }
      }
    }
  } finally {
    _isRunning = false;
  }
}
