import { v } from 'convex/values';
import { mutation, type MutationCtx, type QueryCtx } from './_generated/server';
import { evaluateBadgesForUser } from './badgeEngine/evaluate';

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

/** Start following a recorded walk or planned route. */
export const start = mutation({
  args: {
    walkId: v.id('walks'),
    plannedRouteId: v.optional(v.id('plannedRoutes')),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const walk = await ctx.db.get(args.walkId);
    if (!walk) throw new Error('Walk not found');

    const sessionId = await ctx.db.insert('followSessions', {
      userId: user._id,
      walkId: args.walkId,
      status: 'active',
      startedAt: args.startedAt ?? Date.now(),
      ...(args.plannedRouteId !== undefined ? { plannedRouteId: args.plannedRouteId } : {}),
    });

    await evaluateBadgesForUser(ctx, {
      userId: user._id,
      eventType: 'follow_completed',
      sourceId: sessionId,
    });

    return sessionId;
  },
});

/** Complete a follow session and evaluate following-route badges. */
export const complete = mutation({
  args: {
    followSessionId: v.id('followSessions'),
    endedAt: v.optional(v.number()),
    finalDistanceCoveredMetres: v.optional(v.number()),
    finalProgressPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const session = await ctx.db.get(args.followSessionId);
    if (!session || session.userId !== user._id) throw new Error('Follow session not found');

    await ctx.db.patch(args.followSessionId, {
      status: 'completed',
      endedAt: args.endedAt ?? Date.now(),
      ...(args.finalDistanceCoveredMetres !== undefined
        ? { finalDistanceCoveredMetres: args.finalDistanceCoveredMetres }
        : {}),
      ...(args.finalProgressPercent !== undefined
        ? { finalProgressPercent: args.finalProgressPercent }
        : {}),
    });

    return await evaluateBadgesForUser(ctx, {
      userId: user._id,
      eventType: 'follow_completed',
      sourceId: args.followSessionId,
    });
  },
});

/** Record an off-route deviation during a follow session. */
export const recordOffRoute = mutation({
  args: {
    followSessionId: v.id('followSessions'),
    timestamp: v.number(),
    latitude: v.number(),
    longitude: v.number(),
    distanceFromRouteMetres: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const session = await ctx.db.get(args.followSessionId);
    if (!session || session.userId !== user._id) throw new Error('Follow session not found');

    return await ctx.db.insert('offRouteEvents', {
      followSessionId: args.followSessionId,
      timestamp: args.timestamp,
      latitude: args.latitude,
      longitude: args.longitude,
      distanceFromRouteMetres: args.distanceFromRouteMetres,
    });
  },
});

/** Mark that the user returned to the route after an off-route event. */
export const markReturnedToRoute = mutation({
  args: {
    offRouteEventId: v.id('offRouteEvents'),
    returnedToRouteAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const event = await ctx.db.get(args.offRouteEventId);
    if (!event) throw new Error('Off-route event not found');

    const session = await ctx.db.get(event.followSessionId);
    if (!session || session.userId !== user._id) throw new Error('Forbidden');

    await ctx.db.patch(args.offRouteEventId, {
      returnedToRouteAt: args.returnedToRouteAt ?? Date.now(),
    });

    return await evaluateBadgesForUser(ctx, {
      userId: user._id,
      eventType: 'follow_completed',
      sourceId: event.followSessionId,
    });
  },
});
