import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import {
  getGoalCategory,
  getPeriodLabel,
  type GoalCategoryId,
  type GoalPeriod,
} from './goalCatalog';

type CompletedWalk = Pick<Doc<'walks'>, 'startedAt' | 'stats'>;

const LIFETIME_END = new Date('2100-01-01T00:00:00.000Z').getTime();

export function getWindowBounds(period: GoalPeriod, now = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);

  switch (period) {
    case 'daily': {
      const start = d.getTime();
      const end = start + 24 * 60 * 60 * 1000 - 1;
      return { start, end };
    }
    case 'weekly': {
      const day = d.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + mondayOffset);
      const start = d.getTime();
      const end = start + 7 * 24 * 60 * 60 * 1000 - 1;
      return { start, end };
    }
    case 'monthly': {
      d.setUTCDate(1);
      const start = d.getTime();
      d.setUTCMonth(d.getUTCMonth() + 1);
      const end = d.getTime() - 1;
      return { start, end };
    }
    case 'yearly': {
      d.setUTCMonth(0, 1);
      const start = d.getTime();
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      const end = d.getTime() - 1;
      return { start, end };
    }
    case 'lifetime':
      return { start: 0, end: LIFETIME_END };
  }
}

function utcDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function computeStreakDays(walks: CompletedWalk[], asOf = Date.now()): number {
  const days = new Set<string>();
  for (const walk of walks) {
    days.add(utcDayKey(walk.startedAt));
  }
  if (days.size === 0) return 0;

  let streak = 0;
  const cursor = new Date(asOf);
  cursor.setUTCHours(0, 0, 0, 0);

  while (true) {
    if (days.has(utcDayKey(cursor.getTime()))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function getCompletedWalksForUser(ctx: QueryCtx, userId: Id<'users'>): Promise<CompletedWalk[]> {
  const walks = await ctx.db
    .query('walks')
    .withIndex('by_userId_and_status', (q) => q.eq('userId', userId).eq('status', 'completed'))
    .collect();
  return walks;
}

function walksInWindow(walks: CompletedWalk[], start: number, end: number): CompletedWalk[] {
  return walks.filter((w) => w.startedAt >= start && w.startedAt <= end);
}

/** Progress only counts activity on or after the goal was created. */
export function getEffectiveProgressWindow(goal: Pick<Doc<'userGoals'>, 'windowStart' | 'windowEnd' | 'createdAt'>): {
  start: number;
  end: number;
} {
  return {
    start: Math.max(goal.windowStart, goal.createdAt),
    end: goal.windowEnd,
  };
}

export async function computeGoalProgress(
  ctx: QueryCtx,
  userId: Id<'users'>,
  goal: Pick<
    Doc<'userGoals'>,
    'goalType' | 'windowStart' | 'windowEnd' | 'createdAt' | 'category' | 'metric'
  >,
  cachedWalks?: CompletedWalk[],
): Promise<number> {
  const walks = cachedWalks ?? (await getCompletedWalksForUser(ctx, userId));
  const { start, end } = getEffectiveProgressWindow(goal);
  const inWindow = walksInWindow(walks, start, end);

  switch (goal.goalType) {
    case 'distance':
      return inWindow.reduce((sum, w) => sum + (w.stats?.distanceMetres ?? 0), 0) / 1000;
    case 'walk_count':
      return inWindow.length;
    case 'duration':
      return inWindow.reduce((sum, w) => sum + (w.stats?.movingTimeSeconds ?? 0), 0);
    case 'elevation':
      return inWindow.reduce((sum, w) => sum + (w.stats?.elevationGainMetres ?? 0), 0);
    case 'streak':
      return computeStreakDays(inWindow);
    case 'route_creation': {
      const routes = await ctx.db
        .query('plannedRoutes')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .collect();
      return routes.filter((r) => r.createdAt >= start && r.createdAt <= end).length;
    }
    default:
      return 0;
  }
}

export function buildGoalTitle(args: {
  category: GoalCategoryId;
  period: GoalPeriod;
  targetValue: number;
  unit: Doc<'userGoals'>['unit'];
  challengeLabel?: string;
}): string {
  if (args.challengeLabel) {
    return args.challengeLabel;
  }

  const periodLabel = getPeriodLabel(args.period);
  const category = getGoalCategory(args.category);
  const targetLabel =
    category?.targetPresets?.find((p) => p.value === args.targetValue)?.label ??
    String(args.targetValue);

  switch (args.unit) {
    case 'km':
      return `Walk ${targetLabel} ${periodLabel}`;
    case 'walks':
      return `Complete ${targetLabel} ${periodLabel}`;
    case 'seconds': {
      const hours = args.targetValue / 3600;
      const timeLabel = hours >= 1 ? `${hours} hour${hours === 1 ? '' : 's'}` : targetLabel;
      return `Walk ${timeLabel} ${periodLabel}`;
    }
    case 'metres':
      return `Climb ${targetLabel} ${periodLabel}`;
    case 'days':
      return `Walk ${targetLabel} in a row`;
    case 'routes':
      return `Plan ${targetLabel} ${periodLabel}`;
    default:
      return `${targetLabel} ${periodLabel}`;
  }
}

export function buildGoalSubtitle(args: {
  category: GoalCategoryId;
  period: GoalPeriod;
  challengeLabel?: string;
}): string {
  const category = getGoalCategory(args.category);
  if (args.challengeLabel && category) {
    return category.label;
  }
  const labels: Record<GoalCategoryId, string> = {
    distance: 'Distance goal',
    walk_count: 'Walk frequency',
    duration: 'Moving time',
    elevation: 'Total ascent',
    streak: 'Daily streak',
    route_planning: 'Route planning',
    virtual_journey: 'Virtual journey',
    climb_challenge: 'Famous climb',
  };
  const period = getPeriodLabel(args.period);
  return `${labels[args.category]} · ${period}`;
}

export function progressPercent(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((progress / target) * 100));
}

/** Open-ended lifetime distance / climb challenges (no calendar window). */
export function isOpenEndedChallenge(
  goal: Pick<Doc<'userGoals'>, 'period' | 'category'>,
): boolean {
  if (goal.period !== 'lifetime') return false;
  return (
    goal.category === 'virtual_journey' ||
    goal.category === 'climb_challenge' ||
    goal.category === 'distance' ||
    goal.category === 'elevation'
  );
}

/**
 * Challenge day counter — creation day is Day 1, each UTC calendar day increments.
 * Intended for leaderboards and “how long have I been on this challenge?” UX.
 */
export function getChallengeDayNumber(createdAt: number, now = Date.now()): number {
  const start = new Date(createdAt);
  start.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const elapsedDays = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, elapsedDays + 1);
}
