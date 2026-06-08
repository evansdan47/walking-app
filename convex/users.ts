import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import type { MobileBuildCheckResult } from "./appReleaseCore";
import {
  buildLoginPatch,
  mobileUpdateFromSync,
  type SessionSyncArgs,
} from "./userSessionCore";

const clientValidator = v.union(v.literal("web"), v.literal("mobile"));
const mobilePlatformValidator = v.union(v.literal("ios"), v.literal("android"));

export type SessionSyncResult = {
  userId: Id<"users">;
  mobileUpdate: MobileBuildCheckResult | null;
};

async function getPolicyForPlatform(
  ctx: Pick<MutationCtx, "db">,
  platform: "ios" | "android",
): Promise<Doc<"mobileReleasePolicies"> | null> {
  return await ctx.db
    .query("mobileReleasePolicies")
    .withIndex("by_platform", (q) => q.eq("platform", platform))
    .unique();
}

async function syncCurrentUserHandler(
  ctx: MutationCtx,
  args: SessionSyncArgs,
): Promise<SessionSyncResult> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const now = Date.now();
  const loginPatch = buildLoginPatch(args, now);
  const resolvedName = args.name ?? identity.name;
  const resolvedEmail = args.email ?? identity.email;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  let userId: Id<"users">;

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
      ...(resolvedEmail !== undefined ? { email: resolvedEmail } : {}),
      ...loginPatch,
    });
    userId = existing._id;
  } else {
    userId = await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
      ...(resolvedEmail !== undefined ? { email: resolvedEmail } : {}),
      ...loginPatch,
    });
  }

  let mobileUpdate: MobileBuildCheckResult | null = null;
  if (args.client === "mobile" && args.mobileBuild !== undefined && args.mobilePlatform) {
    const policy = await getPolicyForPlatform(ctx, args.mobilePlatform);
    mobileUpdate = mobileUpdateFromSync(args, policy);
  }

  return { userId, mobileUpdate };
}

/**
 * Creates or updates the current user's record and records last login per client.
 * Called after Clerk sign-in from web or mobile.
 */
export const upsertCurrentUser = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    client: v.optional(clientValidator),
    mobileBuild: v.optional(v.number()),
    mobileVersion: v.optional(v.string()),
    mobilePlatform: v.optional(mobilePlatformValidator),
    webAppVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => syncCurrentUserHandler(ctx, args),
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
        q.eq("tokenIdentifier", identity.tokenIdentifier),
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
        q.eq("tokenIdentifier", identity.tokenIdentifier),
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
        q.eq("tokenIdentifier", identity.tokenIdentifier),
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
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!existing) throw new Error("User not found");

    await ctx.db.patch(existing._id, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.weightKg !== undefined ? { weightKg: args.weightKg } : {}),
    });
  },
});
