import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { setKv } from '@/lib/db/client';

const STORE_KEY = 'feature_flags_v1';
export const KV_GPS_MULTIPLIER = 'gps_accuracy_multiplier';

export type HapticImpactLevel = 'light' | 'medium' | 'heavy';

export interface FeatureFlags {
  allowHistoryDuringRecording: boolean;
  gpsAccuracyMultiplier: number;
  forcePedometerSteps: boolean;
  /** Radius in metres within which the user must be to start (or auto-start) a queued walk. */
  startProximityThresholdM: number;
  /** Distance (metres) at which off-route haptic pulsing begins. */
  hapticOffRouteStartM: number;
  /** Distance (metres) at which off-route haptic reaches maximum urgency (shortest interval, heaviest impact). */
  hapticOffRouteMaxM: number;
  /** Master switch — enables or disables off-route haptic feedback entirely. */
  hapticOffRouteEnabled: boolean;
  /** Impact style used when the user is at exactly the start-distance threshold. */
  hapticMinImpact: HapticImpactLevel;
  /** Impact style used when the user reaches (or exceeds) the max-distance threshold. */
  hapticMaxImpact: HapticImpactLevel;
  /** Pulse interval (ms) when barely off route (at startM). Longest/slowest rate. */
  hapticSlowIntervalMs: number;
  /** Pulse interval (ms) when far off route (at maxM). Shortest/fastest rate. */
  hapticFastIntervalMs: number;
  /** Enable haptic test mode — uses hapticTestDistanceM instead of real GPS deviation. */
  hapticTestEnabled: boolean;
  /** Mocked off-route distance (metres) used when hapticTestEnabled is true. */
  hapticTestDistanceM: number;
  /** When true, tapping a route in Explore jumps straight to the detail panel (no highlight-first step). */
  exploreDirectDetail: boolean;
}

const DEFAULTS: FeatureFlags = {
  allowHistoryDuringRecording: false,
  gpsAccuracyMultiplier: 1.0,
  forcePedometerSteps: false,
  startProximityThresholdM: 200,
  hapticOffRouteStartM: 20,
  hapticOffRouteMaxM: 75,
  hapticOffRouteEnabled: true,
  hapticMinImpact: 'light',
  hapticMaxImpact: 'heavy',
  hapticSlowIntervalMs: 2500,
  hapticFastIntervalMs: 400,
  hapticTestEnabled: false,
  hapticTestDistanceM: 40,
  exploreDirectDetail: false,
};

function mergeWithDefaults(stored: Partial<FeatureFlags>): FeatureFlags {
  return { ...DEFAULTS, ...stored };
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const merged = mergeWithDefaults(JSON.parse(raw) as Partial<FeatureFlags>);
            setFlags(merged);
            // Keep SQLite in sync so the background task always has the latest value.
            setKv(KV_GPS_MULTIPLIER, String(merged.gpsAccuracyMultiplier));
          } catch {
            // corrupt value — use defaults
          }
        } else {
          // No stored flags yet — write the default multiplier so the background task has a value.
          setKv(KV_GPS_MULTIPLIER, String(DEFAULTS.gpsAccuracyMultiplier));
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setFlag = useCallback(<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlags((prev) => {
      const next = { ...prev, [key]: value };
      void SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
      // Mirror the GPS multiplier into SQLite so the background task can read it.
      if (key === 'gpsAccuracyMultiplier') {
        setKv(KV_GPS_MULTIPLIER, String(value));
      }
      return next;
    });
  }, []);

  return { flags, loaded, setFlag };
}
