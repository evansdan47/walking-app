import { useConvex } from 'convex/react';
import * as Network from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { processPendingJobs } from '@/lib/sync/sync-manager';
import { SYNC_RETRY_INTERVAL_MS } from '@/lib/sync/sync-config';

/**
 * Watches network connectivity and triggers sync whenever the device
 * comes back online. Also runs a periodic timer (SYNC_RETRY_INTERVAL_MS)
 * to retry failed jobs while the app is in the foreground. The timer is
 * paused when the app moves to the background to avoid Android wakelocks.
 *
 * [HOOK] For in-walk real-time streaming, reduce the interval when an
 * isLive walk is active (future feature). The timer could be shortened
 * here based on WalkSessionContext state.
 */
export function useSyncTrigger() {
  const convex = useConvex();

  useEffect(() => {
    // Attempt on mount in case there are leftover jobs from a previous session.
    void processPendingJobs(convex);

    // --- Network-state listener ---
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isInternetReachable) {
        void processPendingJobs(convex);
      }
    });

    // --- Periodic retry timer (foreground only) ---
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (retryTimer !== null) return; // already running
      retryTimer = setInterval(() => {
        void processPendingJobs(convex);
      }, SYNC_RETRY_INTERVAL_MS);
    };

    const stopTimer = () => {
      if (retryTimer !== null) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    };

    // Start immediately (app is active at mount time).
    startTimer();

    // Pause timer while backgrounded so we don't hold wakelocks.
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // App returned to foreground — fire immediately then restart the timer.
        void processPendingJobs(convex);
        startTimer();
      } else {
        stopTimer();
      }
    });

    return () => {
      networkSubscription.remove();
      appStateSubscription.remove();
      stopTimer();
    };
  }, [convex]);
}
