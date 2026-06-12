import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';

import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
type PreferencesPatch = {
  units?: { distance?: DistanceUnit; weight?: WeightUnit; elevation?: ElevationUnit };
  profile?: { weightKg?: number };
};
import type { DistanceUnit, ElevationUnit, WeightUnit } from '@/lib/format-units';

const MIGRATION_KEY = 'display_prefs_migrated_v1';
const LEGACY_STORE_KEY = 'user_preferences_v1';

export type DisplayPreferences = {
  distanceUnit: DistanceUnit;
  elevationUnit: ElevationUnit;
  weightUnit: WeightUnit;
  bodyWeightKg: number | null;
  showCalories: boolean;
  defaultMapView: 'terrain' | 'standard';
  defaultWalkVisibility: 'private' | 'public';
};

const DEFAULTS: DisplayPreferences = {
  distanceUnit: 'km',
  elevationUnit: 'metres',
  weightUnit: 'kg',
  bodyWeightKg: null,
  showCalories: true,
  defaultMapView: 'terrain',
  defaultWalkVisibility: 'private',
};

export function useDisplayPreferences() {
  const convexPrefs = useAppQuery(api.users.getPreferences);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const migrationStarted = useRef(false);

  useEffect(() => {
    if (!convexPrefs || migrationStarted.current) return;
    migrationStarted.current = true;

    void (async () => {
      const migrated = await SecureStore.getItemAsync(MIGRATION_KEY);
      if (migrated === '1') return;

      const raw = await SecureStore.getItemAsync(LEGACY_STORE_KEY);
      if (!raw) {
        await SecureStore.setItemAsync(MIGRATION_KEY, '1');
        return;
      }

      try {
        const legacy = JSON.parse(raw) as {
          preferMiles?: boolean;
          bodyWeightKg?: number | null;
        };
        const patch: PreferencesPatch = {};
        const hasConvexWeight = convexPrefs.profile?.weightKg !== undefined;
        const convexDistance = convexPrefs.units?.distance ?? 'km';

        if (legacy.preferMiles && convexDistance === 'km') {
          patch.units = { ...patch.units, distance: 'miles' };
        }
        if (legacy.bodyWeightKg != null && !hasConvexWeight) {
          patch.profile = { weightKg: legacy.bodyWeightKg };
        }

        if (Object.keys(patch).length > 0) {
          await updatePreferences({ preferences: patch });
        }
      } catch {
        // corrupt legacy store — skip migration
      }

      await SecureStore.setItemAsync(MIGRATION_KEY, '1');
    })();
  }, [convexPrefs, updatePreferences]);

  const loaded = convexPrefs !== undefined;

  const preferences: DisplayPreferences = convexPrefs
    ? {
        distanceUnit: convexPrefs.units?.distance ?? 'km',
        elevationUnit: convexPrefs.units?.elevation ?? 'metres',
        weightUnit: convexPrefs.units?.weight ?? 'kg',
        bodyWeightKg: convexPrefs.profile?.weightKg ?? null,
        showCalories: convexPrefs.display?.showCalories ?? true,
        defaultMapView: convexPrefs.display?.defaultMapView ?? 'terrain',
        defaultWalkVisibility: convexPrefs.privacy?.defaultWalkVisibility ?? 'private',
      }
    : DEFAULTS; // null = signed out; undefined = still loading (screen shows spinner)

  return { loaded, preferences, updatePreferences };
}
