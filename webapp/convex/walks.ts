import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, type MutationCtx, query, type QueryCtx } from './_generated/server';

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

function downsampleRouteCoordinates(
  points: Array<{ longitude: number; latitude: number }>,
  maxPoints = 80,
): Array<[number, number]> {
  if (points.length === 0) return [];
  if (points.length <= maxPoints) {
    return points.map((p) => [p.longitude, p.latitude]);
  }
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled: Array<[number, number]> = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(points.length - 1, Math.round(i * step));
    const p = points[idx]!;
    sampled.push([p.longitude, p.latitude]);
  }
  return sampled;
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
    plannedRouteId: v.optional(v.id('plannedRoutes')),
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
      ...(args.plannedRouteId !== undefined ? { plannedRouteId: args.plannedRouteId } : {}),
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
    plannedRouteId: v.optional(v.id('plannedRoutes')),
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
      ...(args.plannedRouteId !== undefined ? { plannedRouteId: args.plannedRouteId } : {}),
    });
  },
});

/** Tagging prompt state for a single walk (web + mobile). */
export const getForTagging = query({
  args: { walkId: v.id('walks') },
  handler: async (ctx, { walkId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    const walk = await ctx.db.get(walkId);
    if (!walk || walk.userId !== user._id) return null;

    return {
      walkId,
      status: walk.status,
      plannedRouteId: walk.plannedRouteId,
      taggingCompletedAt: walk.taggingCompletedAt,
      taggingSkipped: walk.taggingSkipped ?? false,
    };
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
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();
  },
});

/**
 * Completed walks of a planned route for the current user — explore panel history,
 * photos, and stats table.
 */
export const getRouteWalkHistory = query({
  args: { plannedRouteId: v.id('plannedRoutes') },
  handler: async (ctx, { plannedRouteId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) return null;

    const routeWalks = await ctx.db
      .query('walks')
      .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', plannedRouteId))
      .collect();

    const walks = routeWalks
      .filter((w) => w.userId === user._id && w.status === 'completed')
      .sort((a, b) => b.startedAt - a.startedAt);

    if (walks.length === 0) return null;

    const walkSummaries: Array<{
      walkId: Id<'walks'>;
      startedAt: number;
      endedAt: number | null;
      title: string | null;
      stats: {
        distanceMetres: number;
        durationSeconds: number;
        movingTimeSeconds: number;
        avgPaceSecsPerKm: number | null;
        elevationGainMetres: number | null;
      } | null;
    }> = [];

    const photos: Array<{
      _id: Id<'walkPhotos'>;
      walkId: Id<'walks'>;
      timestamp: number;
      url: string | null;
    }> = [];

    for (const walk of walks) {
      walkSummaries.push({
        walkId: walk._id,
        startedAt: walk.startedAt,
        endedAt: walk.endedAt ?? null,
        title: walk.title ?? null,
        stats: walk.stats
          ? {
              distanceMetres: walk.stats.distanceMetres,
              durationSeconds: walk.stats.durationSeconds,
              movingTimeSeconds: walk.stats.movingTimeSeconds,
              avgPaceSecsPerKm: walk.stats.avgPaceSecsPerKm ?? null,
              elevationGainMetres: walk.stats.elevationGainMetres ?? null,
            }
          : null,
      });

      const walkPhotos = await ctx.db
        .query('walkPhotos')
        .withIndex('by_walkId_and_timestamp', (q) => q.eq('walkId', walk._id))
        .collect();
      for (const photo of walkPhotos) {
        photos.push({
          _id: photo._id,
          walkId: walk._id,
          timestamp: photo.timestamp,
          url: await ctx.storage.getUrl(photo.storageId),
        });
      }
    }

    photos.sort((a, b) => b.timestamp - a.timestamp);

    return {
      walkCount: walks.length,
      lastWalkedAt: walks[0]!.startedAt,
      walks: walkSummaries,
      photos,
      totalPhotos: photos.length,
    };
  },
});

/** Photo previews + route shape coords for activity list cards. */
export const getCardEnrichment = query({
  args: { walkIds: v.array(v.id('walks')) },
  handler: async (ctx, { walkIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const items: Array<{
      walkId: Id<'walks'>;
      totalPhotos: number;
      photos: Array<{
        _id: Id<'walkPhotos'>;
        timestamp: number;
        url: string | null;
      }>;
      routeCoordinates: Array<[number, number]>;
    }> = [];

    for (const walkId of walkIds) {
      const walk = await ctx.db.get(walkId);
      if (!walk || walk.userId.toString() !== user._id.toString()) continue;

      const allPhotos = await ctx.db
        .query('walkPhotos')
        .withIndex('by_walkId_and_timestamp', (q) => q.eq('walkId', walkId))
        .collect();
      const previewPhotos = await Promise.all(
        allPhotos.slice(0, 4).map(async (photo) => ({
          _id: photo._id,
          timestamp: photo.timestamp,
          url: await ctx.storage.getUrl(photo.storageId),
        })),
      );

      const trackPoints = await ctx.db
        .query('trackPoints')
        .withIndex('by_walkId_and_timestamp', (q) => q.eq('walkId', walkId))
        .order('asc')
        .collect();
      const clean = trackPoints.filter((p) => p.isClean === true);
      const routePoints = (clean.length > 0 ? clean : trackPoints).map((p) => ({
        longitude: p.longitude,
        latitude: p.latitude,
      }));

      items.push({
        walkId,
        totalPhotos: allPhotos.length,
        photos: previewPhotos,
        routeCoordinates: downsampleRouteCoordinates(routePoints, 80),
      });
    }

    return items;
  },
});

/** Permanently delete a walk and its associated track points, photos, and sync jobs. */
export const remove = mutation({
  args: { walkId: v.id('walks') },
  handler: async (ctx, { walkId }) => {
    const user = await getAuthUser(ctx);
    const walk = await ctx.db.get(walkId);
    if (!walk || walk.userId.toString() !== user._id.toString()) {
      throw new Error('Forbidden');
    }

    const trackPoints = await ctx.db
      .query('trackPoints')
      .withIndex('by_walkId', (q) => q.eq('walkId', walkId))
      .collect();
    for (const point of trackPoints) {
      await ctx.db.delete(point._id);
    }

    const photos = await ctx.db
      .query('walkPhotos')
      .withIndex('by_walkId', (q) => q.eq('walkId', walkId))
      .collect();
    for (const photo of photos) {
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
    }

    const syncJobs = await ctx.db
      .query('syncJobs')
      .withIndex('by_walkId', (q) => q.eq('walkId', walkId))
      .collect();
    for (const job of syncJobs) {
      await ctx.db.delete(job._id);
    }

    await ctx.db.delete(walkId);
    return { walkId };
  },
});
