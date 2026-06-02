import { action, mutation } from './_generated/server';
import { v } from 'convex/values';

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    walkId: v.id('walks'),
    timestamp: v.number(),
    latitude: v.number(),
    longitude: v.number(),
    storageId: v.id('_storage'),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) throw new Error('User not found');

    const walk = await ctx.db.get(args.walkId);
    if (!walk || walk.userId.toString() !== user._id.toString()) {
      throw new Error('Forbidden');
    }

    return await ctx.db.insert('walkPhotos', {
      walkId: args.walkId,
      userId: user._id,
      timestamp: args.timestamp,
      latitude: args.latitude,
      longitude: args.longitude,
      storageId: args.storageId,
      ...(args.caption !== undefined ? { caption: args.caption } : {}),
    });
  },
});
