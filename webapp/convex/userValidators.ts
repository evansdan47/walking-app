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

export const badgeTierValidator = v.union(
  v.literal('bronze'),
  v.literal('silver'),
  v.literal('gold'),
  v.literal('platinum'),
);

export const badgeRuleTypeValidator = v.union(
  v.literal('walk_count'),
  v.literal('total_distance'),
  v.literal('single_walk_distance'),
  v.literal('total_elevation_gain'),
  v.literal('planned_route_count'),
  v.literal('goal_created'),
  v.literal('has_avatar'),
  v.literal('preferences_set'),
  v.literal('joined_beta'),
  v.literal('walk_on_weekend'),
  v.literal('badge_unlocked'),
  v.literal('consecutive_walk_days'),
  v.literal('weekend_both_days'),
  v.literal('active_weeks_streak'),
  v.literal('active_months_streak'),
  v.literal('total_moving_time'),
  v.literal('goals_completed'),
  v.literal('walk_photos_max_on_walk'),
  v.literal('walk_photos_total'),
  v.literal('walk_started_before_hour'),
  v.literal('walk_started_after_hour'),
  v.literal('single_walk_elevation_gain'),
  v.literal('single_walk_elevation_total'),
  v.literal('single_walk_moving_time'),
  v.literal('single_walk_duration'),
  v.literal('clean_walk_count'),
  v.literal('unique_walk_areas'),
  v.literal('unique_walk_regions'),
  v.literal('walk_has_tag'),
  v.literal('follow_sessions'),
  v.literal('planned_route_short'),
  v.literal('planned_route_long'),
  v.literal('planned_route_circular'),
  v.literal('planned_route_published'),
  v.literal('planned_route_poi_total'),
  v.literal('manual'),
);

export const badgePeriodValidator = v.union(
  v.literal('lifetime'),
  v.literal('daily'),
  v.literal('weekly'),
  v.literal('monthly'),
  v.literal('yearly'),
);

export const badgeSourceTypeValidator = v.union(
  v.literal('walk'),
  v.literal('follow_session'),
  v.literal('route'),
  v.literal('goal'),
  v.literal('manual'),
  v.literal('system'),
);

export const badgeNewShineEffectValidator = v.union(
  v.literal('soft_sweep'),
  v.literal('sharp_sweep'),
  v.literal('glossy_sweep'),
  v.literal('multi_bands'),
  v.literal('bright_flash'),
);
