import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const pointValidator = v.object({
  lng: v.number(),
  lat: v.number(),
  isControlPoint: v.optional(v.boolean()),
  isSnapped: v.optional(v.boolean()),
});

const legValidator = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  points: v.array(pointValidator),
});

const visibilityValidator = v.union(
  v.literal('private'),
  v.literal('shared'),
  v.literal('public'),
);

/**
 * Save a planned route for the currently authenticated user.
 * New routes default to "private".
 */
export const save = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    legs: v.array(legValidator),
    stats: v.optional(
      v.object({
        distanceKm: v.number(),
        elevationGainM: v.number(),
      }),
    ),
    visibility: v.optional(visibilityValidator),
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

    return await ctx.db.insert('plannedRoutes', {
      userId: user._id,
      authorId: user._id,
      visibility: args.visibility ?? 'private',
      title: args.title.trim(),
      createdAt: Date.now(),
      legs: args.legs,
      ...(args.description?.trim() ? { description: args.description.trim() } : {}),
      ...(args.stats !== undefined ? { stats: args.stats } : {}),
    });
  },
});

/**
 * List all planned routes for the currently authenticated user, newest first.
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
      .query('plannedRoutes')
      .withIndex('by_userId_and_createdAt', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect();
  },
});

/**
 * Return all planned routes visible within the given map viewport bounds.
 *
 * Visibility rules:
 *   - "public" routes are returned to everyone.
 *   - Legacy rows with no `visibility` field are treated as "public" for
 *     back-compat.
 *   - The authenticated user's own routes are always included (so they can
 *     see their private walks on the map while logged in).
 *   - "private" routes belonging to other users are excluded.
 *   - "shared" is reserved for future group-based sharing; currently treated
 *     the same as "private" (only owner sees it).
 */
export const listWithinBounds = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, { minLat, maxLat, minLng, maxLng }) => {
    // Resolve the calling user (may be unauthenticated)
    const identity = await ctx.auth.getUserIdentity();
    let currentUserId: string | null = null;
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', identity.tokenIdentifier),
        )
        .unique();
      currentUserId = user?._id ?? null;
    }

    const all = await ctx.db.query('plannedRoutes').collect();

    return all.filter((route) => {
      // Visibility gate: public (or legacy null) is open to all; private/shared
      // only visible to the owner.
      const vis = route.visibility ?? 'public';
      const isOwner = currentUserId !== null && route.userId === currentUserId;
      if (vis !== 'public' && !isOwner) return false;

      // Spatial filter: at least one point must fall within the viewport.
      for (const leg of route.legs) {
        for (const pt of leg.points) {
          if (
            pt.lat >= minLat && pt.lat <= maxLat &&
            pt.lng >= minLng && pt.lng <= maxLng
          ) {
            return true;
          }
        }
      }
      return false;
    });
  },
});

/**
 * Same as listWithinBounds but enriches each route with its author's display
 * name. Used by the Explore overlay to show who created the route.
 */
export const listWithinBoundsWithAuthors = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, bounds) => {
    // Re-use the same visibility + spatial logic
    const identity = await ctx.auth.getUserIdentity();
    let currentUserId: string | null = null;
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', identity.tokenIdentifier),
        )
        .unique();
      currentUserId = user?._id ?? null;
    }

    const all = await ctx.db.query('plannedRoutes').collect();
    const { minLat, maxLat, minLng, maxLng } = bounds;

    const visible = all.filter((route) => {
      const vis = route.visibility ?? 'public';
      const isOwner = currentUserId !== null && route.userId === currentUserId;
      if (vis !== 'public' && !isOwner) return false;
      for (const leg of route.legs) {
        for (const pt of leg.points) {
          if (
            pt.lat >= minLat && pt.lat <= maxLat &&
            pt.lng >= minLng && pt.lng <= maxLng
          ) return true;
        }
      }
      return false;
    });

    // Batch-load unique authors
    const authorIds = [...new Set(visible.map((r) => r.authorId ?? r.userId))];
    const authorDocs = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const authorMap = new Map(
      authorDocs
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .map((d) => [d._id, d.name ?? 'Unknown']),
    );

    return visible.map((route) => ({
      ...route,
      authorName: authorMap.get(route.authorId ?? route.userId) ?? 'Unknown',
      // Normalise: legacy rows without visibility are treated as public
      visibility: route.visibility ?? 'public',
      // Lets the client show Edit button without a separate auth query
      isOwner: currentUserId !== null && route.userId === currentUserId,
    }));
  },
});

/**
 * Return up to `limit` planned routes whose centroid is nearest to the given
 * centre coordinate, applying the same visibility rules as listWithinBounds.
 *
 * Used by the Explore sheet to show fallback results when the current viewport
 * contains fewer than 5 routes.
 */
export const listNearest = query({
  args: {
    centerLat: v.number(),
    centerLng: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, { centerLat, centerLng, limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    let currentUserId: string | null = null;
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_tokenIdentifier', (q) =>
          q.eq('tokenIdentifier', identity.tokenIdentifier),
        )
        .unique();
      currentUserId = user?._id ?? null;
    }

    const all = await ctx.db.query('plannedRoutes').collect();

    // Apply the same visibility gate as listWithinBounds
    const visible = all.filter((route) => {
      const vis = route.visibility ?? 'public';
      const isOwner = currentUserId !== null && route.userId === currentUserId;
      return vis === 'public' || isOwner;
    });

    // Compute the distance from each route's bounding-box centre to the map centre
    const R = 6371;
    const withDist = visible.map((route) => {
      const allPts = route.legs.flatMap((l) => l.points);
      if (allPts.length === 0) return { route, distKm: Infinity };
      let minLat = allPts[0]!.lat, maxLat = allPts[0]!.lat;
      let minLng = allPts[0]!.lng, maxLng = allPts[0]!.lng;
      for (const pt of allPts) {
        if (pt.lat < minLat) minLat = pt.lat;
        if (pt.lat > maxLat) maxLat = pt.lat;
        if (pt.lng < minLng) minLng = pt.lng;
        if (pt.lng > maxLng) maxLng = pt.lng;
      }
      const rLat = (minLat + maxLat) / 2;
      const rLng = (minLng + maxLng) / 2;
      const φ1 = (centerLat * Math.PI) / 180;
      const φ2 = (rLat * Math.PI) / 180;
      const dφ = ((rLat - centerLat) * Math.PI) / 180;
      const dλ = ((rLng - centerLng) * Math.PI) / 180;
      const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { route, distKm };
    });

    withDist.sort((a, b) => a.distKm - b.distKm);
    return withDist.slice(0, limit).map((x) => x.route);
  },
});

/**
 * Update an existing planned route. Only the route owner or an admin user may
 * call this. The authorId and userId fields are preserved unchanged.
 */
export const update = mutation({
  args: {
    id: v.id('plannedRoutes'),
    title: v.string(),
    description: v.optional(v.string()),
    legs: v.array(legValidator),
    stats: v.optional(
      v.object({
        distanceKm: v.number(),
        elevationGainM: v.number(),
      }),
    ),
    visibility: v.optional(visibilityValidator),
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

    const route = await ctx.db.get(args.id);
    if (!route) throw new Error('Route not found');
    if (route.userId !== user._id && user.isAdmin !== true) {
      throw new Error('Not authorised to edit this route');
    }

    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      legs: args.legs,
      ...(args.description?.trim() ? { description: args.description.trim() } : { description: undefined }),
      ...(args.stats !== undefined ? { stats: args.stats } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
    });

    return args.id;
  },
});
