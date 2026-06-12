import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

import { useDisplayPreferences } from '@/hooks/use-display-preferences';

const DEVICE_STORE_KEY = 'user_device_preferences_v1';
const LEGACY_STORE_KEY = 'user_preferences_v1';

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

type DevicePreferences = {
  statPanelOrder: string[] | null;
};

const DEVICE_DEFAULTS: DevicePreferences = {
  statPanelOrder: null,
};

function mergeDevicePrefs(stored: Partial<DevicePreferences>): DevicePreferences {
  return { ...DEVICE_DEFAULTS, ...stored };
}

export function useUserPreferences() {
  const { loaded: displayLoaded, preferences: display, updatePreferences } = useDisplayPreferences();
  const [devicePrefs, setDevicePrefs] = useState<DevicePreferences>(DEVICE_DEFAULTS);
  const [localLoaded, setLocalLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      let raw = await SecureStore.getItemAsync(DEVICE_STORE_KEY);
      if (!raw) {
        const legacy = await SecureStore.getItemAsync(LEGACY_STORE_KEY);
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy) as Partial<UserPreferences>;
            const deviceOnly = mergeDevicePrefs({ statPanelOrder: parsed.statPanelOrder ?? null });
            setDevicePrefs(deviceOnly);
            await SecureStore.setItemAsync(DEVICE_STORE_KEY, JSON.stringify(deviceOnly));
          } catch {
            // corrupt legacy value
          }
        }
      } else {
        try {
          setDevicePrefs(mergeDevicePrefs(JSON.parse(raw) as Partial<DevicePreferences>));
        } catch {
          // corrupt value
        }
      }
      setLocalLoaded(true);
    })();
  }, []);

  const setPreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      if (key === 'statPanelOrder') {
        setDevicePrefs((prev) => {
          const next = { ...prev, statPanelOrder: value as string[] | null };
          void SecureStore.setItemAsync(DEVICE_STORE_KEY, JSON.stringify(next));
          return next;
        });
        return;
      }

      if (key === 'preferMiles') {
        void updatePreferences({
          preferences: { units: { distance: value ? 'miles' : 'km' } },
        });
        return;
      }

      if (key === 'bodyWeightKg') {
        const kg = value as number | null;
        void updatePreferences({
          preferences: kg != null ? { profile: { weightKg: kg } } : {},
        });
      }
    },
    [updatePreferences],
  );

  const preferences: UserPreferences = {
    preferMiles: display.distanceUnit === 'miles',
    bodyWeightKg: display.bodyWeightKg,
    statPanelOrder: devicePrefs.statPanelOrder,
  };

  return { preferences, loaded: displayLoaded && localLoaded, setPreference };
}
