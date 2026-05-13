import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const STORE_KEY = 'user_preferences_v1';

export const DEFAULT_STAT_PANEL_ORDER = [
  'distance',
  'pace',
  'steps',
  'elevGain',
  'elevLoss',
  'altitude',
  'speed',
  'calories',
  'elevation',
] as const;

export interface UserPreferences {
  preferMiles: boolean;
  bodyWeightKg: number | null;
  /** Ordered list of recording stat panel keys. null = use default order. */
  statPanelOrder: string[] | null;
}

const DEFAULTS: UserPreferences = {
  preferMiles: false,
  bodyWeightKg: null,
  statPanelOrder: null,
};

function mergeWithDefaults(stored: Partial<UserPreferences>): UserPreferences {
  return { ...DEFAULTS, ...stored };
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setPreferences(mergeWithDefaults(JSON.parse(raw) as Partial<UserPreferences>));
          } catch {
            // corrupt value — use defaults
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        void SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  return { preferences, loaded, setPreference };
}
