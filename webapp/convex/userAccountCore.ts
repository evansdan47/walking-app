import type { Doc } from './_generated/dataModel';

type UserSubscription = NonNullable<Doc<'users'>['subscription']>;

export const DEFAULT_SUBSCRIPTION: UserSubscription = {
  plan: 'beta',
  status: 'active',
};

export const DEFAULT_PREFERENCES: NonNullable<Doc<'users'>['preferences']> = {
  units: {
    distance: 'km',
    weight: 'kg',
    elevation: 'metres',
  },
};

/** Merge legacy `weightKg` with `preferences.profile.weightKg`. */
export function resolveUserPreferences(
  user: Pick<Doc<'users'>, 'preferences' | 'weightKg'>,
): NonNullable<Doc<'users'>['preferences']> {
  const base = user.preferences ?? DEFAULT_PREFERENCES;
  const weightKg =
    base.profile?.weightKg ?? user.weightKg ?? undefined;

  return {
    ...base,
    units: {
      distance: base.units?.distance ?? 'km',
      weight: base.units?.weight ?? 'kg',
      elevation: base.units?.elevation ?? 'metres',
    },
    ...(weightKg !== undefined
      ? { profile: { ...base.profile, weightKg } }
      : base.profile !== undefined
        ? { profile: base.profile }
        : {}),
    ...(base.display !== undefined ? { display: base.display } : {}),
    ...(base.privacy !== undefined ? { privacy: base.privacy } : {}),
  };
}

export function resolveUserSubscription(
  user: Pick<Doc<'users'>, 'subscription'>,
): UserSubscription {
  if (user.subscription) return user.subscription;
  return DEFAULT_SUBSCRIPTION;
}

export type PreferencesPatch = {
  units?: {
    distance?: 'km' | 'miles';
    weight?: 'kg' | 'lb';
    elevation?: 'metres' | 'feet';
  };
  profile?: {
    weightKg?: number;
  };
  display?: {
    defaultMapView?: 'terrain' | 'standard';
    showCalories?: boolean;
  };
  privacy?: {
    defaultWalkVisibility?: 'private' | 'public';
  };
};

/** Deep-merge a partial preferences patch onto resolved preferences. */
export function mergeUserPreferences(
  current: NonNullable<Doc<'users'>['preferences']>,
  patch: PreferencesPatch,
): NonNullable<Doc<'users'>['preferences']> {
  const units = {
    distance: patch.units?.distance ?? current.units?.distance ?? 'km',
    weight: patch.units?.weight ?? current.units?.weight ?? 'kg',
    elevation: patch.units?.elevation ?? current.units?.elevation ?? 'metres',
  };

  const profile =
    patch.profile !== undefined || current.profile !== undefined
      ? { ...current.profile, ...patch.profile }
      : undefined;

  const display =
    patch.display !== undefined || current.display !== undefined
      ? { ...current.display, ...patch.display }
      : undefined;

  const privacy =
    patch.privacy !== undefined || current.privacy !== undefined
      ? { ...current.privacy, ...patch.privacy }
      : undefined;

  return {
    units,
    ...(profile !== undefined ? { profile } : {}),
    ...(display !== undefined ? { display } : {}),
    ...(privacy !== undefined ? { privacy } : {}),
  };
}

export type LifetimeStats = {
  walkCount: number;
  totalDistanceMetres: number;
  totalElevationGainMetres: number;
  totalMovingTimeSeconds: number;
};

export const EMPTY_LIFETIME_STATS: LifetimeStats = {
  walkCount: 0,
  totalDistanceMetres: 0,
  totalElevationGainMetres: 0,
  totalMovingTimeSeconds: 0,
};

type WalkStatsSlice = {
  stats?: {
    distanceMetres: number;
    movingTimeSeconds: number;
    elevationGainMetres?: number;
  };
};

/** Sum lifetime metrics from completed walks (stats fields optional per walk). */
export function aggregateLifetimeStats(walks: WalkStatsSlice[]): LifetimeStats {
  let walkCount = 0;
  let totalDistanceMetres = 0;
  let totalElevationGainMetres = 0;
  let totalMovingTimeSeconds = 0;

  for (const walk of walks) {
    walkCount += 1;
    const stats = walk.stats;
    if (!stats) continue;
    totalDistanceMetres += stats.distanceMetres;
    totalMovingTimeSeconds += stats.movingTimeSeconds;
    totalElevationGainMetres += stats.elevationGainMetres ?? 0;
  }

  return {
    walkCount,
    totalDistanceMetres,
    totalElevationGainMetres,
    totalMovingTimeSeconds,
  };
}
