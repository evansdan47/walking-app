import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { mutation, query } from './_generated/server';
import { requireAdmin } from './authHelpers';
import {
  evaluateMobileBuild,
  MOBILE_RELEASE_POLICY_SEEDS,
  type MobileBuildCheckResult,
} from './appReleaseCore';

const mobilePlatformValidator = v.union(v.literal('ios'), v.literal('android'));

type DbCtx = Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>;

async function getPolicyForPlatform(
  ctx: DbCtx,
  platform: 'ios' | 'android',
): Promise<Doc<'mobileReleasePolicies'> | null> {
  return await ctx.db
    .query('mobileReleasePolicies')
    .withIndex('by_platform', (q) => q.eq('platform', platform))
    .unique();
}

/** Public — called on mobile app start (no auth required). */
export const checkMobileBuild = query({
  args: {
    platform: mobilePlatformValidator,
    build: v.number(),
  },
  handler: async (ctx, args): Promise<MobileBuildCheckResult> => {
    const policy = await getPolicyForPlatform(ctx, args.platform);
    return evaluateMobileBuild(args.build, policy);
  },
});

/** Admin: seed default per-platform release policies (safe defaults — no enforcement until builds are set). */
export const adminSeedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const seed of MOBILE_RELEASE_POLICY_SEEDS) {
      const existing = await ctx.db
        .query('mobileReleasePolicies')
        .withIndex('by_platform', (q) => q.eq('platform', seed.platform))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          storeUrl: seed.storeUrl,
          optionalUpdateMessage: seed.optionalUpdateMessage,
          requiredUpdateMessage: seed.requiredUpdateMessage,
          updatedAt: now,
          updatedByUserId: admin._id,
        });
        updated++;
      } else {
        await ctx.db.insert('mobileReleasePolicies', {
          ...seed,
          updatedAt: now,
          updatedByUserId: admin._id,
        });
        inserted++;
      }
    }

    return { inserted, updated };
  },
});

/** Admin: set minimum / latest build thresholds and store URL for a platform. */
export const adminUpdatePolicy = mutation({
  args: {
    platform: mobilePlatformValidator,
    minimumBuild: v.optional(v.number()),
    latestBuild: v.optional(v.number()),
    storeUrl: v.optional(v.string()),
    optionalUpdateMessage: v.optional(v.string()),
    requiredUpdateMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await getPolicyForPlatform(ctx, args.platform);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.minimumBuild !== undefined ? { minimumBuild: args.minimumBuild } : {}),
        ...(args.latestBuild !== undefined ? { latestBuild: args.latestBuild } : {}),
        ...(args.storeUrl !== undefined ? { storeUrl: args.storeUrl } : {}),
        ...(args.optionalUpdateMessage !== undefined
          ? { optionalUpdateMessage: args.optionalUpdateMessage }
          : {}),
        ...(args.requiredUpdateMessage !== undefined
          ? { requiredUpdateMessage: args.requiredUpdateMessage }
          : {}),
        updatedAt: now,
        updatedByUserId: admin._id,
      });
      return existing._id;
    }

    const seed = MOBILE_RELEASE_POLICY_SEEDS.find((s) => s.platform === args.platform);
    if (!seed) throw new Error(`Unknown platform: ${args.platform}`);

    return await ctx.db.insert('mobileReleasePolicies', {
      platform: args.platform,
      minimumBuild: args.minimumBuild ?? seed.minimumBuild,
      latestBuild: args.latestBuild ?? seed.latestBuild,
      storeUrl: args.storeUrl ?? seed.storeUrl,
      optionalUpdateMessage: args.optionalUpdateMessage ?? seed.optionalUpdateMessage,
      requiredUpdateMessage: args.requiredUpdateMessage ?? seed.requiredUpdateMessage,
      updatedAt: now,
      updatedByUserId: admin._id,
    });
  },
});
