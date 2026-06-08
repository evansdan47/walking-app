import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import {
  getGoalCategory,
  GOAL_CATEGORIES,
  MAX_ACTIVE_GOALS,
  type GoalCategoryId,
  type GoalPeriod,
} from './goalCatalog';
import { goalCategoryValidator, goalPeriodValidator } from './userValidators';
import {
  buildGoalSubtitle,
  buildGoalTitle,
  computeGoalProgress,
  getChallengeDayNumber,
  getWindowBounds,
  isOpenEndedChallenge,
  progressPercent,
} from './userGoalsCore';

async function getAuthUser(ctx: MutationCtx | QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error('User not found');
  return user;
}

export type GoalWithProgress = {
  _id: Id<'userGoals'>;
  title: string;
  subtitle: string;
  status: Doc<'userGoals'>['status'];
  category: GoalCategoryId;
  goalType: Doc<'userGoals'>['goalType'];
  metric: string;
  period: GoalPeriod;
  targetValue: number;
  unit: Doc<'userGoals'>['unit'];
  challengeLabel?: string;
  progressValue: number;
  progressPercent: number;
  /** Day 1 = goal created; only set for open-ended lifetime challenges. */
  challengeDay?: number;
  windowStart: number;
  windowEnd: number;
  completedAt?: number;
  createdAt: number;
};

async function enrichGoal(
  ctx: QueryCtx,
  userId: Id<'users'>,
  goal: Doc<'userGoals'>,
  cachedWalks?: Pick<Doc<'walks'>, 'startedAt' | 'stats'>[],
): Promise<GoalWithProgress> {
  const progressValue = await computeGoalProgress(ctx, userId, goal, cachedWalks);
  const pct = progressPercent(progressValue, goal.targetValue);

  return {
    _id: goal._id,
    title: goal.title,
    subtitle: buildGoalSubtitle({
      category: goal.category,
      period: goal.period,
      challengeLabel: goal.challengeLabel,
    }),
    status: goal.status,
    category: goal.category,
    goalType: goal.goalType,
    metric: goal.metric,
    period: goal.period,
    targetValue: goal.targetValue,
    unit: goal.unit,
    ...(goal.challengeLabel !== undefined ? { challengeLabel: goal.challengeLabel } : {}),
    progressValue,
    progressPercent: pct,
    ...(isOpenEndedChallenge(goal)
      ? { challengeDay: getChallengeDayNumber(goal.createdAt) }
      : {}),
    windowStart: goal.windowStart,
    windowEnd: goal.windowEnd,
    ...(goal.completedAt !== undefined ? { completedAt: goal.completedAt } : {}),
    createdAt: goal.createdAt,
  };
}

async function listGoalsForUser(ctx: QueryCtx, userId: Id<'users'>): Promise<GoalWithProgress[]> {
  const goals = await ctx.db
    .query('userGoals')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  const walks = await ctx.db
    .query('walks')
    .withIndex('by_userId_and_status', (q) => q.eq('userId', userId).eq('status', 'completed'))
    .collect();

  const enriched: GoalWithProgress[] = [];
  for (const goal of goals) {
    enriched.push(await enrichGoal(ctx, userId, goal, walks));
  }

  return enriched.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;
    return b.createdAt - a.createdAt;
  });
}

/** Goal catalog for the create-goal UI. */
export const getCatalog = query({
  args: {},
  handler: async () => {
    return {
      maxActiveGoals: MAX_ACTIVE_GOALS,
      categories: GOAL_CATEGORIES,
    };
  },
});

/** Active and recent goals with live progress. */
export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    const goals = await listGoalsForUser(ctx, user._id);
    const activeGoals = goals.filter((g) => g.status === 'active');

    return {
      goals,
      activeCount: activeGoals.length,
      maxActiveGoals: MAX_ACTIVE_GOALS,
    };
  },
});

/** Top active goals for the account overview. */
export const listRecentForOverview = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const goals = await listGoalsForUser(ctx, user._id);
    const cap = limit ?? 3;
    return goals.filter((g) => g.status === 'active').slice(0, cap);
  },
});

export const create = mutation({
  args: {
    category: goalCategoryValidator,
    period: goalPeriodValidator,
    targetValue: v.optional(v.number()),
    challengeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const categoryDef = getGoalCategory(args.category as GoalCategoryId);
    if (!categoryDef) throw new Error('Unknown goal category');

    if (!categoryDef.periods.includes(args.period)) {
      throw new Error('Period not allowed for this category');
    }

    const activeGoals = await ctx.db
      .query('userGoals')
      .withIndex('by_userId_and_status', (q) =>
        q.eq('userId', user._id).eq('status', 'active'),
      )
      .collect();

    if (activeGoals.length >= MAX_ACTIVE_GOALS) {
      throw new Error(`You can have at most ${MAX_ACTIVE_GOALS} active goals. Archive one to add another.`);
    }

    let targetValue = args.targetValue;
    let challengeLabel: string | undefined;
    let challengeId: string | undefined;

    if (categoryDef.challenges) {
      if (!args.challengeId) throw new Error('Choose a challenge');
      const challenge = categoryDef.challenges.find((c) => c.id === args.challengeId);
      if (!challenge) throw new Error('Unknown challenge');
      targetValue = challenge.targetValue;
      challengeLabel = challenge.label;
      challengeId = challenge.id;
    } else {
      if (targetValue === undefined) throw new Error('Choose a target');
      const allowed = categoryDef.targetPresets?.some((p) => p.value === targetValue);
      if (!allowed) throw new Error('Invalid target for this category');
    }

    const now = Date.now();
    const { start, end } = getWindowBounds(args.period, now);
    const title = buildGoalTitle({
      category: args.category as GoalCategoryId,
      period: args.period,
      targetValue: targetValue!,
      unit: categoryDef.unit,
      challengeLabel,
    });

    return await ctx.db.insert('userGoals', {
      userId: user._id,
      goalType: categoryDef.goalType,
      category: args.category,
      metric: categoryDef.metric,
      period: args.period,
      title,
      status: 'active',
      targetValue: targetValue!,
      unit: categoryDef.unit,
      ...(challengeLabel !== undefined ? { challengeLabel } : {}),
      ...(challengeId !== undefined ? { challengeId } : {}),
      windowStart: start,
      windowEnd: end,
      createdAt: now,
      updatedAt: now,
      progressValue: 0,
    });
  },
});

export const archive = mutation({
  args: { goalId: v.id('userGoals') },
  handler: async (ctx, { goalId }) => {
    const user = await getAuthUser(ctx);
    const goal = await ctx.db.get(goalId);
    if (!goal || goal.userId !== user._id) throw new Error('Goal not found');

    await ctx.db.patch(goalId, {
      status: 'archived',
      updatedAt: Date.now(),
    });
  },
});

/** Recompute progress and mark completed when target is met. */
export const syncProgress = mutation({
  args: { goalId: v.optional(v.id('userGoals')) },
  handler: async (ctx, { goalId }) => {
    const user = await getAuthUser(ctx);
    const goals = goalId
      ? [await ctx.db.get(goalId)].filter(Boolean) as Doc<'userGoals'>[]
      : await ctx.db
          .query('userGoals')
          .withIndex('by_userId_and_status', (q) =>
            q.eq('userId', user._id).eq('status', 'active'),
          )
          .collect();

    const walks = await ctx.db
      .query('walks')
      .withIndex('by_userId_and_status', (q) => q.eq('userId', user._id).eq('status', 'completed'))
      .collect();

    const now = Date.now();
    for (const goal of goals) {
      if (!goal || goal.userId !== user._id) continue;
      const progressValue = await computeGoalProgress(ctx, user._id, goal, walks);
      const completed = progressValue >= goal.targetValue;
      await ctx.db.patch(goal._id, {
        progressValue,
        updatedAt: now,
        ...(completed && goal.status === 'active'
          ? { status: 'completed' as const, completedAt: now }
          : {}),
      });
    }
  },
});
