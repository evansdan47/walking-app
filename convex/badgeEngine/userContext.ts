import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SUBSCRIPTION,
  resolveUserPreferences,
  resolveUserSubscription,
} from '../userAccountCore';
import { areaBucket, regionBucket } from './contextHelpers';
import type { CompletedWalkSnapshot, FollowSessionSnapshot } from './types';

export type UserBadgeContext = {
  user: Doc<'users'>;
  completedWalks: CompletedWalkSnapshot[];
  plannedRoutes: Doc<'plannedRoutes'>[];
  plannedRouteCount: number;
  plannedRoutePoiTotal: number;
  goalCount: number;
  completedGoalsCount: number;
  completedMonthlyGoalsCount: number;
  unlockedBadgeCount: number;
  hasAvatar: boolean;
  hasPreferencesSet: boolean;
  isBetaUser: boolean;
  walkPhotoCountByWalkId: Map<string, number>;
  totalWalkPhotos: number;
  maxPhotosOnSingleWalk: number;
  walkCleanRatioByWalkId: Map<string, number>;
  walkTagSlugsByWalkId: Map<string, Set<string>>;
  uniqueWalkAreas: Set<string>;
  uniqueWalkRegions: Set<string>;
  followSessions: FollowSessionSnapshot[];
  followSessionsWithoutOffRoute: number;
  followSessionsWithReturn: number;
  followOwnRouteCount: number;
  followPublicRouteCount: number;
};

async function loadTagSlugMap(ctx: QueryCtx): Promise<Map<string, string>> {
  const defs = await ctx.db.query('tagDefinitions').collect();
  return new Map(defs.map((d) => [d._id.toString(), d.slug]));
}

export async function loadUserBadgeContext(
  ctx: QueryCtx,
  userId: Id<'users'>,
  hints?: { hasAvatar?: boolean },
): Promise<UserBadgeContext> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error('User not found');

  const completedWalkDocs = await ctx.db
    .query('walks')
    .withIndex('by_userId_and_status', (q) => q.eq('userId', userId).eq('status', 'completed'))
    .collect();

  const completedWalks: CompletedWalkSnapshot[] = completedWalkDocs.map((walk) => ({
    _id: walk._id,
    startedAt: walk.startedAt,
    endedAt: walk.endedAt,
    stats: walk.stats,
    plannedRouteId: walk.plannedRouteId,
  }));

  const plannedRoutes = await ctx.db
    .query('plannedRoutes')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  let plannedRoutePoiTotal = 0;
  for (const route of plannedRoutes) {
    const pois = await ctx.db
      .query('plannedRoutePlaces')
      .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', route._id))
      .collect();
    plannedRoutePoiTotal += pois.length;
  }

  const goals = await ctx.db
    .query('userGoals')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  const userBadges = await ctx.db
    .query('userBadges')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  const photos = await ctx.db
    .query('walkPhotos')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  const walkPhotoCountByWalkId = new Map<string, number>();
  for (const photo of photos) {
    const key = photo.walkId.toString();
    walkPhotoCountByWalkId.set(key, (walkPhotoCountByWalkId.get(key) ?? 0) + 1);
  }
  const photoCounts = [...walkPhotoCountByWalkId.values()];
  const maxPhotosOnSingleWalk = photoCounts.length > 0 ? Math.max(...photoCounts) : 0;

  const tagSlugById = await loadTagSlugMap(ctx);
  const walkTagSlugsByWalkId = new Map<string, Set<string>>();
  for (const walk of completedWalks) {
    const contribs = await ctx.db
      .query('tagContributions')
      .withIndex('by_entityType_and_entityId', (q) =>
        q.eq('entityType', 'walk').eq('entityId', walk._id.toString()),
      )
      .collect();
    const slugs = new Set<string>();
    for (const c of contribs) {
      const slug = tagSlugById.get(c.tagId.toString());
      if (slug) slugs.add(slug);
    }
    if (slugs.size > 0) walkTagSlugsByWalkId.set(walk._id.toString(), slugs);
  }

  const walkCleanRatioByWalkId = new Map<string, number>();
  const uniqueWalkAreas = new Set<string>();
  const uniqueWalkRegions = new Set<string>();

  for (const walk of completedWalks) {
    const trackPoints = await ctx.db
      .query('trackPoints')
      .withIndex('by_walkId', (q) => q.eq('walkId', walk._id))
      .collect();
    const totalPoints = trackPoints.length;
    const cleanPoints = walk.stats?.pointCount ?? trackPoints.filter((p) => p.isClean === true).length;
    const ratio = totalPoints > 0 ? cleanPoints / totalPoints : cleanPoints > 0 ? 1 : 0;
    walkCleanRatioByWalkId.set(walk._id.toString(), ratio);

    const first =
      trackPoints.length > 0
        ? trackPoints.reduce((a, b) => (a.timestamp < b.timestamp ? a : b))
        : null;
    if (first) {
      uniqueWalkAreas.add(areaBucket(first.latitude, first.longitude));
      uniqueWalkRegions.add(regionBucket(first.latitude, first.longitude));
    }
  }

  const followSessionDocs = await ctx.db
    .query('followSessions')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  const followSessions: FollowSessionSnapshot[] = followSessionDocs.map((s) => ({
    _id: s._id,
    status: s.status,
    plannedRouteId: s.plannedRouteId,
    userId: s.userId,
  }));

  let followSessionsWithoutOffRoute = 0;
  let followSessionsWithReturn = 0;
  let followOwnRouteCount = 0;
  let followPublicRouteCount = 0;

  for (const session of followSessionDocs) {
    if (session.status !== 'completed') continue;

    const events = await ctx.db
      .query('offRouteEvents')
      .withIndex('by_followSessionId', (q) => q.eq('followSessionId', session._id))
      .collect();

    if (events.length === 0) followSessionsWithoutOffRoute += 1;
    if (events.some((e) => e.returnedToRouteAt !== undefined)) followSessionsWithReturn += 1;

    if (session.plannedRouteId) {
      const route = await ctx.db.get(session.plannedRouteId);
      if (route) {
        if ((route.authorId ?? route.userId).toString() === userId.toString()) {
          followOwnRouteCount += 1;
        }
        if ((route.visibility ?? 'public') === 'public') {
          followPublicRouteCount += 1;
        }
      }
    }
  }

  const preferences = resolveUserPreferences(user);
  const subscription = resolveUserSubscription(user);
  const hasCustomPreferences =
    user.preferences !== undefined &&
    (preferences.units?.distance !== DEFAULT_PREFERENCES.units?.distance ||
      preferences.units?.weight !== DEFAULT_PREFERENCES.units?.weight ||
      preferences.units?.elevation !== DEFAULT_PREFERENCES.units?.elevation ||
      preferences.profile?.weightKg !== undefined ||
      preferences.display !== undefined ||
      preferences.privacy !== undefined);

  return {
    user,
    completedWalks,
    plannedRoutes,
    plannedRouteCount: plannedRoutes.length,
    plannedRoutePoiTotal,
    goalCount: goals.length,
    completedGoalsCount: goals.filter((g) => g.status === 'completed').length,
    completedMonthlyGoalsCount: goals.filter(
      (g) => g.status === 'completed' && g.period === 'monthly',
    ).length,
    unlockedBadgeCount: userBadges.length,
    hasAvatar: hints?.hasAvatar === true || user.hasAvatar === true,
    hasPreferencesSet: hasCustomPreferences,
    isBetaUser: subscription.plan === 'beta' && subscription.status === 'active',
    walkPhotoCountByWalkId,
    totalWalkPhotos: photos.length,
    maxPhotosOnSingleWalk,
    walkCleanRatioByWalkId,
    walkTagSlugsByWalkId,
    uniqueWalkAreas,
    uniqueWalkRegions,
    followSessions,
    followSessionsWithoutOffRoute,
    followSessionsWithReturn,
    followOwnRouteCount,
    followPublicRouteCount,
  };
}

