import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const STORE_KEY = 'feature_flags_v1';

export interface FeatureFlags {
  allowHistoryDuringRecording: boolean;
}

const DEFAULTS: FeatureFlags = {
  allowHistoryDuringRecording: false,
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
            setFlags(mergeWithDefaults(JSON.parse(raw) as Partial<FeatureFlags>));
          } catch {
            // corrupt value — use defaults
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setFlag = useCallback(<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => {
    setFlags((prev) => {
      const next = { ...prev, [key]: value };
      void SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { flags, loaded, setFlag };
}
