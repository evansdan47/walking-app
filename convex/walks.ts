import { v } from 'convex/values';
import { mutation, MutationCtx } from './_generated/server';

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
    });
  },
});
