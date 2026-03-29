import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
    clearActiveWalkId,
    createWalk,
    setActiveWalkId,
    updateWalkStatus,
} from '@/lib/db/walks';
import { runPostProcessing } from '@/lib/location/post-processing';
import { useLocationTask } from './use-location-task';

export type WalkSessionPhase = 'idle' | 'recording' | 'paused' | 'completed' | 'completing';

export type WalkSessionState =
  | { phase: 'idle' }
  | { phase: 'recording'; walkId: string; startedAt: number }
  | { phase: 'paused'; walkId: string; startedAt: number; pausedAt: number }
  | { phase: 'completing'; walkId: string }
  | { phase: 'completed'; walkId: string };

export function useWalkSession() {
  const [state, setState] = useState<WalkSessionState>({ phase: 'idle' });
  const { startTracking, stopTracking } = useLocationTask();
  const router = useRouter();

  // Track total paused duration for the elapsed timer
  const pausedDurationMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);

  const start = useCallback(async () => {
    const walkId = randomUUID();
    const deviceId = `${Platform.OS}-${Platform.Version}`;
    const startedAt = Date.now();
    pausedDurationMsRef.current = 0;
    pausedAtRef.current = null;

    createWalk({ id: walkId, deviceId, startedAt });
    setActiveWalkId(walkId);
    await startTracking();

    setState({ phase: 'recording', walkId, startedAt });
  }, [startTracking]);

  const pause = useCallback(async () => {
    if (state.phase !== 'recording') return;
    const now = Date.now();
    pausedAtRef.current = now;
    await stopTracking();
    updateWalkStatus(state.walkId, 'paused');
    setState({ phase: 'paused', walkId: state.walkId, startedAt: state.startedAt, pausedAt: now });
  }, [state, stopTracking]);

  const resume = useCallback(async () => {
    if (state.phase !== 'paused') return;
    if (pausedAtRef.current !== null) {
      pausedDurationMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    await startTracking();
    updateWalkStatus(state.walkId, 'recording');
    setState({ phase: 'recording', walkId: state.walkId, startedAt: state.startedAt });
  }, [state, startTracking]);

  const stop = useCallback(async () => {
    if (state.phase !== 'recording' && state.phase !== 'paused') return;
    const { walkId } = state;

    await stopTracking();
    clearActiveWalkId();
    updateWalkStatus(walkId, 'completed', Date.now());
    setState({ phase: 'completing', walkId });

    // Post-processing is async — when done, navigate to review
    void runPostProcessing(walkId).then(() => {
      setState({ phase: 'completed', walkId });
      router.push({ pathname: '/walk-review', params: { walkId } });
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
