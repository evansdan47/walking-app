import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { setKv } from '@/lib/db/client';

const STORE_KEY = 'feature_flags_v1';
export const KV_GPS_MULTIPLIER = 'gps_accuracy_multiplier';

export interface FeatureFlags {
  allowHistoryDuringRecording: boolean;
  gpsAccuracyMultiplier: number;
  forcePedometerSteps: boolean;
}

const DEFAULTS: FeatureFlags = {
  allowHistoryDuringRecording: false,
  gpsAccuracyMultiplier: 1.0,
  forcePedometerSteps: false,
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
