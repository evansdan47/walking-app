/**
 * useOffRouteHaptic
 *
 * Runs a self-rescheduling haptic pulse while the user is off route. Both the
 * pulse interval and the impact style are linearly interpolated between the
 * configured min/max values based on how far off route the user is:
 *
 *   t = clamp((distanceM - startM) / (maxM - startM), 0, 1)
 *
 *   interval = lerp(slowIntervalMs, fastIntervalMs, t)   — shorter = more urgent
 *   impactIdx = round(lerp(minImpactIdx, maxImpactIdx, t)) — higher = heavier
 *
 * The hook uses a ref-based config store so the in-flight timer closure always
 * reads the latest values without needing to restart the pulse loop whenever
 * the distance changes.
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';

import type { HapticImpactLevel } from '@/hooks/use-feature-flags';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPACT_STYLE: Record<HapticImpactLevel, Haptics.ImpactFeedbackStyle> = {
  light:  Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy:  Haptics.ImpactFeedbackStyle.Heavy,
};

const IMPACT_INDEX: Record<HapticImpactLevel, number> = { light: 0, medium: 1, heavy: 2 };
const INDEX_IMPACT: HapticImpactLevel[] = ['light', 'medium', 'heavy'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function computeT(distanceM: number, startM: number, maxM: number): number {
  if (maxM <= startM) return 1;
  return Math.max(0, Math.min(1, (distanceM - startM) / (maxM - startM)));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OffRouteHapticConfig {
  /** Current distance from route in metres. null = unknown/on route. */
  distanceM: number | null;
  /** Master switch. */
  enabled: boolean;
  /** Distance (m) at which pulsing begins. */
  startM: number;
  /** Distance (m) at which maximum urgency is reached. */
  maxM: number;
  /** Haptic impact style at startM (lightest). */
  minImpact: HapticImpactLevel;
  /** Haptic impact style at maxM (heaviest). */
  maxImpact: HapticImpactLevel;
  /** Pulse interval (ms) at startM — slowest rate. */
  slowIntervalMs: number;
  /** Pulse interval (ms) at maxM — fastest rate. */
  fastIntervalMs: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOffRouteHaptic(config: OffRouteHapticConfig): void {
  // Always up-to-date config readable by in-flight timer callbacks without
  // needing to reschedule whenever a value changes.
  const configRef = useRef(config);
  configRef.current = config;

  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Self-rescheduling pulse. Each call reads fresh config, fires a haptic at
  // the appropriate intensity, then schedules itself again at the appropriate
  // interval. Stops if the active flag has been cleared.
  const pulse = useCallback(() => {
    if (!activeRef.current) return;

    const cfg = configRef.current;
    const dist = cfg.distanceM;

    // Belt-and-braces: stop if conditions no longer hold.
    if (!cfg.enabled || dist === null || dist <= cfg.startM) {
      activeRef.current = false;
      return;
    }

    // Interpolation parameter.
    const t = computeT(dist, cfg.startM, cfg.maxM);

    // Impact style — lerp over discrete levels, round to nearest.
    const minIdx = IMPACT_INDEX[cfg.minImpact];
    const maxIdx = IMPACT_INDEX[cfg.maxImpact];
    const rawIdx = lerp(minIdx, maxIdx, t);
    const level  = INDEX_IMPACT[Math.round(Math.max(0, Math.min(2, rawIdx)))];
    void Haptics.impactAsync(IMPACT_STYLE[level]);

    // Interval — shorter when further off route.
    const interval = Math.round(lerp(cfg.slowIntervalMs, cfg.fastIntervalMs, t));
    timerRef.current = setTimeout(pulse, Math.max(100, interval));
  }, [clearTimer]);

  // Start/stop the pulse loop based on whether the user is currently off route.
  useEffect(() => {
    const { enabled, distanceM, startM } = config;
    const shouldPulse = enabled && distanceM !== null && distanceM > startM;

    if (shouldPulse && !activeRef.current) {
      activeRef.current = true;
      pulse();
    } else if (!shouldPulse && activeRef.current) {
      activeRef.current = false;
      clearTimer();
    }
  }, [config.enabled, config.distanceM, config.startM, pulse, clearTimer]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);
}

// ---------------------------------------------------------------------------
// Utility: fire a single test pulse at a given distance (for the settings panel)
// ---------------------------------------------------------------------------

export function fireTestPulse(config: Omit<OffRouteHapticConfig, 'enabled' | 'distanceM'> & { distanceM: number }): void {
  const { distanceM, startM, maxM, minImpact, maxImpact } = config;
  if (distanceM <= startM) {
    // Below threshold — use the lightest style as a confirmation tap.
    void Haptics.impactAsync(IMPACT_STYLE[minImpact]);
    return;
  }
  const t       = computeT(distanceM, startM, maxM);
  const minIdx  = IMPACT_INDEX[minImpact];
  const maxIdx  = IMPACT_INDEX[maxImpact];
  const rawIdx  = lerp(minIdx, maxIdx, t);
  const level   = INDEX_IMPACT[Math.round(Math.max(0, Math.min(2, rawIdx)))];
  void Haptics.impactAsync(IMPACT_STYLE[level]);
}
