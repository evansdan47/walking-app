import { describe, expect, it } from 'vitest';
import type { Doc, Id } from '../_generated/dataModel';
import { evaluateRule, progressPercent } from './ruleEvaluators';
import type { CompletedWalkSnapshot } from './types';
import type { UserBadgeContext } from './userContext';

function makeUser(overrides: Partial<Doc<'users'>> = {}): Doc<'users'> {
  return {
    _id: 'user1' as Id<'users'>,
    _creationTime: 0,
    tokenIdentifier: 'token',
    ...overrides,
  };
}

let walkSeq = 0;

function makeWalk(
  startedAt: number,
  distanceMetres: number,
  extras: Partial<CompletedWalkSnapshot> = {},
): CompletedWalkSnapshot {
  walkSeq += 1;
  return {
    _id: `walk${walkSeq}` as Id<'walks'>,
    startedAt,
    stats: {
      distanceMetres,
      durationSeconds: 3600,
      movingTimeSeconds: 3000,
      stoppedTimeSeconds: 600,
      pointCount: 100,
      ...extras.stats,
    },
    ...extras,
  };
}

function makeContext(overrides: Partial<UserBadgeContext> = {}): UserBadgeContext {
  return {
    user: makeUser(),
    completedWalks: [],
    plannedRoutes: [],
    plannedRouteCount: 0,
    plannedRoutePoiTotal: 0,
    goalCount: 0,
    completedGoalsCount: 0,
    completedMonthlyGoalsCount: 0,
    unlockedBadgeCount: 0,
    hasAvatar: false,
    hasPreferencesSet: false,
    isBetaUser: true,
    walkPhotoCountByWalkId: new Map(),
    totalWalkPhotos: 0,
    maxPhotosOnSingleWalk: 0,
    walkCleanRatioByWalkId: new Map(),
    walkTagSlugsByWalkId: new Map(),
    uniqueWalkAreas: new Set(),
    uniqueWalkRegions: new Set(),
    followSessions: [],
    followSessionsWithoutOffRoute: 0,
    followSessionsWithReturn: 0,
    followOwnRouteCount: 0,
    followPublicRouteCount: 0,
    ...overrides,
  };
}

describe('evaluateRule', () => {
  it('unlocks walk_count when target reached', () => {
    const context = makeContext({
      completedWalks: [makeWalk(Date.UTC(2026, 5, 9), 1200)],
    });

    const result = evaluateRule('walk_count', { target: 1, period: 'lifetime' }, context);
    expect(result.met).toBe(true);
    expect(result.currentValue).toBe(1);
  });

  it('tracks total_distance toward lifetime target', () => {
    const context = makeContext({
      completedWalks: [
        makeWalk(Date.UTC(2026, 5, 8), 40_000),
        makeWalk(Date.UTC(2026, 5, 9), 65_000),
      ],
    });

    const result = evaluateRule(
      'total_distance',
      { targetMetres: 100_000, period: 'lifetime' },
      context,
    );
    expect(result.met).toBe(true);
    expect(result.currentValue).toBe(105_000);
  });

  it('does not unlock total_distance below threshold', () => {
    const context = makeContext({
      completedWalks: [makeWalk(Date.UTC(2026, 5, 9), 50_000)],
    });

    const result = evaluateRule(
      'total_distance',
      { targetMetres: 100_000, period: 'lifetime' },
      context,
    );
    expect(result.met).toBe(false);
    expect(result.currentValue).toBe(50_000);
    expect(result.targetValue).toBe(100_000);
  });

  it('unlocks single_walk_distance on best walk only', () => {
    const context = makeContext({
      completedWalks: [
        makeWalk(Date.UTC(2026, 5, 8), 8_000),
        makeWalk(Date.UTC(2026, 5, 9), 21_000),
      ],
    });

    const result = evaluateRule('single_walk_distance', { targetMetres: 20_000 }, context);
    expect(result.met).toBe(true);
    expect(result.currentValue).toBe(21_000);
  });

  it('detects weekend walks', () => {
    // Saturday 7 June 2025
    const context = makeContext({
      completedWalks: [makeWalk(Date.UTC(2025, 5, 7, 10), 3000)],
    });

    const result = evaluateRule('walk_on_weekend', { target: 1 }, context);
    expect(result.met).toBe(true);
  });

  it('requires manual rule to be granted explicitly', () => {
    const result = evaluateRule('manual', {}, makeContext());
    expect(result.met).toBe(false);
  });

  it('unlocks has_avatar when user has an avatar', () => {
    const result = evaluateRule('has_avatar', {}, makeContext({ hasAvatar: true }));
    expect(result.met).toBe(true);
  });

  it('unlocks goal_created when user has at least one goal', () => {
    const result = evaluateRule('goal_created', {}, makeContext({ goalCount: 1 }));
    expect(result.met).toBe(true);
  });

  it('tracks planned_route_count progress', () => {
    const result = evaluateRule('planned_route_count', { target: 3 }, makeContext({ plannedRouteCount: 1 }));
    expect(result.met).toBe(false);
    expect(result.currentValue).toBe(1);
    expect(result.targetValue).toBe(3);
  });

  it('unlocks consecutive_walk_days streak', () => {
    const day = Date.UTC(2026, 5, 9);
    const context = makeContext({
      completedWalks: [
        makeWalk(day, 1000),
        makeWalk(day + 86_400_000, 1000),
        makeWalk(day + 2 * 86_400_000, 1000),
      ],
    });
    const result = evaluateRule('consecutive_walk_days', { target: 3 }, context);
    expect(result.met).toBe(true);
  });
});

describe('progressPercent', () => {
  it('caps at 100', () => {
    expect(progressPercent(150, 100)).toBe(100);
  });

  it('rounds partial progress', () => {
    expect(progressPercent(25, 100)).toBe(25);
    expect(progressPercent(1, 3)).toBe(33);
  });
});
