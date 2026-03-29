import type { ConvexReactClient } from 'convex/react';
import * as Network from 'expo-network';

import { getPendingJobs, updateJobStatus } from '../db/sync-jobs';
import { uploadWalk } from './upload-walk';

let _isRunning = false;

/**
 * Processes all pending sync jobs sequentially.
 * Safe to call at any time — re-entrant calls are ignored.
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
        await uploadWalk(job.walkId, convex);
        updateJobStatus(job.id, 'completed');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateJobStatus(job.id, 'failed', message);
      }
    }
  } finally {
    _isRunning = false;
  }
}
