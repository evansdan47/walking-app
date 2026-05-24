import { appLog } from '@/lib/diagnostics/logger';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import {
    clearActiveWalkId,
    createWalk,
    deleteWalk,
    getActiveWalkId,
    getWalk,
    setActiveWalkId,
    updateWalkStatus,
} from '@/lib/db/walks';
import { runPostProcessing } from '@/lib/location/post-processing';
import { useLocationTask } from './use-location-task';

export type WalkSessionPhase = 'idle' | 'recording' | 'paused' | 'completed' | 'completing';

export type WalkSessionState =
  | { phase: 'idle' }
  | { phase: 'recording'; walkId: string; startedAt: number; isLive: boolean }
  | { phase: 'paused'; walkId: string; startedAt: number; pausedAt: number; isLive: boolean }
  | { phase: 'completing'; walkId: string }
  | { phase: 'completed'; walkId: string };

/**
 * Reads SQLite synchronously to determine the initial session state.
 * Used as the lazy initialiser for useState so the UI starts in the correct
 * phase immediately — without a flicker from idle → recording.
 * Wrapped in try/catch so a corrupted DB row never crashes the app on launch.
 */
function resolveInitialState(): WalkSessionState {
  try {
    const walkId = getActiveWalkId();
    if (!walkId) return { phase: 'idle' };

    const walk = getWalk(walkId);
    if (!walk || walk.status === 'completed') {
      // Stale pointer (walk was already completed). Clean up.
      clearActiveWalkId();
      return { phase: 'idle' };
    }

    if (walk.status === 'recording') {
      return { phase: 'recording', walkId: walk.id, startedAt: walk.startedAt, isLive: walk.isLive };
    }
    if (walk.status === 'paused') {
      return { phase: 'paused', walkId: walk.id, startedAt: walk.startedAt, pausedAt: Date.now(), isLive: walk.isLive };
    }
  } catch (e) {
    // Something is wrong with the DB or walk data — clear the stale pointer
    // and fall through to idle so the app doesn't crash-loop on every load.
    console.error('[resolveInitialState] error recovering session, resetting:', e);
    appLog('error', 'session', 'Session state recovery failed — reset to idle', e);
    try { clearActiveWalkId(); } catch {}
  }
  return { phase: 'idle' };
}

export function useWalkSession() {
  // Lazy initialiser: on mount, check SQLite for an interrupted session so
  // that if the OS killed the process while recording, we resume automatically.
  const [state, setState] = useState<WalkSessionState>(resolveInitialState);
  const { startTracking, stopTracking } = useLocationTask();
  const router = useRouter();

  // Keep a ref so the recovery effect below can call startTracking without
  // it appearing in the dependency array (intentional one-shot effect).
  const startTrackingRef = useRef(startTracking);
  useEffect(() => { startTrackingRef.current = startTracking; });

  // Track total paused duration for the elapsed timer
  const pausedDurationMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);

  // If we recovered a recording session from SQLite, re-attach the foreground
  // location service. This fires once on mount only.
  // Wrapped in try/catch: if the location service fails to start (permissions
  // revoked, service misconfigured, etc.), we reset to idle rather than
  // crashing on every subsequent app load.
  useEffect(() => {
    if (state.phase === 'recording') {
      startTrackingRef.current().catch((err: unknown) => {
        console.error('[useWalkSession] recovery startTracking failed, resetting to idle:', err);
        appLog('error', 'session', 'Location service restart on recovery failed — reset to idle', err);
        try { clearActiveWalkId(); } catch {}
        setState({ phase: 'idle' });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async (options?: { isLive?: boolean }) => {
    const walkId = randomUUID();
    const deviceId = `${Platform.OS}-${Platform.Version}`;
    const startedAt = Date.now();
    const isLive = options?.isLive ?? false;
    pausedDurationMsRef.current = 0;
    pausedAtRef.current = null;

    createWalk({ id: walkId, deviceId, startedAt, isLive });
    setActiveWalkId(walkId);
    try {
      await startTracking();
    } catch (err) {
      // GPS failed to start — clean up so we don't leave a ghost walk in the DB
      // or a stale activeWalkId that would cause a crash-loop on the next load.
      appLog('error', 'session', 'startTracking failed — rolling back walk creation', err, { walkId });
      try { clearActiveWalkId(); } catch {}
      try { deleteWalk(walkId); } catch {}
      setState({ phase: 'idle' });
      Alert.alert(
        'Could not start recording',
        'Failed to start the GPS location service. Please check that location permission is granted and try again.',
      );
      return;
    }

    setState({ phase: 'recording', walkId, startedAt, isLive });
    appLog('info', 'session', 'Walk started', undefined, { walkId, isLive });
  }, [startTracking]);

  const pause = useCallback(async () => {
    if (state.phase !== 'recording') return;
    const now = Date.now();
    pausedAtRef.current = now;
    await stopTracking();
    updateWalkStatus(state.walkId, 'paused');
    setState({ phase: 'paused', walkId: state.walkId, startedAt: state.startedAt, pausedAt: now, isLive: state.isLive });
  }, [state, stopTracking]);

  const resume = useCallback(async () => {
    if (state.phase !== 'paused') return;
    if (pausedAtRef.current !== null) {
      pausedDurationMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    await startTracking();
    updateWalkStatus(state.walkId, 'recording');
    setState({ phase: 'recording', walkId: state.walkId, startedAt: state.startedAt, isLive: state.isLive });
  }, [state, startTracking]);

  const stop = useCallback(async (stepCount?: number) => {
    if (state.phase !== 'recording' && state.phase !== 'paused') return;
    const { walkId } = state;

    await stopTracking();
    clearActiveWalkId();
    updateWalkStatus(walkId, 'completed', Date.now());
    setState({ phase: 'completing', walkId });
    appLog('info', 'session', 'Walk stopped — running post-processing', undefined, { walkId });

    // Post-processing is async — when done, navigate to review
    void runPostProcessing(walkId, stepCount).then(() => {
      setState({ phase: 'completed', walkId });
      router.push({ pathname: '/walk-summary', params: { walkId } });
    });
  }, [state, stopTracking, router]);

  const reset = useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  return {
    state,
    pausedDurationMs: pausedDurationMsRef.current,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
