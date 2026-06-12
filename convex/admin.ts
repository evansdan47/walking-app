import { query } from './_generated/server';
import { requireAdmin } from './authHelpers';
import { resolveBadgeDefinition } from './badgeEngine/resolveDefinition';

/** Dashboard stats for each admin section. */
export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [
      categories,
      definitions,
      unlocks,
      releasePolicies,
      experimentConfigs,
      tagDefinitions,
      users,
    ] = await Promise.all([
      ctx.db.query('badgeCategories').collect(),
      ctx.db.query('badgeDefinitions').collect(),
      ctx.db.query('userBadges').collect(),
      ctx.db.query('mobileReleasePolicies').collect(),
      ctx.db.query('experimentConfigs').collect(),
      ctx.db.query('tagDefinitions').collect(),
      ctx.db.query('users').collect(),
    ]);

    const activeBadges = definitions.filter((d) => d.isActive).length;
    const enabledExperiments = experimentConfigs.filter((e) => e.enabled).length;
    const activeTags = tagDefinitions.filter((t) => t.isActive).length;

    const unlocksByBadge = new Map<string, number>();
    for (const unlock of unlocks) {
      const key = unlock.badgeKey ?? unlock.badgeId.toString();
      unlocksByBadge.set(key, (unlocksByBadge.get(key) ?? 0) + 1);
    }

    let topBadge: { key: string; name: string; unlockCount: number } | null = null;
    for (const def of definitions) {
      const resolved = resolveBadgeDefinition(def);
      const count = unlocksByBadge.get(resolved.key) ?? 0;
      if (!topBadge || count > topBadge.unlockCount) {
        topBadge = { key: resolved.key, name: resolved.name, unlockCount: count };
      }
    }

    return {
      badges: {
        categoryCount: categories.length,
        definitionCount: definitions.length,
        activeDefinitionCount: activeBadges,
        totalUnlocks: unlocks.length,
        topBadge,
      },
      releases: {
        policyCount: releasePolicies.length,
        platforms: releasePolicies.map((p) => ({
          platform: p.platform,
          minimumBuild: p.minimumBuild,
          latestBuild: p.latestBuild,
        })),
      },
      experiments: {
        configCount: experimentConfigs.length,
        enabledCount: enabledExperiments,
        keys: experimentConfigs.map((e) => ({ key: e.key, enabled: e.enabled })),
      },
      tags: {
        definitionCount: tagDefinitions.length,
        activeCount: activeTags,
      },
      users: {
        totalCount: users.length,
        adminCount: users.filter((u) => u.isAdmin === true).length,
      },
    };
  },
});
