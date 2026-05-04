import { v } from 'convex/values';
import { mutation, MutationCtx, query } from './_generated/server';

const statsValidator = v.optional(
  v.object({
    distanceMetres: v.number(),
    durationSeconds: v.number(),
    movingTimeSeconds: v.number(),
    stoppedTimeSeconds: v.number(),
    avgPaceSecsPerKm: v.optional(v.number()),
    elevationGainMetres: v.optional(v.number()),
    elevationLossMetres: v.optional(v.number()),
    pointCount: v.number(),
  }),
);

async function getAuthUser(ctx: MutationCtx) {
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

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    status: v.union(
      v.literal('recording'),
      v.literal('paused'),
      v.literal('completed'),
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    deviceId: v.string(),
    stats: statsValidator,
    isLive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    return await ctx.db.insert('walks', {
      userId: user._id,
      status: args.status,
      startedAt: args.startedAt,
      deviceId: args.deviceId,
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.endedAt !== undefined ? { endedAt: args.endedAt } : {}),
      ...(args.stats !== undefined ? { stats: args.stats } : {}),
      ...(args.isLive !== undefined ? { isLive: args.isLive } : {}),
    });
  },
});

/**
 * Finalises a live-broadcast walk on the server: sets status to 'completed',
 * records endedAt and final stats, and clears isLive so it no longer appears
 * as an active broadcast.
 */
export const complete = mutation({
  args: {
    walkId: v.id('walks'),
    endedAt: v.number(),
    stats: statsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const walk = await ctx.db.get(args.walkId);
    if (!walk) throw new Error('Walk not found');
    if (walk.userId.toString() !== user._id.toString()) throw new Error('Forbidden');
    await ctx.db.patch(args.walkId, {
      status: 'completed',
      endedAt: args.endedAt,
      isLive: false,
      ...(args.stats !== undefined ? { stats: args.stats } : {}),
    });
  },
});

/**
 * Returns all completed walks for the currently authenticated user,
 * ordered newest-first. Used by the web app.
 */
export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];
    return await ctx.db
      .query('walks')
      .withIndex('by_userId_and_status', (q) =>
        q.eq('userId', user._id).eq('status', 'completed'),
      )
      .order('desc')
      .collect();
  },
});
