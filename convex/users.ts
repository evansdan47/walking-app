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
