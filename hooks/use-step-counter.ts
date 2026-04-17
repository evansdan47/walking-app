import { useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';

import { readStepsBetween } from '@/lib/health-connect/steps';

const POLL_INTERVAL_MS = 10_000; // HC batches ~1 min; 10 s polling is sufficient

/**
 * Returns the step count for the current walk session.
 *
 * Strategy (in priority order):
 *  1. Health Connect aggregate (Android only, accurate, batched by OS).
 *     Polled every 10 s from walkStartedAt to now.
 *  2. Pedometer fallback — used when HC is unavailable/returns null, or when
 *     `forcePedometer` is true (developer toggle for testing both paths).
 *     Accumulates steps via watchStepCount() from walk start, foreground-only.
 *
 * Returns 0 when no source is available so the display can show '--' via the
 * existing `stepCount > 0` guard in the UI.
 *
 * Polling/subscriptions stop and count resets to 0 when `active` is false.
 */
export type StepSource = 'hc' | 'pedometer' | null;

export function useStepCounter(
  active: boolean,
  walkStartedAt: number | null,
  forcePedometer = false,
): { steps: number; source: StepSource } {
  const [steps, setSteps] = useState(0);
  const [source, setSource] = useState<StepSource>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pedometerSubRef = useRef<{ remove: () => void } | null>(null);
  const pedometerAccRef = useRef(0);

  useEffect(() => {
    // ── Teardown helper ─────────────────────────────────────────────────────
    const clear = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (pedometerSubRef.current !== null) {
        pedometerSubRef.current.remove();
        pedometerSubRef.current = null;
      }
      pedometerAccRef.current = 0;
    };

    if (!active || walkStartedAt === null) {
      setSteps(0);
      setSource(null);
      clear();
      return clear;
    }

    // ── Pedometer subscription helper ────────────────────────────────────────
    const startPedometer = () => {
      pedometerAccRef.current = 0;
      setSource('pedometer');
      pedometerSubRef.current = Pedometer.watchStepCount((result) => {
        pedometerAccRef.current += result.steps;
        setSteps(pedometerAccRef.current);
      });
    };

    if (forcePedometer) {
      // Developer mode: skip HC entirely, use pedometer directly.
      startPedometer();
      return clear;
    }

    // ── Normal path: try HC, fall back to pedometer ──────────────────────────
    let usedPedometer = false;

    const tryHc = async () => {
      const count = await readStepsBetween(walkStartedAt, Date.now());
      if (count !== null) {
        if (usedPedometer && pedometerSubRef.current !== null) {
          pedometerSubRef.current.remove();
          pedometerSubRef.current = null;
          usedPedometer = false;
        }
        setSource('hc');
        setSteps(count);
      } else if (!usedPedometer) {
        // HC unavailable — start pedometer fallback.
        usedPedometer = true;
        startPedometer();
      }
      // If already on pedometer, do nothing — watchStepCount keeps updating.
    };

    void tryHc();

    intervalRef.current = setInterval(() => { void tryHc(); }, POLL_INTERVAL_MS);

    return clear;
  }, [active, walkStartedAt, forcePedometer]);

  return { steps, source };
}
