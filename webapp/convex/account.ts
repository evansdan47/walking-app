import type { Doc } from './_generated/dataModel';
import { mutation } from './_generated/server';
import { requireAdmin } from './authHelpers';
import { BADGE_DEFINITION_SEEDS } from './badgeDefinitionsSeed';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SUBSCRIPTION,
  resolveUserPreferences,
} from './userAccountCore';

/** Admin: seed or refresh badge definitions from code catalogue. */
export const adminSeedBadgeDefinitions = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    let inserted = 0;
    let updated = 0;

    for (const seed of BADGE_DEFINITION_SEEDS) {
      const existing = await ctx.db
        .query('badgeDefinitions')
        .withIndex('by_slug', (q) => q.eq('slug', seed.slug))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          category: seed.category,
          label: seed.label,
          description: seed.description,
          sortOrder: seed.sortOrder,
          iconKey: seed.iconKey,
          criteriaType: seed.criteriaType,
          criteriaThreshold: seed.criteriaThreshold,
          isActive: seed.isActive,
        });
        updated++;
      } else {
        await ctx.db.insert('badgeDefinitions', seed);
        inserted++;
      }
    }

    return { inserted, updated };
  },
});

/**
 * Admin: backfill account fields on existing users.
 * - Default `subscription` (beta)
 * - Copy `weightKg` → `preferences.profile.weightKg`
 * - Set `createdAt` / `updatedAt` when missing
 */
export const adminBackfillUsers = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query('users').collect();
    const now = Date.now();
    let patched = 0;

    for (const user of users) {
      const patch: Partial<Doc<'users'>> = {};
      let needsPatch = false;

      if (!user.subscription) {
        patch.subscription = DEFAULT_SUBSCRIPTION;
        needsPatch = true;
      }

      if (user.weightKg !== undefined) {
        const prefs = resolveUserPreferences(user);
        if (prefs.profile?.weightKg !== user.weightKg) {
          patch.preferences = {
            ...prefs,
            profile: { ...prefs.profile, weightKg: user.weightKg },
          };
          needsPatch = true;
        }
      } else if (!user.preferences) {
        patch.preferences = DEFAULT_PREFERENCES;
        needsPatch = true;
      }

      if (user.createdAt === undefined) {
        patch.createdAt = user._creationTime;
        needsPatch = true;
      }
      if (user.updatedAt === undefined) {
        patch.updatedAt = now;
        needsPatch = true;
      }

      if (needsPatch) {
        await ctx.db.patch(user._id, patch);
        patched++;
      }
    }

    return { total: users.length, patched };
  },
});
