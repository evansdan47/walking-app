'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { DEFAULT_ACTIVITY, type ActivityType } from '@/lib/activity-pace';

const STORAGE_KEY = 'ramble:pace';

interface PaceContextValue {
  pace: ActivityType;
  setPace: (type: ActivityType) => void;
}

const PaceContext = createContext<PaceContextValue>({
  pace: DEFAULT_ACTIVITY,
  setPace: () => {},
});

export function PaceProvider({ children }: { children: React.ReactNode }) {
  const [pace, setPaceState] = useState<ActivityType>(DEFAULT_ACTIVITY);

  // Rehydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ActivityType | null;
      if (stored) setPaceState(stored);
    } catch {
      // localStorage unavailable (private browsing, etc.) — silently ignore
    }
  }, []);

  function setPace(type: ActivityType) {
    setPaceState(type);
    try {
      localStorage.setItem(STORAGE_KEY, type);
    } catch {
      // Ignore write failures
    }
  }

  return (
    <PaceContext.Provider value={{ pace, setPace }}>
      {children}
    </PaceContext.Provider>
  );
}

export function usePace() {
  return useContext(PaceContext);
}
