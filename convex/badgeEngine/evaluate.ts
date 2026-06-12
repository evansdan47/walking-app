import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { BadgeRuleType } from '../badgeRuleValidators';
import { isBadgeAvailable, resolveBadgeDefinition } from './resolveDefinition';
import { evaluateRule, progressPercent } from './ruleEvaluators';
import type {
  BadgeEventType,
  EvaluateBadgesResult,
  EvaluateHints,
  ResolvedBadgeDefinition,
} from './types';
import { buildActiveProgressChainKeys, progressChainKey } from './progressChains';
import { loadUserBadgeContext } from './userContext';

const WALK_RULE_TYPES: BadgeRuleType[] = [
  'walk_count',
  'total_distance',
  'single_walk_distance',
  'total_elevation_gain',
  'single_walk_elevation_gain',
  'single_walk_elevation_total',
  'total_moving_time',
  'single_walk_moving_time',
  'single_walk_duration',
  'walk_on_weekend',
  'consecutive_walk_days',
  'weekend_both_days',
  'active_weeks_streak',
  'active_months_streak',
  'walk_photos_max_on_walk',
  'walk_photos_total',
  'walk_started_before_hour',
  'walk_started_after_hour',
  'clean_walk_count',
  'unique_walk_areas',
  'unique_walk_regions',
  'walk_has_tag',
  'badge_unlocked',
  'joined_beta',
];

const ROUTE_RULE_TYPES: BadgeRuleType[] = [
  'planned_route_count',
  'planned_route_short',
  'planned_route_long',
  'planned_route_circular',
  'planned_route_published',
  'planned_route_poi_total',
];

const FOLLOW_RULE_TYPES: BadgeRuleType[] = ['follow_sessions'];

const PROFILE_RULE_TYPES: BadgeRuleType[] = [
  'has_avatar',
  'preferences_set',
  'joined_beta',
  'goal_created',
  'goals_completed',
];

const ALL_AUTO_RULE_TYPES: BadgeRuleType[] = [
  ...WALK_RULE_TYPES,
  ...ROUTE_RULE_TYPES,
  ...FOLLOW_RULE_TYPES,
  ...PROFILE_RULE_TYPES,
];

const EVENT_RULE_TYPES: Record<BadgeEventType, BadgeRuleType[]> = {
  walk_completed: WALK_RULE_TYPES,
  walk_synced: WALK_RULE_TYPES,
  route_planned: ROUTE_RULE_TYPES,
  goal_created: ['goal_created', 'goals_completed'],
  profile_updated: PROFILE_RULE_TYPES,
  follow_completed: FOLLOW_RULE_TYPES,
  tag_submitted: ['walk_has_tag', 'unique_walk_areas', 'unique_walk_regions'],
  recalculate: ALL_AUTO_RULE_TYPES,
  manual: ['manual'],
};

function sourceTypeForEvent(
  eventType: BadgeEventType,
): NonNullable<Doc<'userBadges'>['sourceType']> {
  switch (eventType) {
    case 'walk_completed':
    case 'walk_synced':
      return 'walk';
    case 'route_planned':
      return 'route';
    case 'goal_created':
      return 'goal';
    case 'follow_completed':
      return 'follow_session';
    case 'manual':
      return 'manual';
    default:
      return 'system';
  }
}

function ruleTypesForEvent(eventType: BadgeEventType): Set<BadgeRuleType> {
  return new Set(EVENT_RULE_TYPES[eventType]);
}

async function getUnlockedBadgeIds(
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<Set<Id<'badgeDefinitions'>>> {
  const unlocked = await ctx.db
    .query('userBadges')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();
  return new Set(unlocked.map((row) => row.badgeId));
}

async function upsertProgress(
  ctx: MutationCtx,
  userId: Id<'users'>,
  badgeKey: string,
  currentValue: number,
  targetValue: number,
  now: number,
): Promise<void> {
  const percent = progressPercent(currentValue, targetValue);
  const existing = await ctx.db
    .query('userBadgeProgress')
    .withIndex('by_userId_and_badgeKey', (q) => q.eq('userId', userId).eq('badgeKey', badgeKey))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      currentValue,
      targetValue,
      progressPercent: percent,
      lastEvaluatedAt: now,
    });
    return;
  }

  await ctx.db.insert('userBadgeProgress', {
    userId,
    badgeKey,
    currentValue,
    targetValue,
    progressPercent: percent,
    lastEvaluatedAt: now,
  });
}

async function unlockBadge(
  ctx: MutationCtx,
  userId: Id<'users'>,
  def: ResolvedBadgeDefinition,
  currentValue: number,
  targetValue: number,
  eventType: BadgeEventType,
  sourceId: string | undefined,
  now: number,
): Promise<void> {
  await ctx.db.insert('userBadges', {
    userId,
    badgeId: def.id,
    badgeKey: def.key,
    unlockedAt: now,
    progressAtUnlock: currentValue,
    sourceType: sourceTypeForEvent(eventType),
    ...(sourceId !== undefined ? { sourceId } : {}),
  });

  await upsertProgress(ctx, userId, def.key, currentValue, targetValue, now);
}

async function evaluateDefinition(
  ctx: MutationCtx,
  userId: Id<'users'>,
  def: ResolvedBadgeDefinition,
  unlockedIds: Set<Id<'badgeDefinitions'>>,
  activeChainKeys: Map<string, string>,
  context: Awaited<ReturnType<typeof loadUserBadgeContext>>,
  eventType: BadgeEventType,
  sourceId: string | undefined,
  now: number,
): Promise<{ unlocked: boolean; progressUpdated: boolean }> {
  const alreadyUnlocked = unlockedIds.has(def.id);
  if (alreadyUnlocked && !def.isRepeatable) {
    return { unlocked: false, progressUpdated: false };
  }

  const result = evaluateRule(def.ruleType, def.ruleConfig, context);

  if (result.met) {
    if (!alreadyUnlocked) {
      await unlockBadge(
        ctx,
        userId,
        def,
        result.currentValue,
        result.targetValue,
        eventType,
        sourceId,
        now,
      );
      unlockedIds.add(def.id);
      context.unlockedBadgeCount += 1;
      return { unlocked: true, progressUpdated: true };
    }
    return { unlocked: false, progressUpdated: false };
  }

  if (!alreadyUnlocked && result.targetValue > 0) {
    // Milestone chains sync progress once at the end (next unearned step only).
    if (progressChainKey(def) !== null) {
      return { unlocked: false, progressUpdated: false };
    }
    await upsertProgress(ctx, userId, def.key, result.currentValue, result.targetValue, now);
    return { unlocked: false, progressUpdated: true };
  }

  return { unlocked: false, progressUpdated: false };
}

async function syncChainProgress(
  ctx: MutationCtx,
  userId: Id<'users'>,
  definitions: ResolvedBadgeDefinition[],
  unlockedIds: Set<Id<'badgeDefinitions'>>,
  context: Awaited<ReturnType<typeof loadUserBadgeContext>>,
  now: number,
): Promise<number> {
  const activeChainKeys = buildActiveProgressChainKeys(definitions, unlockedIds);
  let updated = 0;

  const progressRows = await ctx.db
    .query('userBadgeProgress')
    .withIndex('by_userId_and_badgeKey', (q) => q.eq('userId', userId))
    .collect();

  const defByKey = new Map(definitions.map((d) => [d.key, d]));

  for (const row of progressRows) {
    const def = defByKey.get(row.badgeKey);
    if (!def) continue;
    const chainKey = progressChainKey(def);
    if (chainKey === null) continue;
    const isActive = activeChainKeys.get(chainKey) === def.key;
    if (unlockedIds.has(def.id) || !isActive) {
      await ctx.db.delete(row._id);
      updated++;
    }
  }

  for (const [, badgeKey] of activeChainKeys) {
    const def = definitions.find((d) => d.key === badgeKey);
    if (!def || unlockedIds.has(def.id)) continue;

    const result = evaluateRule(def.ruleType, def.ruleConfig, context);
    if (result.met) continue;

    await upsertProgress(ctx, userId, def.key, result.currentValue, result.targetValue, now);
    updated++;
  }

  return updated;
}

/**
 * Evaluate active badge rules for a user after a qualifying event.
 * Idempotent — safe to call multiple times for the same walk.
 */
export async function evaluateBadgesForUser(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>;
    eventType: BadgeEventType;
    sourceId?: string;
    hints?: EvaluateHints;
  },
): Promise<EvaluateBadgesResult> {
  const now = Date.now();
  const relevantRuleTypes = ruleTypesForEvent(args.eventType);
  const unlockedIds = await getUnlockedBadgeIds(ctx, args.userId);
  const context = await loadUserBadgeContext(ctx, args.userId, args.hints);

  const definitions = await ctx.db
    .query('badgeDefinitions')
    .withIndex('by_isActive', (q) => q.eq('isActive', true))
    .collect();

  const deferRule = (ruleType: BadgeRuleType) =>
    ruleType === 'badge_unlocked' || ruleType === 'joined_beta';

  const resolved = definitions
    .map(resolveBadgeDefinition)
    .filter((def) => isBadgeAvailable(def, now))
    .filter((def) => relevantRuleTypes.has(def.ruleType))
    .sort((a, b) => {
      if (deferRule(a.ruleType) && !deferRule(b.ruleType)) return 1;
      if (!deferRule(a.ruleType) && deferRule(b.ruleType)) return -1;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });

  const activeChainKeys = buildActiveProgressChainKeys(resolved, unlockedIds);

  const newlyUnlocked: EvaluateBadgesResult['newlyUnlocked'] = [];
  let progressUpdated = 0;

  for (const def of resolved) {
    const outcome = await evaluateDefinition(
      ctx,
      args.userId,
      def,
      unlockedIds,
      activeChainKeys,
      context,
      args.eventType,
      args.sourceId,
      now,
    );

    if (outcome.unlocked) {
      newlyUnlocked.push({
        badgeKey: def.key,
        name: def.name,
        tier: def.tier,
        categoryKey: def.categoryKey,
      });

      const refreshed = buildActiveProgressChainKeys(resolved, unlockedIds);
      for (const [key, value] of refreshed) {
        activeChainKeys.set(key, value);
      }
    }
    if (outcome.progressUpdated) {
      progressUpdated += 1;
    }
  }

  const allDefinitions = definitions
    .map(resolveBadgeDefinition)
    .filter((def) => isBadgeAvailable(def, now));

  progressUpdated += await syncChainProgress(
    ctx,
    args.userId,
    allDefinitions,
    unlockedIds,
    context,
    now,
  );

  return { newlyUnlocked, progressUpdated };
}

