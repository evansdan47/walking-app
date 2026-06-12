import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { BADGE_CATEGORY_SEEDS } from './badgeCategoriesSeed';
import { evaluateBadgesForUser } from './badgeEngine/evaluate';
import {
  buildActiveProgressChainKeys,
  shouldTrackProgress,
} from './badgeEngine/progressChains';
import { isBadgeAvailable, resolveBadgeDefinition } from './badgeEngine/resolveDefinition';
import { loadBadgeUiSettings } from './badgeUiSettings';

type AuthCtx = QueryCtx | MutationCtx;

async function getAuthUser(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
}

type CategoryMeta = {
  key: string;
  name: string;
  color: string;
  icon: string;
  displayOrder: number;
};

async function loadCategoryMeta(ctx: QueryCtx): Promise<Map<string, CategoryMeta>> {
  const rows = await ctx.db.query('badgeCategories').collect();
  const map = new Map<string, CategoryMeta>();

  for (const row of rows) {
    map.set(row.key, {
      key: row.key,
      name: row.name,
      color: row.color,
      icon: row.icon,
      displayOrder: row.displayOrder,
    });
  }

  for (const seed of BADGE_CATEGORY_SEEDS) {
    if (!map.has(seed.key)) {
      map.set(seed.key, {
        key: seed.key,
        name: seed.name,
        color: seed.color,
        icon: seed.icon,
        displayOrder: seed.displayOrder,
      });
    }
  }

  return map;
}

type BadgeGalleryStatus = 'locked' | 'earned' | 'in_progress';

type BadgeGalleryItem = {
  key: string;
  name: string;
  description: string;
  lockedDescription?: string;
  tier?: Doc<'badgeDefinitions'>['tier'];
  icon: string;
  categoryKey: string;
  displayOrder: number;
  status: BadgeGalleryStatus;
  unlockedAt?: number;
  seenAt?: number;
  isNew: boolean;
  progressPercent?: number;
  currentValue?: number;
  targetValue?: number;
};

type BadgeCategoryGallery = {
  key: string;
  name: string;
  color: string;
  icon: string;
  displayOrder: number;
  badges: BadgeGalleryItem[];
};

type BadgeGalleryResult = {
  categories: BadgeCategoryGallery[];
  earnedCount: number;
  totalCount: number;
  unseenCount: number;
};

type RecentUnlockedBadge = {
  key: string;
  name: string;
  tier?: Doc<'badgeDefinitions'>['tier'];
  icon: string;
  categoryKey: string;
  categoryColor: string;
  unlockedAt: number;
  isNew: boolean;
};

function resolveBadgeStatus(
  earned: Doc<'userBadges'> | undefined,
  progress: Doc<'userBadgeProgress'> | undefined,
): { status: BadgeGalleryStatus; isNew: boolean } {
  if (earned) {
    return {
      status: 'earned',
      isNew: earned.seenAt === undefined,
    };
  }

  if (progress && progress.progressPercent > 0 && progress.progressPercent < 100) {
    return { status: 'in_progress', isNew: false };
  }

  return { status: 'locked', isNew: false };
}

async function buildGalleryForUser(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<BadgeGalleryResult> {
  const now = Date.now();
  const categoryMeta = await loadCategoryMeta(ctx);

  const definitions = await ctx.db
    .query('badgeDefinitions')
    .withIndex('by_isActive', (q) => q.eq('isActive', true))
    .collect();

  const unlocks = await ctx.db
    .query('userBadges')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .collect();

  const progressRows = await ctx.db
    .query('userBadgeProgress')
    .withIndex('by_userId_and_badgeKey', (q) => q.eq('userId', userId))
    .collect();

  const unlockByBadgeId = new Map(unlocks.map((row) => [row.badgeId.toString(), row]));
  const unlockByKey = new Map(
    unlocks
      .filter((row) => row.badgeKey !== undefined)
      .map((row) => [row.badgeKey!, row]),
  );
  const progressByKey = new Map(progressRows.map((row) => [row.badgeKey, row]));
  const unlockedIds = new Set(unlocks.map((row) => row.badgeId));
  const resolvedDefinitions = definitions
    .map(resolveBadgeDefinition)
    .filter((def) => isBadgeAvailable(def, now));
  const activeChainKeys = buildActiveProgressChainKeys(resolvedDefinitions, unlockedIds);

  const grouped = new Map<string, BadgeGalleryItem[]>();
  let earnedCount = 0;
  let totalCount = 0;
  let unseenCount = 0;

  for (const doc of definitions) {
    const def = resolveBadgeDefinition(doc);
    if (!isBadgeAvailable(def, now)) continue;

    const earned =
      unlockByKey.get(def.key) ?? unlockByBadgeId.get(def.id.toString());
    const rawProgress = progressByKey.get(def.key);
    const progress =
      rawProgress && shouldTrackProgress(def, activeChainKeys) ? rawProgress : undefined;
    const { status, isNew } = resolveBadgeStatus(earned, progress);

    if (def.isHiddenUntilUnlocked && status !== 'earned') continue;

    const item: BadgeGalleryItem = {
      key: def.key,
      name: def.name,
      description: def.description,
      lockedDescription: doc.lockedDescription,
      tier: def.tier,
      icon: doc.icon ?? doc.iconKey ?? 'award',
      categoryKey: def.categoryKey,
      displayOrder: doc.displayOrder ?? doc.sortOrder,
      status,
      ...(earned
        ? {
            unlockedAt: earned.unlockedAt,
            seenAt: earned.seenAt,
          }
        : {}),
      isNew,
      ...(progress && status !== 'earned'
        ? {
            progressPercent: progress.progressPercent,
            currentValue: progress.currentValue,
            targetValue: progress.targetValue,
          }
        : {}),
    };

    totalCount += 1;
    if (status === 'earned') earnedCount += 1;
    if (isNew) unseenCount += 1;

    const list = grouped.get(def.categoryKey) ?? [];
    list.push(item);
    grouped.set(def.categoryKey, list);
  }

  const categories: BadgeCategoryGallery[] = [...grouped.entries()]
    .map(([categoryKey, badges]) => {
      const meta = categoryMeta.get(categoryKey);
      return {
        key: categoryKey,
        name: meta?.name ?? categoryKey,
        color: meta?.color ?? '#607D8B',
        icon: meta?.icon ?? 'award',
        displayOrder: meta?.displayOrder ?? 999,
        badges: badges.sort((a, b) => a.displayOrder - b.displayOrder),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return { categories, earnedCount, totalCount, unseenCount };
}

/** Public badge gallery UI settings (e.g. new-badge shine animation). */
export const getUiSettings = query({
  args: {},
  handler: async (ctx) => await loadBadgeUiSettings(ctx),
});

/** Merged catalogue, unlocks, and progress for the badge gallery. */
export const getGalleryForCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<BadgeGalleryResult | null> => {
    const user = await getAuthUser(ctx);
    if (!user) return null;
    return await buildGalleryForUser(ctx, user._id);
  },
});

/** Recently unlocked badges for overview and gallery header strip. */
export const listRecentUnlocked = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<RecentUnlockedBadge[]> => {
    const user = await getAuthUser(ctx);
    if (!user) return [];

    const take = limit ?? 5;
    const categoryMeta = await loadCategoryMeta(ctx);

    const unlocks = await ctx.db
      .query('userBadges')
      .withIndex('by_userId_and_unlockedAt', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(take);

    const results: RecentUnlockedBadge[] = [];

    for (const unlock of unlocks) {
      const definition = await ctx.db.get(unlock.badgeId);
      if (!definition || !definition.isActive) continue;

      const def = resolveBadgeDefinition(definition);
      const meta = categoryMeta.get(def.categoryKey);

      results.push({
        key: unlock.badgeKey ?? def.key,
        name: def.name,
        tier: def.tier,
        icon: definition.icon ?? definition.iconKey ?? 'award',
        categoryKey: def.categoryKey,
        categoryColor: meta?.color ?? '#607D8B',
        unlockedAt: unlock.unlockedAt,
        isNew: unlock.seenAt === undefined,
      });
    }

    return results;
  },
});

/** Re-evaluate all automatic badge rules for the current user (historic backfill). */
export const recalculateForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error('Not authenticated');
    return await evaluateBadgesForUser(ctx, {
      userId: user._id,
      eventType: 'recalculate',
    });
  },
});

/** Dismiss the "new" indicator on a badge after the user views it. */
export const markBadgeSeen = mutation({
  args: { badgeKey: v.string() },
  handler: async (ctx, { badgeKey }) => {
    const user = await getAuthUser(ctx);
    if (!user) throw new Error('Not authenticated');

    const definition = await ctx.db
      .query('badgeDefinitions')
      .withIndex('by_key', (q) => q.eq('key', badgeKey))
      .unique();

    const fallbackDefinition =
      definition ??
      (await ctx.db
        .query('badgeDefinitions')
        .withIndex('by_slug', (q) => q.eq('slug', badgeKey))
        .unique());

    if (!fallbackDefinition) throw new Error('Badge not found');

    const unlock = await ctx.db
      .query('userBadges')
      .withIndex('by_userId_and_badgeId', (q) =>
        q.eq('userId', user._id).eq('badgeId', fallbackDefinition._id),
      )
      .unique();

    if (!unlock) throw new Error('Badge not unlocked');
    if (unlock.seenAt !== undefined) return { updated: false };

    await ctx.db.patch(unlock._id, { seenAt: Date.now() });
    return { updated: true };
  },
});
