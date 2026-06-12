import type { BadgePeriod } from '../badgeRuleValidators';
import { getWindowBounds } from '../userGoalsCore';
import type { BadgeRuleType } from '../badgeRuleValidators';
import {
  hasWeekendHabitWeek,
  isCircularRoute,
  maxActiveMonthsStreak,
  maxActiveWeeksStreak,
  maxConsecutiveWalkDays,
  routeDistanceMetres,
} from './contextHelpers';
import type { CompletedWalkSnapshot, RuleEvaluationResult } from './types';
import type { UserBadgeContext } from './userContext';

function resolvePeriod(ruleConfig: Record<string, unknown>): BadgePeriod {
  const period = ruleConfig.period;
  if (
    period === 'daily' ||
    period === 'weekly' ||
    period === 'monthly' ||
    period === 'yearly' ||
    period === 'lifetime'
  ) {
    return period;
  }
  return 'lifetime';
}

function walksInPeriod(
  walks: CompletedWalkSnapshot[],
  period: BadgePeriod,
  now = Date.now(),
): CompletedWalkSnapshot[] {
  const { start, end } = getWindowBounds(period, now);
  return walks.filter((walk) => walk.startedAt >= start && walk.startedAt <= end);
}

function numberTarget(ruleConfig: Record<string, unknown>, key: string, fallback = 1): number {
  const value = ruleConfig[key];
  return typeof value === 'number' && value > 0 ? value : fallback;
}

function evaluateWalkCount(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const target = numberTarget(ruleConfig, 'target');
  const period = resolvePeriod(ruleConfig);
  const walks = walksInPeriod(context.completedWalks, period);
  const currentValue = walks.length;
  return { currentValue, targetValue: target, met: currentValue >= target };
}

function evaluateTotalDistance(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const targetValue = numberTarget(ruleConfig, 'targetMetres');
  const period = resolvePeriod(ruleConfig);
  const walks = walksInPeriod(context.completedWalks, period);
  const currentValue = walks.reduce((sum, walk) => sum + (walk.stats?.distanceMetres ?? 0), 0);
  return { currentValue, targetValue, met: currentValue >= targetValue };
}

function evaluateSingleWalkDistance(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const targetValue = numberTarget(ruleConfig, 'targetMetres');
  const currentValue = context.completedWalks.reduce(
    (max, walk) => Math.max(max, walk.stats?.distanceMetres ?? 0),
    0,
  );
  return { currentValue, targetValue, met: currentValue >= targetValue };
}

function evaluateTotalElevationGain(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const targetValue = numberTarget(ruleConfig, 'targetMetres');
  const period = resolvePeriod(ruleConfig);
  const walks = walksInPeriod(context.completedWalks, period);
  const currentValue = walks.reduce(
    (sum, walk) => sum + (walk.stats?.elevationGainMetres ?? 0),
    0,
  );
  return { currentValue, targetValue, met: currentValue >= targetValue };
}

function evaluatePlannedRouteCount(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const target = numberTarget(ruleConfig, 'target');
  const currentValue = context.plannedRouteCount;
  return { currentValue, targetValue: target, met: currentValue >= target };
}

function evaluateWalkOnWeekend(context: UserBadgeContext, ruleConfig: Record<string, unknown>): RuleEvaluationResult {
  const target = numberTarget(ruleConfig, 'target');
  const weekendWalks = context.completedWalks.filter((walk) => {
    const day = new Date(walk.startedAt).getUTCDay();
    return day === 0 || day === 6;
  });
  const currentValue = weekendWalks.length;
  return { currentValue, targetValue: target, met: currentValue >= target };
}

function evaluateTotalMovingTime(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const targetValue = numberTarget(ruleConfig, 'targetSeconds');
  const period = resolvePeriod(ruleConfig);
  const walks = walksInPeriod(context.completedWalks, period);
  const currentValue = walks.reduce((sum, walk) => sum + (walk.stats?.movingTimeSeconds ?? 0), 0);
  return { currentValue, targetValue, met: currentValue >= targetValue };
}

function evaluateBoolean(
  currentValue: number,
  met: boolean,
): RuleEvaluationResult {
  return { currentValue, targetValue: 1, met };
}

function evaluateFollowSessions(
  context: UserBadgeContext,
  ruleConfig: Record<string, unknown>,
): RuleEvaluationResult {
  const target = numberTarget(ruleConfig, 'target');
  const filter = ruleConfig.filter;

  let currentValue = 0;
  if (filter === 'started') {
    currentValue = context.followSessions.length;
  } else if (filter === 'completed') {
    currentValue = context.followSessions.filter((s) => s.status === 'completed').length;
  } else if (filter === 'no_off_route') {
    currentValue = context.followSessionsWithoutOffRoute;
  } else if (filter === 'returned') {
    currentValue = context.followSessionsWithReturn;
  } else if (filter === 'own') {
    currentValue = context.followOwnRouteCount;
  } else if (filter === 'public') {
    currentValue = context.followPublicRouteCount;
  } else {
    currentValue = context.followSessions.filter((s) => s.status === 'completed').length;
  }

  return { currentValue, targetValue: target, met: currentValue >= target };
}

export function evaluateRule(
  ruleType: BadgeRuleType,
  ruleConfig: Record<string, unknown>,
  context: UserBadgeContext,
): RuleEvaluationResult {
  switch (ruleType) {
    case 'walk_count':
      return evaluateWalkCount(context, ruleConfig);
    case 'total_distance':
      return evaluateTotalDistance(context, ruleConfig);
    case 'single_walk_distance':
      return evaluateSingleWalkDistance(context, ruleConfig);
    case 'total_elevation_gain':
      return evaluateTotalElevationGain(context, ruleConfig);
    case 'planned_route_count':
      return evaluatePlannedRouteCount(context, ruleConfig);
    case 'walk_on_weekend':
      return evaluateWalkOnWeekend(context, ruleConfig);
    case 'total_moving_time':
      return evaluateTotalMovingTime(context, ruleConfig);
    case 'consecutive_walk_days': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = maxConsecutiveWalkDays(context.completedWalks);
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'weekend_both_days':
      return evaluateBoolean(
        hasWeekendHabitWeek(context.completedWalks) ? 1 : 0,
        hasWeekendHabitWeek(context.completedWalks),
      );
    case 'active_weeks_streak': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = maxActiveWeeksStreak(context.completedWalks);
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'active_months_streak': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = maxActiveMonthsStreak(context.completedWalks);
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'goals_completed': {
      const target = numberTarget(ruleConfig, 'target');
      const monthlyOnly = ruleConfig.periodFilter === 'monthly';
      const currentValue = monthlyOnly
        ? context.completedMonthlyGoalsCount
        : context.completedGoalsCount;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'walk_photos_max_on_walk': {
      const target = numberTarget(ruleConfig, 'target');
      return {
        currentValue: context.maxPhotosOnSingleWalk,
        targetValue: target,
        met: context.maxPhotosOnSingleWalk >= target,
      };
    }
    case 'walk_photos_total': {
      const target = numberTarget(ruleConfig, 'target');
      return {
        currentValue: context.totalWalkPhotos,
        targetValue: target,
        met: context.totalWalkPhotos >= target,
      };
    }
    case 'walk_started_before_hour': {
      const hour = numberTarget(ruleConfig, 'hourUtc', 8);
      const met = context.completedWalks.some(
        (w) => new Date(w.startedAt).getUTCHours() < hour,
      );
      return evaluateBoolean(met ? 1 : 0, met);
    }
    case 'walk_started_after_hour': {
      const hour = numberTarget(ruleConfig, 'hourUtc', 19);
      const met = context.completedWalks.some(
        (w) => new Date(w.startedAt).getUTCHours() >= hour,
      );
      return evaluateBoolean(met ? 1 : 0, met);
    }
    case 'single_walk_elevation_gain': {
      const targetValue = numberTarget(ruleConfig, 'targetMetres');
      const currentValue = context.completedWalks.reduce(
        (max, walk) => Math.max(max, walk.stats?.elevationGainMetres ?? 0),
        0,
      );
      return { currentValue, targetValue, met: currentValue >= targetValue };
    }
    case 'single_walk_elevation_total': {
      const targetValue = numberTarget(ruleConfig, 'targetMetres');
      const currentValue = context.completedWalks.reduce((max, walk) => {
        const gain = walk.stats?.elevationGainMetres ?? 0;
        const loss = walk.stats?.elevationLossMetres ?? 0;
        return Math.max(max, gain + loss);
      }, 0);
      return { currentValue, targetValue, met: currentValue >= targetValue };
    }
    case 'single_walk_moving_time': {
      const targetValue = numberTarget(ruleConfig, 'targetSeconds');
      const currentValue = context.completedWalks.reduce((max, walk) => {
        const moving = walk.stats?.movingTimeSeconds ?? 0;
        const stopped = walk.stats?.stoppedTimeSeconds ?? 0;
        if (stopped > 60) return max;
        return Math.max(max, moving);
      }, 0);
      return { currentValue, targetValue, met: currentValue >= targetValue };
    }
    case 'single_walk_duration': {
      const targetValue = numberTarget(ruleConfig, 'targetSeconds');
      const currentValue = context.completedWalks.reduce(
        (max, walk) => Math.max(max, walk.stats?.durationSeconds ?? 0),
        0,
      );
      return { currentValue, targetValue, met: currentValue >= targetValue };
    }
    case 'clean_walk_count': {
      const target = numberTarget(ruleConfig, 'target');
      const minRatio = typeof ruleConfig.minRatio === 'number' ? ruleConfig.minRatio : 0.85;
      const currentValue = [...context.walkCleanRatioByWalkId.values()].filter(
        (r) => r >= minRatio,
      ).length;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'unique_walk_areas': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = context.uniqueWalkAreas.size;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'unique_walk_regions': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = context.uniqueWalkRegions.size;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'walk_has_tag': {
      const tagSlug = typeof ruleConfig.tagSlug === 'string' ? ruleConfig.tagSlug : '';
      const target = 1;
      let matches = 0;
      for (const slugs of context.walkTagSlugsByWalkId.values()) {
        if (slugs.has(tagSlug)) matches += 1;
      }
      return { currentValue: matches, targetValue: target, met: matches >= target };
    }
    case 'follow_sessions':
      return evaluateFollowSessions(context, ruleConfig);
    case 'planned_route_short': {
      const maxMetres = numberTarget(ruleConfig, 'maxMetres', 3000);
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = context.plannedRoutes.filter(
        (r) => routeDistanceMetres(r) > 0 && routeDistanceMetres(r) <= maxMetres,
      ).length;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'planned_route_long': {
      const minMetres = numberTarget(ruleConfig, 'minMetres', 10000);
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = context.plannedRoutes.filter(
        (r) => routeDistanceMetres(r) >= minMetres,
      ).length;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'planned_route_circular': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = context.plannedRoutes.filter((r) => isCircularRoute(r)).length;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'planned_route_published': {
      const target = numberTarget(ruleConfig, 'target');
      const currentValue = context.plannedRoutes.filter(
        (r) => (r.visibility ?? 'public') === 'public',
      ).length;
      return { currentValue, targetValue: target, met: currentValue >= target };
    }
    case 'planned_route_poi_total': {
      const target = numberTarget(ruleConfig, 'target');
      return {
        currentValue: context.plannedRoutePoiTotal,
        targetValue: target,
        met: context.plannedRoutePoiTotal >= target,
      };
    }
    case 'goal_created':
      return evaluateBoolean(context.goalCount, context.goalCount >= 1);
    case 'has_avatar':
      return evaluateBoolean(context.hasAvatar ? 1 : 0, context.hasAvatar);
    case 'preferences_set':
      return evaluateBoolean(context.hasPreferencesSet ? 1 : 0, context.hasPreferencesSet);
    case 'joined_beta':
      return evaluateBoolean(context.isBetaUser ? 1 : 0, context.isBetaUser);
    case 'badge_unlocked':
      return evaluateBoolean(context.unlockedBadgeCount, context.unlockedBadgeCount >= 1);
    case 'manual':
      return { currentValue: 0, targetValue: 1, met: false };
    default:
      return { currentValue: 0, targetValue: 1, met: false };
  }
}

export function progressPercent(currentValue: number, targetValue: number): number {
  if (targetValue <= 0) return 0;
  return Math.min(100, Math.round((currentValue / targetValue) * 100));
}

