import type { BadgeRuleType } from '@convex/badgeRuleValidators';

const PERIOD_LABEL: Record<string, string> = {
  lifetime: 'lifetime',
  daily: 'today',
  weekly: 'this week',
  monthly: 'this month',
  yearly: 'this year',
};

export function formatRuleSummary(
  ruleType: BadgeRuleType,
  ruleConfig: Record<string, unknown>,
): string {
  const period =
    typeof ruleConfig.period === 'string'
      ? PERIOD_LABEL[ruleConfig.period] ?? ruleConfig.period
      : 'lifetime';

  switch (ruleType) {
    case 'walk_count':
      return `Complete ${ruleConfig.target ?? 1} walk(s) (${period})`;
    case 'total_distance': {
      const metres = Number(ruleConfig.targetMetres ?? 0);
      const km = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
      return `Walk ${km} total (${period})`;
    }
    case 'single_walk_distance': {
      const metres = Number(ruleConfig.targetMetres ?? 0);
      const km = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
      return `Single walk ≥ ${km}`;
    }
    case 'total_elevation_gain':
    case 'single_walk_elevation_gain':
    case 'single_walk_elevation_total': {
      const metres = Number(ruleConfig.targetMetres ?? 0);
      return `Climb ${metres} m${ruleType === 'total_elevation_gain' ? ` total (${period})` : ''}`;
    }
    case 'planned_route_count':
      return `Plan ${ruleConfig.target ?? 1} route(s) (${period})`;
    case 'walk_on_weekend':
      return `Walk on ${ruleConfig.target ?? 1} weekend(s)`;
    case 'consecutive_walk_days':
      return `${ruleConfig.target ?? 1}-day walking streak`;
    case 'weekend_both_days':
      return 'Walk Saturday and Sunday same weekend';
    case 'active_weeks_streak':
      return `Active ${ruleConfig.target ?? 1} week(s) in a row`;
    case 'active_months_streak':
      return `Active ${ruleConfig.target ?? 1} month(s) in a row`;
    case 'total_moving_time':
      return `Moving time ${Math.round(Number(ruleConfig.targetSeconds ?? 0) / 3600)}h (${period})`;
    case 'goals_completed':
      return `Complete ${ruleConfig.target ?? 1} goal(s)${ruleConfig.periodFilter === 'monthly' ? ' (monthly)' : ''}`;
    case 'walk_photos_max_on_walk':
      return `${ruleConfig.target ?? 1} photos on one walk`;
    case 'walk_photos_total':
      return `${ruleConfig.target ?? 1} walk photo(s) total`;
    case 'walk_started_before_hour':
      return `Start walk before ${ruleConfig.hourUtc ?? 8}:00 UTC`;
    case 'walk_started_after_hour':
      return `Start walk after ${ruleConfig.hourUtc ?? 19}:00 UTC`;
    case 'single_walk_moving_time':
      return `Moving time ≥ ${Math.round(Number(ruleConfig.targetSeconds ?? 0) / 60)} min (one walk)`;
    case 'single_walk_duration':
      return `Duration ≥ ${Math.round(Number(ruleConfig.targetSeconds ?? 0) / 3600)}h (one walk)`;
    case 'clean_walk_count':
      return `${ruleConfig.target ?? 1} clean GPS walk(s)`;
    case 'unique_walk_areas':
      return `Walk in ${ruleConfig.target ?? 1} distinct area(s)`;
    case 'unique_walk_regions':
      return `Walk in ${ruleConfig.target ?? 1} region(s)`;
    case 'walk_has_tag':
      return `Walk tagged ${ruleConfig.tagSlug ?? 'tag'}`;
    case 'follow_sessions':
      return `Follow sessions: ${ruleConfig.filter ?? 'completed'} × ${ruleConfig.target ?? 1}`;
    case 'planned_route_short':
      return `Plan route ≤ ${Number(ruleConfig.maxMetres ?? 3000) / 1000} km`;
    case 'planned_route_long':
      return `Plan route ≥ ${Number(ruleConfig.minMetres ?? 10000) / 1000} km`;
    case 'planned_route_circular':
      return `Circular route × ${ruleConfig.target ?? 1}`;
    case 'planned_route_published':
      return `Publish ${ruleConfig.target ?? 1} public route(s)`;
    case 'planned_route_poi_total':
      return `${ruleConfig.target ?? 1} route POI(s)`;
    case 'goal_created':
      return 'Create a walking goal';
    case 'has_avatar':
      return 'Set a profile avatar';
    case 'preferences_set':
      return 'Customise preferences';
    case 'joined_beta':
      return 'Join during beta';
    case 'badge_unlocked':
      return 'Unlock any badge';
    case 'manual':
      return 'Manual grant only';
    default:
      return ruleType;
  }
}

export const RULE_TYPE_OPTIONS: { value: BadgeRuleType; label: string }[] = [
  { value: 'walk_count', label: 'Walk count' },
  { value: 'total_distance', label: 'Total distance' },
  { value: 'single_walk_distance', label: 'Single walk distance' },
  { value: 'total_elevation_gain', label: 'Total elevation gain' },
  { value: 'single_walk_elevation_gain', label: 'Single walk elevation gain' },
  { value: 'single_walk_elevation_total', label: 'Single walk up+down elevation' },
  { value: 'planned_route_count', label: 'Planned routes' },
  { value: 'planned_route_short', label: 'Short planned route' },
  { value: 'planned_route_long', label: 'Long planned route' },
  { value: 'planned_route_circular', label: 'Circular planned route' },
  { value: 'planned_route_published', label: 'Published route' },
  { value: 'planned_route_poi_total', label: 'Route POI total' },
  { value: 'consecutive_walk_days', label: 'Consecutive walk days' },
  { value: 'weekend_both_days', label: 'Weekend both days' },
  { value: 'active_weeks_streak', label: 'Active weeks streak' },
  { value: 'active_months_streak', label: 'Active months streak' },
  { value: 'total_moving_time', label: 'Total moving time' },
  { value: 'single_walk_moving_time', label: 'Single walk moving time' },
  { value: 'single_walk_duration', label: 'Single walk duration' },
  { value: 'clean_walk_count', label: 'Clean GPS walks' },
  { value: 'walk_photos_max_on_walk', label: 'Photos on one walk' },
  { value: 'walk_photos_total', label: 'Total walk photos' },
  { value: 'walk_started_before_hour', label: 'Started before hour' },
  { value: 'walk_started_after_hour', label: 'Started after hour' },
  { value: 'unique_walk_areas', label: 'Unique walk areas' },
  { value: 'unique_walk_regions', label: 'Unique walk regions' },
  { value: 'walk_has_tag', label: 'Walk has tag' },
  { value: 'follow_sessions', label: 'Follow sessions' },
  { value: 'goals_completed', label: 'Goals completed' },
  { value: 'goal_created', label: 'Goal created' },
  { value: 'has_avatar', label: 'Has avatar' },
  { value: 'preferences_set', label: 'Preferences set' },
  { value: 'joined_beta', label: 'Joined beta' },
  { value: 'walk_on_weekend', label: 'Weekend walk' },
  { value: 'badge_unlocked', label: 'Any badge unlocked' },
  { value: 'manual', label: 'Manual only' },
];

export const TIER_OPTIONS = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
] as const;
