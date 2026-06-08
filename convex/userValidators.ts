import { v } from 'convex/values';

/** Distance / weight display units. */
export const distanceUnitValidator = v.union(v.literal('km'), v.literal('miles'));
export const weightUnitValidator = v.union(v.literal('kg'), v.literal('lb'));
export const elevationUnitValidator = v.union(v.literal('metres'), v.literal('feet'));

export const userPreferencesValidator = v.object({
  units: v.optional(
    v.object({
      distance: v.optional(distanceUnitValidator),
      weight: v.optional(weightUnitValidator),
      elevation: v.optional(elevationUnitValidator),
    }),
  ),
  profile: v.optional(
    v.object({
      weightKg: v.optional(v.number()),
    }),
  ),
  display: v.optional(
    v.object({
      defaultMapView: v.optional(v.union(v.literal('terrain'), v.literal('standard'))),
      showCalories: v.optional(v.boolean()),
    }),
  ),
  privacy: v.optional(
    v.object({
      defaultWalkVisibility: v.optional(v.union(v.literal('private'), v.literal('public'))),
    }),
  ),
});

/** Partial preferences for `users.updatePreferences`. */
export const preferencesPatchValidator = v.object({
  units: v.optional(
    v.object({
      distance: v.optional(distanceUnitValidator),
      weight: v.optional(weightUnitValidator),
      elevation: v.optional(elevationUnitValidator),
    }),
  ),
  profile: v.optional(
    v.object({
      weightKg: v.optional(v.number()),
    }),
  ),
  display: v.optional(
    v.object({
      defaultMapView: v.optional(v.union(v.literal('terrain'), v.literal('standard'))),
      showCalories: v.optional(v.boolean()),
    }),
  ),
  privacy: v.optional(
    v.object({
      defaultWalkVisibility: v.optional(v.union(v.literal('private'), v.literal('public'))),
    }),
  ),
});

export const subscriptionPlanValidator = v.union(
  v.literal('beta'),
  v.literal('free'),
  v.literal('plus'),
  v.literal('pro'),
);

export const subscriptionStatusValidator = v.union(
  v.literal('active'),
  v.literal('trialing'),
  v.literal('past_due'),
  v.literal('cancelled'),
);

export const userSubscriptionValidator = v.object({
  plan: subscriptionPlanValidator,
  status: subscriptionStatusValidator,
  providerCustomerId: v.optional(v.string()),
});

export const userStatsCacheValidator = v.object({
  walkCount: v.number(),
  totalDistanceMetres: v.number(),
  totalElevationGainMetres: v.number(),
  totalMovingTimeSeconds: v.number(),
  updatedAt: v.number(),
});

export const userGoalTypeValidator = v.union(
  v.literal('distance'),
  v.literal('walk_count'),
  v.literal('duration'),
  v.literal('streak'),
  v.literal('elevation'),
  v.literal('route_creation'),
);

export const userGoalStatusValidator = v.union(
  v.literal('active'),
  v.literal('completed'),
  v.literal('archived'),
);

export const userGoalUnitValidator = v.union(
  v.literal('km'),
  v.literal('walks'),
  v.literal('seconds'),
  v.literal('metres'),
  v.literal('routes'),
  v.literal('days'),
);

export const goalPeriodValidator = v.union(
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('monthly'),
  v.literal('yearly'),
  v.literal('lifetime'),
);

export const goalCategoryValidator = v.union(
  v.literal('distance'),
  v.literal('walk_count'),
  v.literal('duration'),
  v.literal('elevation'),
  v.literal('streak'),
  v.literal('route_planning'),
  v.literal('virtual_journey'),
  v.literal('climb_challenge'),
);

export const badgeCategoryValidator = v.union(
  v.literal('getting_started'),
  v.literal('distance_milestones'),
  v.literal('consistency'),
  v.literal('monthly_challenges'),
  v.literal('exploration'),
  v.literal('route_planning'),
  v.literal('recording_quality'),
  v.literal('elevation'),
  v.literal('following_routes'),
  v.literal('community_sharing'),
);

export const badgeCriteriaTypeValidator = v.union(
  v.literal('walk_count'),
  v.literal('total_distance_m'),
  v.literal('single_walk_distance_m'),
  v.literal('total_elevation_gain_m'),
  v.literal('planned_route_count'),
  v.literal('has_avatar'),
  v.literal('preferences_set'),
  v.literal('goal_created'),
  v.literal('badge_unlocked'),
  v.literal('walk_on_weekend'),
  v.literal('joined_beta'),
  v.literal('manual'),
);
