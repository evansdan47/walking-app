import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import type { PlannedRoute } from '@/components/explore/explore-map-layer';

const STORE_KEY = 'queued_walk_v1';

interface QueuedWalkContextValue {
  queuedWalk: PlannedRoute | null;
  setQueuedWalk: (route: PlannedRoute) => void;
  clearQueuedWalk: () => void;
}

const QueuedWalkContext = createContext<QueuedWalkContextValue | null>(null);

export function QueuedWalkProvider({ children }: { children: ReactNode }) {
  const [queuedWalk, setQueuedWalkState] = useState<PlannedRoute | null>(null);

  // Load persisted queued walk on mount.
  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setQueuedWalkState(JSON.parse(raw) as PlannedRoute);
          } catch {
            // corrupt — ignore
          }
        }
      })
      .catch(() => {});
  }, []);

  const setQueuedWalk = useCallback((route: PlannedRoute) => {
    setQueuedWalkState(route);
    void SecureStore.setItemAsync(STORE_KEY, JSON.stringify(route));
  }, []);

  const clearQueuedWalk = useCallback(() => {
    setQueuedWalkState(null);
    void SecureStore.deleteItemAsync(STORE_KEY);
  }, []);

  return (
    <QueuedWalkContext.Provider value={{ queuedWalk, setQueuedWalk, clearQueuedWalk }}>
      {children}
    </QueuedWalkContext.Provider>
  );
}

export function useQueuedWalk(): QueuedWalkContextValue {
  const ctx = useContext(QueuedWalkContext);
  if (!ctx) {
    throw new Error('useQueuedWalk must be used within QueuedWalkProvider');
  }
  return ctx;
}
