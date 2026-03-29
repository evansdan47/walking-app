import { useConvex } from 'convex/react';
import * as Network from 'expo-network';
import { useEffect } from 'react';

import { processPendingJobs } from '@/lib/sync/sync-manager';

/**
 * Watches network connectivity and triggers sync whenever the device
 * comes back online. Should be mounted once near the root of the app
 * (after the user is authenticated).
 */
export function useSyncTrigger() {
  const convex = useConvex();

  useEffect(() => {
    // Attempt on mount in case there are leftover jobs from a previous session
    void processPendingJobs(convex);

    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isInternetReachable) {
        void processPendingJobs(convex);
      }
    });

    return () => subscription.remove();
  }, [convex]);
}
