import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ── Shared validators ────────────────────────────────────────────────────────

const placeTypeValidator = v.union(
  v.literal('landmark'),
  v.literal('viewpoint'),
  v.literal('food_drink'),
  v.literal('parking'),
  v.literal('toilet'),
  v.literal('facility'),
  v.literal('hazard'),
  v.literal('wildlife'),
  v.literal('nature_reserve'),
  v.literal('navigation'),
  v.literal('accommodation'),
);

const placeRoleValidator = v.union(
  v.literal('start'),
  v.literal('end'),
  v.literal('nearby'),
  v.literal('highlight'),
  v.literal('refreshment_stop'),
  v.literal('warning'),
  v.literal('navigation_cue'),
);

const placeVisibilityValidator = v.union(
  v.literal('private'),
  v.literal('community'),
  v.literal('public'),
);

// ── Helper: resolve authenticated user (throws if unauthenticated) ───────────

async function requireUser(ctx: { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q: any) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error('User not found');
  return user;
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create a new place / POI.
 *
 * Called from the planner's AddPoiForm after the user fills in the
 * type-specific form and clicks "Add POI". Returns the new place id.
 *
 * `status` is derived from `visibility`:
 *   private   → draft   (only shown to the creating user)
 *   community → published (enters the community confirmation pool)
 *   public    → published (admin / import path; same result)
 */
export const createPlace = mutation({
  args: {
    type: placeTypeValidator,
    visibility: placeVisibilityValidator,
    name: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const status = args.visibility === 'private' ? 'draft' : 'published';

    return await ctx.db.insert('places', {
      type: args.type,
      status,
      source: 'planner_user',
      visibility: args.visibility,
      latitude: args.latitude,
      longitude: args.longitude,
      verificationStatus: 'unverified',
      confirmationCount: 0,
      rejectionCount: 0,
      confidenceScore: 0,
      createdByUserId: user._id,
      createdAt: now,
      updatedAt: now,
      ...(args.name?.trim() ? { name: args.name.trim() } : {}),
      ...(args.shortDescription?.trim() ? { shortDescription: args.shortDescription.trim() } : {}),
      ...(args.details !== undefined ? { details: args.details } : {}),
    });
  },
});

/**
 * Link an existing place to a planned route.
 *
 * Called after `createPlace` (or when adding an existing community POI to
 * a route). Returns the new plannedRoutePlaces row id.
 */
export const linkToPlannedRoute = mutation({
  args: {
    plannedRouteId: v.id('plannedRoutes'),
    placeId: v.id('places'),
    order: v.optional(v.number()),
    distanceFromStartMetres: v.optional(v.number()),
    role: v.optional(placeRoleValidator),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db.insert('plannedRoutePlaces', {
      plannedRouteId: args.plannedRouteId,
      placeId: args.placeId,
      createdAt: Date.now(),
      ...(args.order !== undefined ? { order: args.order } : {}),
      ...(args.distanceFromStartMetres !== undefined ? { distanceFromStartMetres: args.distanceFromStartMetres } : {}),
      ...(args.role ? { role: args.role } : {}),
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    });
  },
});

/**
 * Remove a POI link from a planned route.
 *
 * If the place was `private` and this was its only link, it is archived
 * so it no longer pollutes the user's community pool.
 */
export const removeFromPlannedRoute = mutation({
  args: {
    plannedRoutePlaceId: v.id('plannedRoutePlaces'),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const link = await ctx.db.get(args.plannedRoutePlaceId);
    if (!link) throw new Error('Link not found');

    await ctx.db.delete(args.plannedRoutePlaceId);

    // Archive private places that are no longer referenced
    const place = await ctx.db.get(link.placeId);
    if (place && place.visibility === 'private') {
      const remaining = await ctx.db
        .query('plannedRoutePlaces')
        .withIndex('by_placeId', (q: any) => q.eq('placeId', link.placeId))
        .first();
      if (!remaining) {
        await ctx.db.patch(link.placeId, { status: 'archived', updatedAt: Date.now() });
      }
    }
  },
});

/**
 * Record a community confirmation / rejection for a place.
 *
 * Prevents double-voting by checking the by_placeId_and_userId index.
 * After each vote, recomputes confidenceScore and may auto-advance
 * verificationStatus:
 *   ≥ 3 confirmations + score ≥ 0.7 → community_confirmed
 *   ≥ 3 rejections   + score ≤ 0.3 → rejected
 */
export const confirmPlace = mutation({
  args: {
    placeId: v.id('places'),
    response: v.union(
      v.literal('confirmed'),
      v.literal('not_found'),
      v.literal('wrong_type'),
      v.literal('duplicate'),
      v.literal('closed'),
      v.literal('unsafe'),
      v.literal('spam'),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Guard: one response per user per place
    const existing = await ctx.db
      .query('placeConfirmations')
      .withIndex('by_placeId_and_userId', (q: any) =>
        q.eq('placeId', args.placeId).eq('userId', user._id),
      )
      .first();
    if (existing) throw new Error('You have already responded to this place');

    await ctx.db.insert('placeConfirmations', {
      placeId: args.placeId,
      userId: user._id,
      response: args.response,
      createdAt: Date.now(),
      ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    });

    // Recount from the source-of-truth rows
    const all = await ctx.db
      .query('placeConfirmations')
      .withIndex('by_placeId', (q: any) => q.eq('placeId', args.placeId))
      .collect();

    const confirmationCount = all.filter((r: any) => r.response === 'confirmed').length;
    const rejectionCount = all.filter((r: any) =>
      ['not_found', 'wrong_type', 'duplicate', 'closed', 'unsafe', 'spam'].includes(r.response),
    ).length;
    const total = confirmationCount + rejectionCount;
    const confidenceScore = total > 0 ? confirmationCount / total : 0;

    let verificationStatus: string | undefined;
    if (confirmationCount >= 3 && confidenceScore >= 0.7) {
      verificationStatus = 'community_confirmed';
    } else if (rejectionCount >= 3 && confidenceScore <= 0.3) {
      verificationStatus = 'rejected';
    } else if (total > 0) {
      verificationStatus = 'community_reported';
    }

    await ctx.db.patch(args.placeId, {
      confirmationCount,
      rejectionCount,
      confidenceScore,
      updatedAt: Date.now(),
      ...(verificationStatus ? { verificationStatus } : {}),
    });
  },
});

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return all places linked to a planned route, joined with the place
 * document, ordered by `order` (nulls last).
 */
export const getByPlannedRoute = query({
  args: {
    plannedRouteId: v.id('plannedRoutes'),
  },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query('plannedRoutePlaces')
      .withIndex('by_plannedRouteId', (q: any) =>
        q.eq('plannedRouteId', args.plannedRouteId),
      )
      .collect();

    const enriched = await Promise.all(
      links.map(async (link: any) => {
        const place = await ctx.db.get(link.placeId);
        return place ? { ...link, place } : null;
      }),
    );

    return enriched
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        const ao = a.order ?? Infinity;
        const bo = b.order ?? Infinity;
        return ao - bo;
      });
  },
});

/**
 * Return published places whose coordinates fall within the given
 * bounding box and match at least one of the requested visibilities.
 *
 * Used by the planner sidebar to suggest nearby POIs and by the
 * explore map to render community POIs.
 */
export const getNearBbox = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
    visibilities: v.array(placeVisibilityValidator),
  },
  handler: async (ctx, args) => {
    const { minLat, maxLat, minLng, maxLng, visibilities } = args;

    // Scan published places then filter client-side. At scale, replace
    // this with a geohash-prefix index.
    const published = await ctx.db
      .query('places')
      .withIndex('by_status', (q: any) => q.eq('status', 'published'))
      .collect();

    return published.filter(
      (p: any) =>
        visibilities.includes(p.visibility) &&
        p.latitude >= minLat && p.latitude <= maxLat &&
        p.longitude >= minLng && p.longitude <= maxLng,
    );
  },
});
