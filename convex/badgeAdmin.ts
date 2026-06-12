import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireAdmin } from './authHelpers';
import { BADGE_CATEGORY_SEEDS } from './badgeCategoriesSeed';
import { evaluateRule } from './badgeEngine/ruleEvaluators';
import { resolveBadgeDefinition } from './badgeEngine/resolveDefinition';
import { loadUserBadgeContext } from './badgeEngine/userContext';
import { BADGE_DEFINITION_SEEDS } from './badgeDefinitionsSeed';
import {
  criteriaToRuleConfig,
  criteriaTypeToRuleType,
  type BadgeRuleType,
} from './badgeRuleValidators';
import {
  BADGE_UI_SETTINGS_KEY,
  loadBadgeUiSettings,
} from './badgeUiSettings';
import {
  badgeNewShineEffectValidator,
  badgeRuleTypeValidator,
  badgeTierValidator,
} from './userValidators';

function ruleTypeToCriteriaType(ruleType: BadgeRuleType): Doc<'badgeDefinitions'>['criteriaType'] {
  switch (ruleType) {
    case 'total_distance':
      return 'total_distance_m';
    case 'single_walk_distance':
      return 'single_walk_distance_m';
    case 'total_elevation_gain':
      return 'total_elevation_gain_m';
    default:
      return ruleType as Doc<'badgeDefinitions'>['criteriaType'];
  }
}

function ruleConfigToThreshold(
  ruleType: BadgeRuleType,
  ruleConfig: Record<string, unknown>,
): number | undefined {
  if (
    ruleType === 'total_distance' ||
    ruleType === 'single_walk_distance' ||
    ruleType === 'total_elevation_gain'
  ) {
    return typeof ruleConfig.targetMetres === 'number' ? ruleConfig.targetMetres : undefined;
  }
  if (typeof ruleConfig.target === 'number') return ruleConfig.target;
  return undefined;
}

function validateRuleConfig(ruleType: BadgeRuleType, ruleConfig: unknown): Record<string, unknown> {
  if (typeof ruleConfig !== 'object' || ruleConfig === null || Array.isArray(ruleConfig)) {
    throw new Error('ruleConfig must be an object');
  }
  const config = { ...(ruleConfig as Record<string, unknown>) };

  switch (ruleType) {
    case 'walk_count':
    case 'planned_route_count':
      if (typeof config.target !== 'number' || config.target < 1) {
        throw new Error('ruleConfig.target must be a positive number');
      }
      break;
    case 'total_distance':
    case 'single_walk_distance':
    case 'total_elevation_gain':
      if (typeof config.targetMetres !== 'number' || config.targetMetres < 1) {
        throw new Error('ruleConfig.targetMetres must be a positive number');
      }
      break;
    case 'walk_on_weekend':
      if (typeof config.target !== 'number' || config.target < 1) {
        throw new Error('ruleConfig.target must be a positive number');
      }
      break;
    default:
      break;
  }

  return config;
}

function buildLegacyBadgeFields(args: {
  key: string;
  categoryKey: string;
  name: string;
  description: string;
  icon: string;
  ruleType: BadgeRuleType;
  ruleConfig: Record<string, unknown>;
  displayOrder: number;
  isActive: boolean;
}): Omit<Doc<'badgeDefinitions'>, '_id' | '_creationTime'> {
  return {
    slug: args.key,
    category: args.categoryKey as Doc<'badgeDefinitions'>['category'],
    label: args.name,
    description: args.description,
    sortOrder: args.displayOrder,
    iconKey: args.icon,
    criteriaType: ruleTypeToCriteriaType(args.ruleType),
    criteriaThreshold: ruleConfigToThreshold(args.ruleType, args.ruleConfig),
    isActive: args.isActive,
    key: args.key,
    categoryKey: args.categoryKey,
    name: args.name,
    icon: args.icon,
    ruleType: args.ruleType,
    ruleConfig: args.ruleConfig,
    displayOrder: args.displayOrder,
  };
}

/** Admin: seed or refresh the 10 badge categories from code catalogue. */
export const seedCategories = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const seed of BADGE_CATEGORY_SEEDS) {
      const existing = await ctx.db
        .query('badgeCategories')
        .withIndex('by_key', (q) => q.eq('key', seed.key))
        .unique();

      const row = {
        ...seed,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        updated++;
      } else {
        await ctx.db.insert('badgeCategories', row);
        inserted++;
      }
    }

    return { inserted, updated };
  },
});

/** Admin: seed or refresh badge definitions from code catalogue. */
export const seedBadgesFromFile = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const seed of BADGE_DEFINITION_SEEDS) {
      const existing =
        (await ctx.db
          .query('badgeDefinitions')
          .withIndex('by_key', (q) => q.eq('key', seed.key))
          .unique()) ??
        (await ctx.db
          .query('badgeDefinitions')
          .withIndex('by_slug', (q) => q.eq('slug', seed.slug))
          .unique());

      const row = {
        ...seed,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        updated++;
      } else {
        await ctx.db.insert('badgeDefinitions', row);
        inserted++;
      }
    }

    return { inserted, updated, total: BADGE_DEFINITION_SEEDS.length };
  },
});

export const migrateBadgeDefinitionsV2 = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const definitions = await ctx.db.query('badgeDefinitions').collect();
    let migrated = 0;

    for (const doc of definitions) {
      const patch: Partial<Doc<'badgeDefinitions'>> = {};
      let needsPatch = false;

      if (!doc.key) {
        patch.key = doc.slug;
        needsPatch = true;
      }
      if (!doc.categoryKey) {
        patch.categoryKey = doc.category;
        needsPatch = true;
      }
      if (!doc.name) {
        patch.name = doc.label;
        needsPatch = true;
      }
      if (!doc.displayOrder) {
        patch.displayOrder = doc.sortOrder;
        needsPatch = true;
      }
      if (!doc.icon) {
        patch.icon = doc.iconKey;
        needsPatch = true;
      }
      if (!doc.ruleType) {
        patch.ruleType = criteriaTypeToRuleType(doc.criteriaType);
        needsPatch = true;
      }
      if (!doc.ruleConfig) {
        patch.ruleConfig = criteriaToRuleConfig(doc.criteriaType, doc.criteriaThreshold);
        needsPatch = true;
      }
      if (doc.isHiddenUntilUnlocked === undefined) {
        patch.isHiddenUntilUnlocked = false;
        needsPatch = true;
      }
      if (doc.isRepeatable === undefined) {
        patch.isRepeatable = false;
        needsPatch = true;
      }
      if (doc.createdAt === undefined) {
        patch.createdAt = doc._creationTime;
        needsPatch = true;
      }
      if (doc.updatedAt === undefined) {
        patch.updatedAt = now;
        needsPatch = true;
      }

      if (needsPatch) {
        await ctx.db.patch(doc._id, patch);
        migrated++;
      }
    }

    return { total: definitions.length, migrated };
  },
});

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const categories = await ctx.db.query('badgeCategories').collect();
    const definitions = await ctx.db.query('badgeDefinitions').collect();

    return categories
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((cat) => ({
        ...cat,
        badgeCount: definitions.filter(
          (d) => (d.categoryKey ?? d.category) === cat.key,
        ).length,
      }));
  },
});

export const listBadgeDefinitions = query({
  args: {
    search: v.optional(v.string()),
    categoryKey: v.optional(v.string()),
    ruleType: v.optional(badgeRuleTypeValidator),
    tier: v.optional(badgeTierValidator),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [definitions, categories, unlocks] = await Promise.all([
      ctx.db.query('badgeDefinitions').collect(),
      ctx.db.query('badgeCategories').collect(),
      ctx.db.query('userBadges').collect(),
    ]);

    const categoryNames = new Map(categories.map((c) => [c.key, c.name]));
    const unlockCounts = new Map<string, number>();
    for (const unlock of unlocks) {
      unlockCounts.set(
        unlock.badgeId.toString(),
        (unlockCounts.get(unlock.badgeId.toString()) ?? 0) + 1,
      );
    }

    const needle = args.search?.trim().toLowerCase();

    return definitions
      .map((doc) => {
        const def = resolveBadgeDefinition(doc);
        return {
          id: doc._id,
          key: def.key,
          name: def.name,
          categoryKey: def.categoryKey,
          categoryName: categoryNames.get(def.categoryKey) ?? def.categoryKey,
          tier: doc.tier,
          ruleType: def.ruleType,
          ruleConfig: def.ruleConfig,
          isActive: def.isActive,
          displayOrder: doc.displayOrder ?? doc.sortOrder,
          unlockCount: unlockCounts.get(doc._id.toString()) ?? 0,
          updatedAt: doc.updatedAt ?? doc._creationTime,
          icon: doc.icon ?? doc.iconKey ?? 'award',
        };
      })
      .filter((row) => {
        if (args.categoryKey && row.categoryKey !== args.categoryKey) return false;
        if (args.ruleType && row.ruleType !== args.ruleType) return false;
        if (args.tier && row.tier !== args.tier) return false;
        if (args.activeOnly && !row.isActive) return false;
        if (needle) {
          const hay = `${row.key} ${row.name} ${row.categoryName}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.categoryKey !== b.categoryKey) {
          return a.categoryKey.localeCompare(b.categoryKey);
        }
        return a.displayOrder - b.displayOrder;
      });
  },
});

export const getBadgeByKey = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);

    const doc =
      (await ctx.db
        .query('badgeDefinitions')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique()) ??
      (await ctx.db
        .query('badgeDefinitions')
        .withIndex('by_slug', (q) => q.eq('slug', key))
        .unique());

    if (!doc) return null;

    const unlockCount = (
      await ctx.db
        .query('userBadges')
        .withIndex('by_badgeId', (q) => q.eq('badgeId', doc._id))
        .collect()
    ).length;

    const def = resolveBadgeDefinition(doc);
    return {
      id: doc._id,
      key: def.key,
      categoryKey: def.categoryKey,
      name: def.name,
      description: doc.description,
      lockedDescription: doc.lockedDescription,
      icon: doc.icon ?? doc.iconKey ?? 'award',
      tier: doc.tier,
      ruleType: def.ruleType,
      ruleConfig: def.ruleConfig,
      displayOrder: doc.displayOrder ?? doc.sortOrder,
      isActive: def.isActive,
      isHiddenUntilUnlocked: def.isHiddenUntilUnlocked,
      isRepeatable: def.isRepeatable,
      points: doc.points,
      color: doc.color,
      startsAt: doc.startsAt,
      endsAt: doc.endsAt,
      unlockCount,
      createdAt: doc.createdAt ?? doc._creationTime,
      updatedAt: doc.updatedAt ?? doc._creationTime,
    };
  },
});

export const getUnlockStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const definitions = await ctx.db.query('badgeDefinitions').collect();
    const unlocks = await ctx.db.query('userBadges').collect();

    const byBadge = new Map<string, number>();
    for (const unlock of unlocks) {
      byBadge.set(
        unlock.badgeId.toString(),
        (byBadge.get(unlock.badgeId.toString()) ?? 0) + 1,
      );
    }

    return definitions
      .map((doc) => {
        const def = resolveBadgeDefinition(doc);
        return {
          badgeKey: def.key,
          name: def.name,
          unlockCount: byBadge.get(doc._id.toString()) ?? 0,
          isActive: def.isActive,
        };
      })
      .sort((a, b) => b.unlockCount - a.unlockCount);
  },
});

const categoryInputValidator = {
  key: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  color: v.string(),
  icon: v.string(),
  displayOrder: v.number(),
  isActive: v.boolean(),
};

export const upsertCategory = mutation({
  args: categoryInputValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query('badgeCategories')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();

    const row = {
      ...args,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }
    return await ctx.db.insert('badgeCategories', row);
  },
});

const badgeInputValidator = {
  key: v.string(),
  categoryKey: v.string(),
  name: v.string(),
  description: v.string(),
  lockedDescription: v.optional(v.string()),
  icon: v.string(),
  tier: v.optional(badgeTierValidator),
  ruleType: badgeRuleTypeValidator,
  ruleConfig: v.any(),
  displayOrder: v.number(),
  isActive: v.boolean(),
  isHiddenUntilUnlocked: v.optional(v.boolean()),
  isRepeatable: v.optional(v.boolean()),
  points: v.optional(v.number()),
  color: v.optional(v.string()),
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
};

export const upsertBadgeDefinition = mutation({
  args: badgeInputValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const ruleConfig = validateRuleConfig(args.ruleType, args.ruleConfig);

    const existing = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();

    const legacy = buildLegacyBadgeFields({
      key: args.key,
      categoryKey: args.categoryKey,
      name: args.name,
      description: args.description,
      icon: args.icon,
      ruleType: args.ruleType,
      ruleConfig,
      displayOrder: args.displayOrder,
      isActive: args.isActive,
    });

    const row = {
      ...legacy,
      lockedDescription: args.lockedDescription,
      tier: args.tier,
      isHiddenUntilUnlocked: args.isHiddenUntilUnlocked ?? false,
      isRepeatable: args.isRepeatable ?? false,
      points: args.points,
      color: args.color,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...row,
        createdAt: existing.createdAt ?? existing._creationTime,
      });
      return existing._id;
    }

    return await ctx.db.insert('badgeDefinitions', {
      ...row,
      createdAt: now,
    });
  },
});

export const archiveBadge = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    if (!doc) throw new Error('Badge not found');
    await ctx.db.patch(doc._id, { isActive: false, updatedAt: Date.now() });
  },
});

export const reorderBadges = mutation({
  args: {
    categoryKey: v.string(),
    orderedKeys: v.array(v.string()),
  },
  handler: async (ctx, { categoryKey, orderedKeys }) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let updated = 0;

    for (let i = 0; i < orderedKeys.length; i++) {
      const key = orderedKeys[i]!;
      const doc = await ctx.db
        .query('badgeDefinitions')
        .withIndex('by_key', (q) => q.eq('key', key))
        .unique();
      if (!doc) continue;

      const def = resolveBadgeDefinition(doc);
      if (def.categoryKey !== categoryKey) continue;

      const displayOrder = i + 1;
      await ctx.db.patch(doc._id, {
        displayOrder,
        sortOrder: displayOrder,
        updatedAt: now,
      });
      updated++;
    }

    return { updated, total: orderedKeys.length };
  },
});

export const duplicateBadge = mutation({
  args: { key: v.string(), newKey: v.optional(v.string()) },
  handler: async (ctx, { key, newKey }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', key))
      .unique();
    if (!doc) throw new Error('Badge not found');

    const def = resolveBadgeDefinition(doc);
    const copyKey = newKey ?? `${def.key}_copy`;
    const existing = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', copyKey))
      .unique();
    if (existing) throw new Error('Badge key already exists');

    const now = Date.now();
    const legacy = buildLegacyBadgeFields({
      key: copyKey,
      categoryKey: def.categoryKey,
      name: `${def.name} (copy)`,
      description: doc.description,
      icon: doc.icon ?? doc.iconKey ?? 'award',
      ruleType: def.ruleType,
      ruleConfig: def.ruleConfig,
      displayOrder: (doc.displayOrder ?? doc.sortOrder) + 1,
      isActive: false,
    });

    return await ctx.db.insert('badgeDefinitions', {
      ...legacy,
      lockedDescription: doc.lockedDescription,
      tier: doc.tier,
      isHiddenUntilUnlocked: doc.isHiddenUntilUnlocked ?? false,
      isRepeatable: doc.isRepeatable ?? false,
      points: doc.points,
      color: doc.color,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const grantBadgeManual = mutation({
  args: {
    userId: v.id('users'),
    badgeKey: v.string(),
  },
  handler: async (ctx, { userId, badgeKey }) => {
    await requireAdmin(ctx);
    const doc = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', badgeKey))
      .unique();
    if (!doc) throw new Error('Badge not found');

    const existing = await ctx.db
      .query('userBadges')
      .withIndex('by_userId_and_badgeId', (q) =>
        q.eq('userId', userId).eq('badgeId', doc._id),
      )
      .unique();
    if (existing) return { created: false, unlockId: existing._id };

    const now = Date.now();
    const unlockId = await ctx.db.insert('userBadges', {
      userId,
      badgeId: doc._id,
      badgeKey,
      unlockedAt: now,
      sourceType: 'manual',
    });
    return { created: true, unlockId };
  },
});

export const previewEvaluation = query({
  args: {
    userId: v.id('users'),
    badgeKey: v.string(),
  },
  handler: async (ctx, { userId, badgeKey }) => {
    await requireAdmin(ctx);

    const doc = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', badgeKey))
      .unique();
    if (!doc) throw new Error('Badge not found');

    const def = resolveBadgeDefinition(doc);
    const context = await loadUserBadgeContext(ctx, userId);
    const result = evaluateRule(def.ruleType, def.ruleConfig, context);

    const unlock = await ctx.db
      .query('userBadges')
      .withIndex('by_userId_and_badgeId', (q) =>
        q.eq('userId', userId).eq('badgeId', doc._id),
      )
      .unique();

    return {
      badgeKey: def.key,
      name: def.name,
      ruleType: def.ruleType,
      ruleConfig: def.ruleConfig,
      currentValue: result.currentValue,
      targetValue: result.targetValue,
      met: result.met,
      alreadyUnlocked: Boolean(unlock),
    };
  },
});

export const getUiSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await loadBadgeUiSettings(ctx);
  },
});

export const updateUiSettings = mutation({
  args: {
    newBadgeShineEffect: badgeNewShineEffectValidator,
  },
  handler: async (ctx, { newBadgeShineEffect }) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query('badgeUiSettings')
      .withIndex('by_key', (q) => q.eq('key', BADGE_UI_SETTINGS_KEY))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        newBadgeShineEffect,
        updatedAt: now,
        updatedByUserId: admin._id,
      });
      return existing._id;
    }

    return await ctx.db.insert('badgeUiSettings', {
      key: BADGE_UI_SETTINGS_KEY,
      newBadgeShineEffect,
      updatedAt: now,
      updatedByUserId: admin._id,
    });
  },
});

export const listUsersForAdmin = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query('users').collect();
    const needle = search?.trim().toLowerCase();

    return users
      .filter((u) => {
        if (!needle) return true;
        const hay = `${u.name ?? ''} ${u.email ?? ''} ${u._id}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice(0, 25)
      .map((u) => ({
        id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        isAdmin: u.isAdmin === true,
      }));
  },
});
