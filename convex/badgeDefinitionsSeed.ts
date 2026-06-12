import type { Doc } from './_generated/dataModel';
import type { BadgeRuleType } from './badgeRuleValidators';

type BadgeSeedV2 = {
  key: string;
  categoryKey: string;
  name: string;
  description: string;
  lockedDescription?: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  ruleType: BadgeRuleType;
  ruleConfig: Record<string, unknown>;
  displayOrder: number;
  isActive: boolean;
  isHiddenUntilUnlocked?: boolean;
  startsAt?: number;
  endsAt?: number;
};

function tierForOrder(order: number): BadgeSeedV2['tier'] {
  if (order <= 3) return 'bronze';
  if (order <= 6) return 'silver';
  if (order <= 8) return 'gold';
  return 'platinum';
}

function b(
  key: string,
  categoryKey: string,
  name: string,
  description: string,
  icon: string,
  displayOrder: number,
  ruleType: BadgeRuleType,
  ruleConfig: Record<string, unknown>,
  opts?: {
    lockedDescription?: string;
    isActive?: boolean;
    tier?: BadgeSeedV2['tier'];
    startsAt?: number;
    endsAt?: number;
  },
): BadgeSeedV2 {
  return {
    key,
    categoryKey,
    name,
    description,
    icon,
    displayOrder,
    tier: opts?.tier ?? tierForOrder(displayOrder),
    ruleType,
    ruleConfig,
    isActive: opts?.isActive ?? true,
    lockedDescription: opts?.lockedDescription,
    ...(opts?.startsAt !== undefined ? { startsAt: opts.startsAt } : {}),
    ...(opts?.endsAt !== undefined ? { endsAt: opts.endsAt } : {}),
  };
}

/** Full MVP catalogue — 10 categories × 10 badges (@see docs/badges.md). */
const BADGE_SEEDS_V2: BadgeSeedV2[] = [
  // ── 1. Getting Started ──────────────────────────────────────────────────────
  b('first_steps', 'getting_started', 'First Steps', 'Complete your first recorded walk.', 'boot', 1, 'walk_count', { target: 1, period: 'lifetime' }, { lockedDescription: 'Record your first walk to unlock this badge.' }),
  b('route_rookie', 'getting_started', 'Route Rookie', 'Plan your first route.', 'map', 2, 'planned_route_count', { target: 1, period: 'lifetime' }, { lockedDescription: 'Create a planned route in the route planner.' }),
  b('first_review', 'getting_started', 'First Review', 'View your first completed walk.', 'eye', 3, 'manual', {}, { isActive: false, lockedDescription: 'Open a completed walk in the activity review screen.' }),
  b('first_photo', 'getting_started', 'First Photo', 'Add your first walk photo.', 'camera', 4, 'walk_photos_total', { target: 1 }, { lockedDescription: 'Add a photo during or after a walk.' }),
  b('profile_ready', 'getting_started', 'Profile Ready', 'Add avatar and profile details.', 'person', 5, 'has_avatar', {}, { lockedDescription: 'Upload an avatar on your profile.' }),
  b('preference_setter', 'getting_started', 'Preference Setter', 'Set your units and preferences.', 'settings', 6, 'preferences_set', {}, { lockedDescription: 'Customise your units and display preferences.' }),
  b('goal_setter', 'getting_started', 'Goal Setter', 'Create your first walking goal.', 'target', 7, 'goal_created', {}, { lockedDescription: 'Create a goal from the account menu.' }),
  b('badge_beginner', 'getting_started', 'Badge Beginner', 'Unlock your first badge.', 'award', 8, 'badge_unlocked', {}, { lockedDescription: 'Earn any other badge first.' }),
  b('weekend_walker', 'getting_started', 'Weekend Walker', 'Complete a walk on a weekend.', 'sun', 9, 'walk_on_weekend', { target: 1 }, { lockedDescription: 'Walk on a Saturday or Sunday.' }),
  b('beta_explorer', 'getting_started', 'Beta Explorer', 'Join during the beta programme.', 'star', 10, 'joined_beta', {}),

  // ── 2. Distance Milestones ──────────────────────────────────────────────────
  b('distance_1km', 'distance_milestones', '1 km Walked', 'Walk 1 km in total across all your walks.', 'distance', 1, 'total_distance', { targetMetres: 1000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_5km', 'distance_milestones', '5 km Walked', 'Walk 5 km in total across all your walks.', 'distance', 2, 'total_distance', { targetMetres: 5000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_10km', 'distance_milestones', '10 km Walked', 'Walk 10 km in total across all your walks.', 'distance', 3, 'total_distance', { targetMetres: 10000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_25km', 'distance_milestones', '25 km Total', 'Walk 25 km in total across all your walks.', 'distance', 4, 'total_distance', { targetMetres: 25000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_50km', 'distance_milestones', '50 km Total', 'Walk 50 km in total across all your walks.', 'distance', 5, 'total_distance', { targetMetres: 50000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_100km', 'distance_milestones', '100 km Total', 'Walk 100 km in total across all your walks.', 'distance', 6, 'total_distance', { targetMetres: 100000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_250km', 'distance_milestones', '250 km Total', 'Walk 250 km in total across all your walks.', 'distance', 7, 'total_distance', { targetMetres: 250000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_500km', 'distance_milestones', '500 km Total', 'Walk 500 km in total across all your walks.', 'distance', 8, 'total_distance', { targetMetres: 500000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('distance_1000km', 'distance_milestones', '1,000 km Total', 'Walk 1,000 km in total across all your walks.', 'distance', 9, 'total_distance', { targetMetres: 1000000, period: 'lifetime' }, { lockedDescription: 'Keep walking — your total distance is climbing.' }),
  b('long_hauler_20km', 'distance_milestones', 'Long Hauler', 'Complete a single walk of at least 20 km.', 'distance', 10, 'single_walk_distance', { targetMetres: 20000 }, { lockedDescription: 'Complete one walk of 20 km or more.' }),

  // ── 3. Consistency ────────────────────────────────────────────────────────
  b('streak_2_days', 'consistency', 'Two-Day Streak', 'Walk two days in a row.', 'calendar', 1, 'consecutive_walk_days', { target: 2 }, { lockedDescription: 'Walk on consecutive days.' }),
  b('streak_3_days', 'consistency', 'Three-Day Streak', 'Walk three days in a row.', 'calendar', 2, 'consecutive_walk_days', { target: 3 }, { lockedDescription: 'Build a three-day walking streak.' }),
  b('streak_5_days', 'consistency', 'Five-Day Streak', 'Walk five days in a row.', 'calendar', 3, 'consecutive_walk_days', { target: 5 }, { lockedDescription: 'Build a five-day walking streak.' }),
  b('streak_7_days', 'consistency', 'Seven-Day Streak', 'Walk seven days in a row.', 'calendar', 4, 'consecutive_walk_days', { target: 7 }, { lockedDescription: 'Walk every day for a week.' }),
  b('weekend_habit', 'consistency', 'Weekend Habit', 'Walk on both Saturday and Sunday.', 'sun', 5, 'weekend_both_days', {}, { lockedDescription: 'Complete walks on both days of a weekend.' }),
  b('walks_3_per_week', 'consistency', '3x in a Week', 'Complete three walks in one week.', 'calendar', 6, 'walk_count', { target: 3, period: 'weekly' }, { lockedDescription: 'Complete three walks this week.' }),
  b('walks_5_per_week', 'consistency', '5x in a Week', 'Complete five walks in one week.', 'calendar', 7, 'walk_count', { target: 5, period: 'weekly' }, { lockedDescription: 'Complete five walks this week.' }),
  b('every_week_month', 'consistency', 'Every Week for a Month', 'Walk every week for four weeks.', 'calendar', 8, 'active_weeks_streak', { target: 4 }, { lockedDescription: 'Stay active every week for a month.' }),
  b('monthly_regular', 'consistency', 'Monthly Regular', 'Stay active three months in a row.', 'calendar', 9, 'active_months_streak', { target: 3 }, { lockedDescription: 'Walk regularly across three months.' }),
  b('ramble_rhythm', 'consistency', 'Ramble Rhythm', 'Stay active for twelve weeks.', 'calendar', 10, 'active_weeks_streak', { target: 12 }, { lockedDescription: 'Keep a walking rhythm for twelve weeks.' }),

  // ── 4. Monthly Challenges ─────────────────────────────────────────────────
  b('monthly_10km', 'monthly_challenges', '10 km in a Month', 'Walk 10 km in a calendar month.', 'distance', 1, 'total_distance', { targetMetres: 10000, period: 'monthly' }, { lockedDescription: 'Walk 10 km before the month ends.' }),
  b('monthly_25km', 'monthly_challenges', '25 km in a Month', 'Walk 25 km in a calendar month.', 'distance', 2, 'total_distance', { targetMetres: 25000, period: 'monthly' }, { lockedDescription: 'Walk 25 km before the month ends.' }),
  b('monthly_50km', 'monthly_challenges', '50 km in a Month', 'Walk 50 km in a calendar month.', 'distance', 3, 'total_distance', { targetMetres: 50000, period: 'monthly' }, { lockedDescription: 'Walk 50 km before the month ends.' }),
  b('monthly_100km', 'monthly_challenges', '100 km in a Month', 'Walk 100 km in a calendar month.', 'distance', 4, 'total_distance', { targetMetres: 100000, period: 'monthly' }, { lockedDescription: 'Walk 100 km before the month ends.' }),
  b('monthly_3_walks', 'monthly_challenges', '3 Walks in a Month', 'Complete three walks in a calendar month.', 'map', 5, 'walk_count', { target: 3, period: 'monthly' }, { lockedDescription: 'Complete three walks this month.' }),
  b('monthly_10_walks', 'monthly_challenges', '10 Walks in a Month', 'Complete ten walks in a calendar month.', 'calendar', 6, 'walk_count', { target: 10, period: 'monthly' }, { lockedDescription: 'Complete ten walks this month.' }),
  b('monthly_20_walks', 'monthly_challenges', '20 Walks in a Month', 'Complete twenty walks in a calendar month.', 'calendar', 7, 'walk_count', { target: 20, period: 'monthly' }, { lockedDescription: 'Complete twenty walks this month.' }),
  b('monthly_5_hours', 'monthly_challenges', '5 Hours Walking', 'Walk for five hours in a calendar month.', 'calendar', 8, 'total_moving_time', { targetSeconds: 18000, period: 'monthly' }, { lockedDescription: 'Accumulate five hours of moving time this month.' }),
  b('monthly_10_hours', 'monthly_challenges', '10 Hours Walking', 'Walk for ten hours in a calendar month.', 'calendar', 9, 'total_moving_time', { targetSeconds: 36000, period: 'monthly' }, { lockedDescription: 'Accumulate ten hours of moving time this month.' }),
  b('month_master', 'monthly_challenges', 'Month Master', 'Complete any three monthly goals.', 'star', 10, 'goals_completed', { target: 3, periodFilter: 'monthly' }, { lockedDescription: 'Complete three monthly walking goals.' }),

  // ── 5. Exploration ────────────────────────────────────────────────────────
  b('explore_first_area', 'exploration', 'First New Area', 'Walk in a new area.', 'compass', 1, 'unique_walk_areas', { target: 1 }, { lockedDescription: 'Explore somewhere new on foot.' }),
  b('explore_3_areas', 'exploration', '3 Different Areas', 'Walk in three different areas.', 'compass', 2, 'unique_walk_areas', { target: 3 }, { lockedDescription: 'Visit three distinct areas.' }),
  b('explore_5_areas', 'exploration', '5 Different Areas', 'Walk in five different areas.', 'compass', 3, 'unique_walk_areas', { target: 5 }, { lockedDescription: 'Visit five distinct areas.' }),
  b('explore_10_areas', 'exploration', '10 Different Areas', 'Walk in ten different areas.', 'compass', 4, 'unique_walk_areas', { target: 10 }, { lockedDescription: 'Visit ten distinct areas.' }),
  b('coastal_explorer', 'exploration', 'Coastal Explorer', 'Complete a coastal walk.', 'compass', 5, 'walk_has_tag', { tagSlug: 'landscape.coastal' }, { lockedDescription: 'Record a walk along the coast.' }),
  b('woodland_wanderer', 'exploration', 'Woodland Wanderer', 'Complete a woodland walk.', 'compass', 6, 'walk_has_tag', { tagSlug: 'landscape.woodland' }, { lockedDescription: 'Record a walk through woodland.' }),
  b('hill_walker', 'exploration', 'Hill Walker', 'Complete a hill walk.', 'mountain', 7, 'walk_has_tag', { tagSlug: 'terrain.hilly' }, { lockedDescription: 'Record a walk in hilly terrain.' }),
  b('urban_rambler', 'exploration', 'Urban Rambler', 'Complete an urban walk.', 'map', 8, 'walk_has_tag', { tagSlug: 'landscape.urban' }, { lockedDescription: 'Record a walk in an urban area.' }),
  b('countryside_explorer', 'exploration', 'Countryside Explorer', 'Complete a countryside walk.', 'compass', 9, 'walk_has_tag', { tagSlug: 'landscape.countryside' }, { lockedDescription: 'Record a walk in the countryside.' }),
  b('new_horizons', 'exploration', 'New Horizons', 'Walk in a new region.', 'sun', 10, 'unique_walk_regions', { target: 2 }, { lockedDescription: 'Explore a region you have not walked before.' }),

  // ── 6. Route Planning ─────────────────────────────────────────────────────
  b('route_first_planned', 'route_planning', 'First Planned Walk', 'Create your first planned route.', 'map', 1, 'planned_route_count', { target: 1, period: 'lifetime' }, { lockedDescription: 'Save a route in the planner.' }),
  b('route_planned_3', 'route_planning', 'Planned 3 Routes', 'Create three planned routes.', 'map', 2, 'planned_route_count', { target: 3, period: 'lifetime' }, { lockedDescription: 'Plan three routes.' }),
  b('route_planned_10', 'route_planning', 'Planned 10 Routes', 'Create ten planned routes.', 'map', 3, 'planned_route_count', { target: 10, period: 'lifetime' }, { lockedDescription: 'Plan ten routes.' }),
  b('circular_thinker', 'route_planning', 'Circular Thinker', 'Create a circular route.', 'map', 4, 'planned_route_circular', { target: 1 }, { lockedDescription: 'Plan a route that loops back to the start.' }),
  b('short_walk_planner', 'route_planning', 'Short Walk Planner', 'Create a route under 3 km.', 'map', 5, 'planned_route_short', { target: 1, maxMetres: 3000 }, { lockedDescription: 'Plan a short route under 3 km.' }),
  b('long_walk_planner', 'route_planning', 'Long Walk Planner', 'Create a route over 10 km.', 'map', 6, 'planned_route_long', { target: 1, minMetres: 10000 }, { lockedDescription: 'Plan a long route over 10 km.' }),
  b('route_first_poi', 'route_planning', 'First POI', 'Add your first point of interest.', 'map', 7, 'planned_route_poi_total', { target: 1 }, { lockedDescription: 'Add a POI to a planned route.' }),
  b('route_10_pois', 'route_planning', '10 POIs', 'Add ten points of interest.', 'map', 8, 'planned_route_poi_total', { target: 10 }, { lockedDescription: 'Add ten POIs across your routes.' }),
  b('route_published_first', 'route_planning', 'Published First Route', 'Publish your first public route.', 'map', 9, 'planned_route_published', { target: 1 }, { lockedDescription: 'Publish a route for others to explore.' }),
  b('route_architect', 'route_planning', 'Route Architect', 'Create twenty-five planned routes.', 'compass', 10, 'planned_route_count', { target: 25, period: 'lifetime' }, { lockedDescription: 'Plan twenty-five routes.' }),

  // ── 7. Recording Quality ──────────────────────────────────────────────────
  b('recording_clean_track', 'recording_quality', 'Clean Track', 'Complete a walk with high GPS quality.', 'gps', 1, 'clean_walk_count', { target: 1, minRatio: 0.85 }, { lockedDescription: 'Finish a walk with a high clean-point percentage.' }),
  b('recording_no_pauses', 'recording_quality', 'No Pauses', 'Walk for 30 minutes without pausing.', 'gps', 2, 'single_walk_moving_time', { targetSeconds: 1800 }, { lockedDescription: 'Keep moving for 30 minutes straight.' }),
  b('recording_long', 'recording_quality', 'Long Recording', 'Record a walk over two hours.', 'gps', 3, 'single_walk_duration', { targetSeconds: 7200 }, { lockedDescription: 'Record a walk longer than two hours.' }),
  b('recording_photo_journal', 'recording_quality', 'Photo Journal', 'Add five photos to one walk.', 'camera', 4, 'walk_photos_max_on_walk', { target: 5 }, { lockedDescription: 'Add five photos to a single walk.' }),
  b('recording_early_bird', 'recording_quality', 'Early Bird', 'Start a walk before 8 am.', 'sun', 5, 'walk_started_before_hour', { hourUtc: 8 }, { lockedDescription: 'Begin a walk before 8:00.' }),
  b('recording_sunset', 'recording_quality', 'Sunset Walker', 'Walk after 7 pm.', 'sun', 6, 'walk_started_after_hour', { hourUtc: 19 }, { lockedDescription: 'Start a walk after 19:00.' }),
  b('recording_rain_shine', 'recording_quality', 'Rain or Shine', 'Walk in poor weather.', 'gps', 7, 'manual', {}, { isActive: false, lockedDescription: 'Walk when the weather is challenging.' }),
  b('recording_accurate', 'recording_quality', 'Accurate Route', 'Complete a walk with excellent GPS accuracy.', 'gps', 8, 'clean_walk_count', { target: 1, minRatio: 0.95 }, { lockedDescription: 'Achieve a high clean-point percentage.' }),
  b('recording_complete_session', 'recording_quality', 'Complete Session', 'Stop and save a walk correctly.', 'gps', 9, 'walk_count', { target: 1, period: 'lifetime' }, { lockedDescription: 'Finish and save a walk properly.' }),
  b('recording_reliable', 'recording_quality', 'Reliable Rambler', 'Complete ten clean recordings.', 'gps', 10, 'clean_walk_count', { target: 10, minRatio: 0.85 }, { lockedDescription: 'Record ten walks with good GPS quality.' }),

  // ── 8. Elevation ──────────────────────────────────────────────────────────
  b('elevation_50m', 'elevation', 'First Climb', 'Climb 50 m in total across all walks.', 'mountain', 1, 'total_elevation_gain', { targetMetres: 50, period: 'lifetime' }, { lockedDescription: 'Accumulate 50 m of ascent.' }),
  b('elevation_100m', 'elevation', '100 m Ascent', 'Climb 100 m in total across all walks.', 'mountain', 2, 'total_elevation_gain', { targetMetres: 100, period: 'lifetime' }, { lockedDescription: 'Accumulate 100 m of ascent.' }),
  b('elevation_250m', 'elevation', '250 m Ascent', 'Climb 250 m in total across all walks.', 'mountain', 3, 'total_elevation_gain', { targetMetres: 250, period: 'lifetime' }, { lockedDescription: 'Accumulate 250 m of ascent.' }),
  b('elevation_500m', 'elevation', '500 m Ascent', 'Climb 500 m in total across all walks.', 'mountain', 4, 'total_elevation_gain', { targetMetres: 500, period: 'lifetime' }, { lockedDescription: 'Accumulate 500 m of ascent.' }),
  b('elevation_1000m', 'elevation', '1,000 m Ascent', 'Climb 1,000 m in total across all walks.', 'mountain', 5, 'total_elevation_gain', { targetMetres: 1000, period: 'lifetime' }, { lockedDescription: 'Accumulate 1,000 m of ascent.' }),
  b('elevation_hill_seeker', 'elevation', 'Hill Seeker', 'Complete a walk with 100 m ascent.', 'mountain', 6, 'single_walk_elevation_gain', { targetMetres: 100 }, { lockedDescription: 'Climb 100 m in a single walk.' }),
  b('elevation_ridge_rambler', 'elevation', 'Ridge Rambler', 'Complete a walk with 250 m ascent.', 'mountain', 7, 'single_walk_elevation_gain', { targetMetres: 250 }, { lockedDescription: 'Climb 250 m in a single walk.' }),
  b('elevation_summit_spirit', 'elevation', 'Summit Spirit', 'Complete a walk with 500 m ascent.', 'mountain', 8, 'single_walk_elevation_gain', { targetMetres: 500 }, { lockedDescription: 'Climb 500 m in a single walk.' }),
  b('elevation_up_and_over', 'elevation', 'Up and Over', 'Climb and descend 1,000 m in total.', 'mountain', 9, 'single_walk_elevation_total', { targetMetres: 1000 }, { lockedDescription: 'Accumulate 1,000 m of ascent and descent.' }),
  b('elevation_mountain_goat', 'elevation', 'Mountain Goat', 'Climb 10,000 m in total across all walks.', 'mountain', 10, 'total_elevation_gain', { targetMetres: 10000, period: 'lifetime' }, { lockedDescription: 'Accumulate 10,000 m of ascent.' }),

  // ── 9. Following Routes ───────────────────────────────────────────────────
  b('follow_first_route', 'following_routes', 'Follow First Route', 'Start your first follow session.', 'route', 1, 'follow_sessions', { target: 1, filter: 'started' }, { lockedDescription: 'Begin following a planned route.' }),
  b('follow_complete_session', 'following_routes', 'Complete Follow Session', 'Complete a followed route.', 'route', 2, 'follow_sessions', { target: 1, filter: 'completed' }, { lockedDescription: 'Finish a route follow session.' }),
  b('follow_stayed_on_route', 'following_routes', 'Stayed On Route', 'Finish a follow with no off-route alerts.', 'route', 3, 'follow_sessions', { target: 1, filter: 'no_off_route' }, { lockedDescription: 'Stay on route for an entire follow.' }),
  b('follow_3_routes', 'following_routes', 'Followed 3 Routes', 'Follow three different routes.', 'route', 4, 'follow_sessions', { target: 3, filter: 'completed' }, { lockedDescription: 'Complete three route follows.' }),
  b('follow_10_routes', 'following_routes', 'Followed 10 Routes', 'Follow ten different routes.', 'route', 5, 'follow_sessions', { target: 10, filter: 'completed' }, { lockedDescription: 'Complete ten route follows.' }),
  b('follow_returned', 'following_routes', 'Returned to Route', 'Go off-route then return during a follow.', 'route', 6, 'follow_sessions', { target: 1, filter: 'returned' }, { lockedDescription: 'Recover after going off-route.' }),
  b('follow_rewalk_own', 'following_routes', 'Rewalked Own Route', 'Follow one of your own saved routes.', 'route', 7, 'follow_sessions', { target: 1, filter: 'own' }, { lockedDescription: 'Follow a route you planned yourself.' }),
  b('follow_public_route', 'following_routes', 'Followed Public Route', 'Follow a public route.', 'route', 8, 'follow_sessions', { target: 1, filter: 'public' }, { lockedDescription: 'Follow a route shared by the community.' }),
  b('follow_no_alert', 'following_routes', 'Completed Without Alert', 'Complete a follow with no off-route alert.', 'route', 9, 'follow_sessions', { target: 1, filter: 'no_off_route' }, { lockedDescription: 'Finish a follow without triggering alerts.' }),
  b('follow_25_routes', 'following_routes', 'Route Follower', 'Follow twenty-five routes.', 'route', 10, 'follow_sessions', { target: 25, filter: 'completed' }, { lockedDescription: 'Complete twenty-five route follows.' }),

  // ── 10. Community / Sharing (inactive until Phase 8 sharing ships) ──────────
  b('share_first_walk', 'community_sharing', 'Shared First Walk', 'Share your first walk.', 'share', 1, 'manual', {}, { isActive: false }),
  b('share_first_route', 'community_sharing', 'Shared First Route', 'Share your first route.', 'share', 2, 'manual', {}, { isActive: false }),
  b('share_export_walk', 'community_sharing', 'Exported a Walk', 'Export a walk.', 'share', 3, 'manual', {}, { isActive: false }),
  b('share_invite_friend', 'community_sharing', 'Invited a Friend', 'Send an invite to a friend.', 'share', 4, 'manual', {}, { isActive: false }),
  b('share_route_viewed', 'community_sharing', 'Route Viewed by Someone', 'Have a shared route viewed.', 'share', 5, 'manual', {}, { isActive: false }),
  b('share_route_saved', 'community_sharing', 'Route Saved by Someone', 'Have someone save your route.', 'share', 6, 'manual', {}, { isActive: false }),
  b('share_helpful_tagger', 'community_sharing', 'Helpful Tagger', 'Add a useful tag.', 'share', 7, 'manual', {}, { isActive: false }),
  b('share_poi_confirmed', 'community_sharing', 'Confirmed a POI', 'Confirm a point of interest.', 'share', 8, 'manual', {}, { isActive: false }),
  b('share_tag_confirmed', 'community_sharing', 'Confirmed Route Tag', 'Confirm a route tag.', 'share', 9, 'manual', {}, { isActive: false }),
  b('share_local_contributor', 'community_sharing', 'Local Contributor', 'Make ten helpful contributions.', 'share', 10, 'manual', {}, { isActive: false }),
];

function toLegacyCategory(categoryKey: string): Doc<'badgeDefinitions'>['category'] {
  return categoryKey as Doc<'badgeDefinitions'>['category'];
}

function toLegacyCriteriaType(ruleType: BadgeRuleType): Doc<'badgeDefinitions'>['criteriaType'] {
  switch (ruleType) {
    case 'total_distance':
      return 'total_distance_m';
    case 'single_walk_distance':
      return 'single_walk_distance_m';
    case 'total_elevation_gain':
      return 'total_elevation_gain_m';
    default:
      return ruleType as Doc<'badgeDefinitions'>['criteriaType'];
  }
}

function toLegacyThreshold(ruleType: BadgeRuleType, ruleConfig: Record<string, unknown>): number | undefined {
  if (ruleType === 'total_distance' || ruleType === 'single_walk_distance' || ruleType === 'total_elevation_gain') {
    return typeof ruleConfig.targetMetres === 'number' ? ruleConfig.targetMetres : undefined;
  }
  if ('target' in ruleConfig && typeof ruleConfig.target === 'number') {
    return ruleConfig.target;
  }
  return undefined;
}

/** Full MVP catalogue (@see docs/badges.md). */
export type BadgeDefinitionSeed = Omit<Doc<'badgeDefinitions'>, '_id' | '_creationTime'>;

export const BADGE_DEFINITION_SEEDS: BadgeDefinitionSeed[] = BADGE_SEEDS_V2.map((seed) => ({
  slug: seed.key,
  category: toLegacyCategory(seed.categoryKey),
  label: seed.name,
  description: seed.description,
  sortOrder: seed.displayOrder,
  iconKey: seed.icon,
  criteriaType: toLegacyCriteriaType(seed.ruleType),
  criteriaThreshold: toLegacyThreshold(seed.ruleType, seed.ruleConfig),
  isActive: seed.isActive,
  key: seed.key,
  categoryKey: seed.categoryKey,
  name: seed.name,
  lockedDescription: seed.lockedDescription,
  icon: seed.icon,
  tier: seed.tier,
  ruleType: seed.ruleType,
  ruleConfig: seed.ruleConfig,
  displayOrder: seed.displayOrder,
  isHiddenUntilUnlocked: seed.isHiddenUntilUnlocked ?? false,
  isRepeatable: false,
  ...(seed.startsAt !== undefined ? { startsAt: seed.startsAt } : {}),
  ...(seed.endsAt !== undefined ? { endsAt: seed.endsAt } : {}),
}));
