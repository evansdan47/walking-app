import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

/**
 * Creates or updates the current user's record in the users table.
 * Called once from the app shortly after sign-in is confirmed.
 * Uses tokenIdentifier as the stable identity key (not subject alone).
 */
export const upsertCurrentUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (existing) {
      // Update name/email if they have changed
      const resolvedName = args.name ?? identity.name ?? existing.name;
      const resolvedEmail = args.email ?? identity.email ?? existing.email;
      await ctx.db.patch(existing._id, {
        ...(resolvedName !== undefined ? { name: resolvedName } : {}),
        ...(resolvedEmail !== undefined ? { email: resolvedEmail } : {}),
      });
      return existing._id;
    }

    const insertName = args.name ?? identity.name ?? undefined;
    const insertEmail = args.email ?? identity.email ?? undefined;
    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      ...(insertName !== undefined ? { name: insertName } : {}),
      ...(insertEmail !== undefined ? { email: insertEmail } : {}),
    });
  },
});

/**
 * Returns the current authenticated user document, or null if not signed in.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
  },
});

/**
 * Returns the current user's map feature flags, or null if not authenticated.
 */
export const getMapFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) return null;

    return {
      map3d: user.map3d ?? false,
      mapCompass: user.mapCompass ?? false,
      mapLocationInfo: user.mapLocationInfo ?? false,
    };
  },
});

/**
 * Sets one or more of the current user's map feature flags.
 * Only supplied fields are updated; omitted fields retain their existing values.
 */
export const setMapFeatureFlags = mutation({
  args: {
    map3d: v.optional(v.boolean()),
    mapCompass: v.optional(v.boolean()),
    mapLocationInfo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      ...(args.map3d !== undefined ? { map3d: args.map3d } : {}),
      ...(args.mapCompass !== undefined ? { mapCompass: args.mapCompass } : {}),
      ...(args.mapLocationInfo !== undefined ? { mapLocationInfo: args.mapLocationInfo } : {}),
    });
  },
});

/**
 * Updates the current user's profile fields (name, weightKg).
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    weightKg: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    if (!existing) throw new Error("User not found");

    await ctx.db.patch(existing._id, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.weightKg !== undefined ? { weightKg: args.weightKg } : {}),
    });
  },
});
