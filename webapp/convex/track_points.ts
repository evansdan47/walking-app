import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { Id } from './_generated/dataModel';

export const insertBatch = mutation({
  args: {
    walkId: v.id('walks'),
    points: v.array(
      v.object({
        timestamp: v.number(),
        latitude: v.number(),
        longitude: v.number(),
        altitudeMetres: v.optional(v.number()),
        speedMps: v.optional(v.number()),
        accuracyMetres: v.number(),
        isClean: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    // Verify the walk belongs to the authenticated user
    const walk = await ctx.db.get(args.walkId);
    if (!walk) throw new Error('Walk not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user || user._id.toString() !== walk.userId.toString()) {
      throw new Error('Forbidden');
    }

    const ids: Id<'trackPoints'>[] = [];
    for (const pt of args.points) {
      const id = await ctx.db.insert('trackPoints', {
        walkId: args.walkId,
        timestamp: pt.timestamp,
        latitude: pt.latitude,
        longitude: pt.longitude,
        accuracyMetres: pt.accuracyMetres,
        ...(pt.altitudeMetres !== undefined ? { altitudeMetres: pt.altitudeMetres } : {}),
        ...(pt.speedMps !== undefined ? { speedMps: pt.speedMps } : {}),
        ...(pt.isClean !== undefined ? { isClean: pt.isClean } : {}),
      });
      ids.push(id);
    }
    return ids;
  },
});

/**
 * Returns the total number of track points stored for a given walk.
 * Used by the mobile client's post-upload reconciliation step to verify
 * that the server count matches the local clean-point count.
 */
export const countForWalk = query({
  args: { walkId: v.id('walks') },
  handler: async (ctx, args): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const walk = await ctx.db.get(args.walkId);
    if (!walk) throw new Error('Walk not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user || user._id.toString() !== walk.userId.toString()) {
      throw new Error('Forbidden');
    }

    const points = await ctx.db
      .query('trackPoints')
      .withIndex('by_walkId', (q) => q.eq('walkId', args.walkId))
      .collect();
    return points.length;
  },
});

/**
 * Returns the clean GPS track for a walk, ordered by timestamp.
 * Used by the Activity panel to draw the route on the map and render the
 * elevation profile.
 *
 * Auth: the requesting user must own the walk.
 *
 * Returns `isClean === true` points; falls back to all points for walks
 * whose track has not yet been post-processed.
 */
export const getCleanForWalk = query({
  args: { walkId: v.id('walks') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const walk = await ctx.db.get(args.walkId);
    if (!walk) throw new Error('Walk not found');

    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user || user._id.toString() !== walk.userId.toString()) {
      throw new Error('Forbidden');
    }

    const all = await ctx.db
      .query('trackPoints')
      .withIndex('by_walkId_and_timestamp', (q) => q.eq('walkId', args.walkId))
      .order('asc')
      .collect();

    const clean = all.filter((p) => p.isClean === true);
    const points = clean.length > 0 ? clean : all;

    return points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.timestamp,
      ...(p.altitudeMetres !== undefined ? { altitudeMetres: p.altitudeMetres } : {}),
    }));
  },
});
