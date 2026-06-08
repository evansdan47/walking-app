'use client';

import { api } from '@convex/_generated/api';
import type { DistanceUnit, ElevationUnit, WeightUnit } from '@/lib/format-units';
import { useQuery } from 'convex/react';
import { createContext, useContext, useMemo } from 'react';

export type UserPreferencesState = {
  distanceUnit: DistanceUnit;
  weightUnit: WeightUnit;
  elevationUnit: ElevationUnit;
  weightKg: number | undefined;
  showCalories: boolean;
  defaultMapView: 'terrain' | 'standard';
  defaultWalkVisibility: 'private' | 'public';
  isLoading: boolean;
};

const DEFAULTS: UserPreferencesState = {
  distanceUnit: 'km',
  weightUnit: 'kg',
  elevationUnit: 'metres',
  weightKg: undefined,
  showCalories: true,
  defaultMapView: 'terrain',
  defaultWalkVisibility: 'private',
  isLoading: true,
};

const UserPreferencesContext = createContext<UserPreferencesState>(DEFAULTS);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const prefs = useQuery(api.users.getPreferences);

  const value = useMemo<UserPreferencesState>(() => {
    if (prefs === undefined) return DEFAULTS;
    if (prefs === null) {
      return { ...DEFAULTS, isLoading: false };
    }
    return {
      distanceUnit: prefs.units?.distance ?? 'km',
      weightUnit: prefs.units?.weight ?? 'kg',
      elevationUnit: prefs.units?.elevation ?? 'metres',
      weightKg: prefs.profile?.weightKg,
      showCalories: prefs.display?.showCalories ?? true,
      defaultMapView: prefs.display?.defaultMapView ?? 'terrain',
      defaultWalkVisibility: prefs.privacy?.defaultWalkVisibility ?? 'private',
      isLoading: false,
    };
  }, [prefs]);

  return (
    <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesState {
  return useContext(UserPreferencesContext);
}
