import { createContext, ReactNode, useContext } from 'react';

import { useWalkSession, WalkSessionState } from '@/hooks/use-walk-session';

export interface WalkSessionContextValue {
  state: WalkSessionState;
  pausedDurationMs: number;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

const WalkSessionContext = createContext<WalkSessionContextValue | null>(null);

export function WalkSessionProvider({ children }: { children: ReactNode }) {
  const session = useWalkSession();
  return (
    <WalkSessionContext.Provider value={session}>
      {children}
    </WalkSessionContext.Provider>
  );
}

/**
 * Returns the global walk session context.
 * Must be called within a component that is a descendant of WalkSessionProvider.
 * Throws if called outside the provider tree.
 */
export function useWalkSessionContext(): WalkSessionContextValue {
  const ctx = useContext(WalkSessionContext);
  if (!ctx) {
    throw new Error('useWalkSessionContext must be used within WalkSessionProvider');
  }
  return ctx;
}
