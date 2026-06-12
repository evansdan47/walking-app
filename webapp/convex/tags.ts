import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { internalMutation, mutation, query } from './_generated/server';
import { evaluateBadgesForUser } from './badgeEngine/evaluate';
import { getOptionalUser, requireAdmin, requireUser } from './authHelpers';
import {
  computeConfidenceScore,
  mergeContributionIntoRollup,
  shouldDisplayRouteTag,
  type ContributionRollup,
} from './tagAggregationCore';
import {
  detectRouteTagSuggestions,
  detectWalkTagSuggestions,
  type PoiType,
  type RawTagSuggestion,
  type RouteLeg,
} from './tagAutoDetectCore';
import {
  poiTypeValidator,
  routeLegValidator,
  routeStatsValidator,
} from './tagAutoDetectValidators';
import {
  asWalkTaggingVariant,
  WALK_TAGGING_EXPERIMENT_KEY,
} from './experimentDefinitions';
import {
  assignExperimentVariant,
  getExperimentView,
  recordExperimentEvent,
} from './experimentService';
import { TAG_TAXONOMY_SEED } from './tagTaxonomy';
import { taggingExperimentVariantValidator } from './tagValidators';

const tagIdsArg = v.array(v.id('tagDefinitions'));

async function validateActiveTagIds(
  ctx: Pick<MutationCtx, 'db'>,
  tagIds: Id<'tagDefinitions'>[],
): Promise<Doc<'tagDefinitions'>[]> {
  const seen = new Set<string>();
  const defs: Doc<'tagDefinitions'>[] = [];
  for (const tagId of tagIds) {
    const key = tagId.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    const def = await ctx.db.get(tagId);
    if (!def || !def.isActive) {
      throw new Error(`Invalid or inactive tag: ${tagId}`);
    }
    defs.push(def);
  }
  return defs;
}

async function deleteCreatorContributionsForRoute(
  ctx: Pick<MutationCtx, 'db'>,
  plannedRouteId: Id<'plannedRoutes'>,
) {
  const entityId = plannedRouteId.toString();
  const existing = await ctx.db
    .query('tagContributions')
    .withIndex('by_entityType_and_entityId', (q) =>
      q.eq('entityType', 'planned_route').eq('entityId', entityId),
    )
    .collect();
  for (const row of existing) {
    if (row.source === 'creator') {
      await ctx.db.delete(row._id);
    }
  }
}

async function replaceWalkerContributions(
  ctx: Pick<MutationCtx, 'db'>,
  args: {
    userId: Id<'users'>;
    entityType: Doc<'tagContributions'>['entityType'];
    entityId: string;
    plannedRouteId: Id<'plannedRoutes'> | undefined;
    tagIds: Id<'tagDefinitions'>[];
    experimentVariant?: Doc<'tagContributions'>['experimentVariant'];
    questionnaireAnswers?: unknown;
  },
) {
  const existing = await ctx.db
    .query('tagContributions')
    .withIndex('by_entityType_and_entityId', (q) =>
      q.eq('entityType', args.entityType).eq('entityId', args.entityId),
    )
    .collect();

  for (const row of existing) {
    if (row.userId === args.userId && row.source === 'walker') {
      await ctx.db.delete(row._id);
    }
  }

  const now = Date.now();
  for (const tagId of args.tagIds) {
    await ctx.db.insert('tagContributions', {
      tagId,
      userId: args.userId,
      entityType: args.entityType,
      entityId: args.entityId,
      source: 'walker',
      reportedAt: now,
      ...(args.plannedRouteId !== undefined ? { plannedRouteId: args.plannedRouteId } : {}),
      ...(args.experimentVariant !== undefined ? { experimentVariant: args.experimentVariant } : {}),
      ...(args.questionnaireAnswers !== undefined
        ? { questionnaireAnswers: args.questionnaireAnswers }
        : {}),
    });
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All active tags for UI pickers, grouped client-side by category. */
export const listActiveTags = query({
  args: {},
  handler: async (ctx) => {
    const tags = await ctx.db
      .query('tagDefinitions')
      .withIndex('by_isActive', (q) => q.eq('isActive', true))
      .collect();
    return tags.sort((a, b) =>
      a.category === b.category
        ? a.sortOrder - b.sortOrder
        : a.category.localeCompare(b.category),
    );
  },
});

/** Route-level tag rollups with definition metadata for display. */
export const getRouteTagSummary = query({
  args: { plannedRouteId: v.id('plannedRoutes') },
  handler: async (ctx, { plannedRouteId }) => {
    const route = await ctx.db.get(plannedRouteId);
    if (!route) return null;

    const summaries = await ctx.db
      .query('routeTagSummaries')
      .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', plannedRouteId))
      .collect();

    const enriched = await Promise.all(
      summaries.map(async (summary) => {
        const def = await ctx.db.get(summary.tagId);
        if (!def) return null;
        return {
          ...summary,
          tag: def,
          display: shouldDisplayRouteTag(
            def.kind,
            summary.confirmationCount,
            summary.creatorConfirmed,
          ),
        };
      }),
    );

    return {
      plannedRouteId,
      creatorTagIds: route.creatorTagIds ?? [],
      tags: enriched.filter((t): t is NonNullable<typeof t> => t !== null),
    };
  },
});

/** Tag rollups + filter scoring for Explore (web + mobile). */
export const getExploreTagEnrichment = query({
  args: {
    plannedRouteIds: v.array(v.id('plannedRoutes')),
    filterTagSlugs: v.optional(v.array(v.string())),
    matchAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const filterSlugs = args.filterTagSlugs ?? [];
    const filterSlugSet = new Set(filterSlugs);
    const matchAll = args.matchAll ?? false;

    let filterTagDefs: Doc<'tagDefinitions'>[] = [];
    if (filterSlugSet.size > 0) {
      const active = await ctx.db
        .query('tagDefinitions')
        .withIndex('by_isActive', (q) => q.eq('isActive', true))
        .collect();
      filterTagDefs = active.filter((def) => filterSlugSet.has(def.slug));
    }

    const results: Array<{
      plannedRouteId: Id<'plannedRoutes'>;
      score: number;
      matchedSlugs: string[];
      topTags: Array<{ slug: string; label: string }>;
      tagCount: number;
      passesFilter: boolean;
    }> = [];

    for (const plannedRouteId of args.plannedRouteIds) {
      const summaries = await ctx.db
        .query('routeTagSummaries')
        .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', plannedRouteId))
        .collect();

      const displayable: Array<{
        slug: string;
        label: string;
        confidenceScore: number;
        creatorConfirmed: boolean;
      }> = [];

      for (const summary of summaries) {
        const def = await ctx.db.get(summary.tagId);
        if (!def || !def.isActive) continue;
        if (
          !shouldDisplayRouteTag(
            def.kind,
            summary.confirmationCount,
            summary.creatorConfirmed,
          )
        ) {
          continue;
        }
        displayable.push({
          slug: def.slug,
          label: def.label,
          confidenceScore: summary.confidenceScore,
          creatorConfirmed: summary.creatorConfirmed,
        });
      }

      displayable.sort((a, b) => b.confidenceScore - a.confidenceScore);
      const topTags = displayable.slice(0, 3).map((t) => ({
        slug: t.slug,
        label: t.label,
      }));

      const bySlug = new Map(displayable.map((d) => [d.slug, d]));
      const matchedSlugs: string[] = [];
      let score = 0;
      for (const def of filterTagDefs) {
        const match = bySlug.get(def.slug);
        if (match) {
          matchedSlugs.push(def.slug);
          score += match.confidenceScore + (match.creatorConfirmed ? 0.25 : 0);
        }
      }

      const filtering = filterSlugSet.size > 0 && filterTagDefs.length > 0;
      const passesFilter = !filtering
        ? true
        : matchAll
          ? matchedSlugs.length === filterTagDefs.length
          : matchedSlugs.length > 0;

      results.push({
        plannedRouteId,
        score,
        matchedSlugs,
        topTags,
        tagCount: displayable.length,
        passesFilter,
      });
    }

    return results;
  },
});

export type ResolvedTagSuggestion = {
  tagId: Id<'tagDefinitions'>;
  slug: string;
  label: string;
  category: Doc<'tagDefinitions'>['category'];
  kind: Doc<'tagDefinitions'>['kind'];
  confidence: number;
  reason: string;
  rule: string;
};

async function resolveTagSuggestions(
  ctx: Pick<QueryCtx, 'db'>,
  raw: RawTagSuggestion[],
): Promise<ResolvedTagSuggestion[]> {
  const activeTags = await ctx.db
    .query('tagDefinitions')
    .withIndex('by_isActive', (q) => q.eq('isActive', true))
    .collect();
  const bySlug = new Map(activeTags.map((tag) => [tag.slug, tag]));

  const resolved: ResolvedTagSuggestion[] = [];
  for (const suggestion of raw) {
    const def = bySlug.get(suggestion.slug);
    if (!def) continue;
    resolved.push({
      tagId: def._id,
      slug: suggestion.slug,
      label: def.label,
      category: def.category,
      kind: def.kind,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      rule: suggestion.rule,
    });
  }
  return resolved;
}

async function loadPoiTypesForRoute(
  ctx: Pick<QueryCtx, 'db'>,
  plannedRouteId: Id<'plannedRoutes'>,
): Promise<PoiType[]> {
  const links = await ctx.db
    .query('plannedRoutePlaces')
    .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', plannedRouteId))
    .collect();

  const types = new Set<PoiType>();
  for (const link of links) {
    const place = await ctx.db.get(link.placeId);
    if (place) types.add(place.type as PoiType);
  }
  return [...types];
}

function toRouteLegs(
  legs: { points: { lng: number; lat: number }[] }[],
): RouteLeg[] {
  return legs.map((leg) => ({ points: leg.points }));
}

/** Auto-suggest tags from route geometry, stats, and optional POI types. */
export const suggestForRoute = query({
  args: {
    legs: v.array(routeLegValidator),
    stats: v.optional(routeStatsValidator),
    poiTypes: v.optional(v.array(poiTypeValidator)),
    minConfidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const raw = detectRouteTagSuggestions({
      legs: toRouteLegs(args.legs),
      stats: args.stats,
      poiTypes: args.poiTypes,
      minConfidence: args.minConfidence,
    });
    return resolveTagSuggestions(ctx, raw);
  },
});

/** Auto-suggest tags for a saved planned route (loads legs, stats, linked POIs). */
export const suggestForPlannedRoute = query({
  args: {
    plannedRouteId: v.id('plannedRoutes'),
    minConfidence: v.optional(v.number()),
  },
  handler: async (ctx, { plannedRouteId, minConfidence }) => {
    const route = await ctx.db.get(plannedRouteId);
    if (!route) return [];

    const poiTypes = await loadPoiTypesForRoute(ctx, plannedRouteId);
    const raw = detectRouteTagSuggestions({
      legs: toRouteLegs(route.legs),
      stats: route.stats,
      poiTypes,
      minConfidence,
    });
    return resolveTagSuggestions(ctx, raw);
  },
});

/** Auto-suggest tags after a walk — stats, optional track, linked route context. */
export const suggestForWalk = query({
  args: {
    walkId: v.id('walks'),
    /** Optional simplified track for route-style detection (max ~200 points). */
    trackLegs: v.optional(v.array(routeLegValidator)),
    minConfidence: v.optional(v.number()),
  },
  handler: async (ctx, { walkId, trackLegs, minConfidence }) => {
    const walk = await ctx.db.get(walkId);
    if (!walk?.stats) return [];

    const stats = {
      distanceKm: walk.stats.distanceMetres / 1000,
      elevationGainM: walk.stats.elevationGainMetres ?? 0,
    };

    let inheritedRouteSuggestions: RawTagSuggestion[] | undefined;
    let poiTypes: PoiType[] | undefined;

    if (walk.plannedRouteId) {
      const route = await ctx.db.get(walk.plannedRouteId);
      if (route) {
        poiTypes = await loadPoiTypesForRoute(ctx, walk.plannedRouteId);
        inheritedRouteSuggestions = detectRouteTagSuggestions({
          legs: toRouteLegs(route.legs),
          stats: route.stats,
          poiTypes,
          minConfidence: 0,
        });
      }
    }

    const raw = detectWalkTagSuggestions({
      stats,
      legs: trackLegs ? toRouteLegs(trackLegs) : undefined,
      poiTypes,
      inheritedRouteSuggestions,
      minConfidence,
    });
    return resolveTagSuggestions(ctx, raw);
  },
});

/** @deprecated Prefer `experiments.getWalkTagging` — kept for existing clients. */
export const getTaggingExperiment = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    const view = await getExperimentView(ctx, user, WALK_TAGGING_EXPERIMENT_KEY);
    return {
      enabled: view.enabled,
      variant: asWalkTaggingVariant(view.variant ?? '') ?? null,
      config: view.config as { showSkip: boolean; maxQuestions: number } | null,
      assignedAt: view.assignedAt,
    };
  },
});

/** @deprecated Prefer `experiments.assign({ key: 'walk_tagging_ui' })`. */
export const assignTaggingExperiment = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const variant = await assignExperimentVariant(ctx, user, WALK_TAGGING_EXPERIMENT_KEY);
    const walkVariant = asWalkTaggingVariant(variant);
    if (!walkVariant) {
      throw new Error(`Invalid walk tagging variant: ${variant}`);
    }
    return walkVariant;
  },
});

/** Record a walk-tagging funnel event (prompt shown, completed, skipped, etc.). */
export const recordTaggingEvent = mutation({
  args: {
    eventType: v.string(),
    variant: v.optional(taggingExperimentVariantValidator),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const eventId = await recordExperimentEvent(ctx, {
      userId: user._id,
      experimentKey: WALK_TAGGING_EXPERIMENT_KEY,
      eventType: args.eventType,
      variant: args.variant,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
    });
    return { eventId };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Replace creator tags on a planned route (route save / edit).
 * Writes creator contributions and recomputes route summaries.
 */
export const submitCreatorTags = mutation({
  args: {
    plannedRouteId: v.id('plannedRoutes'),
    tagIds: tagIdsArg,
  },
  handler: async (ctx, { plannedRouteId, tagIds }) => {
    const user = await requireUser(ctx);
    const route = await ctx.db.get(plannedRouteId);
    if (!route) throw new Error('Route not found');
    if (route.userId !== user._id && user.isAdmin !== true) {
      throw new Error('Not authorised to edit this route');
    }

    await validateActiveTagIds(ctx, tagIds);

    await ctx.db.patch(plannedRouteId, { creatorTagIds: tagIds });

    await deleteCreatorContributionsForRoute(ctx, plannedRouteId);

    const now = Date.now();
    const entityId = plannedRouteId.toString();
    for (const tagId of tagIds) {
      await ctx.db.insert('tagContributions', {
        tagId,
        userId: user._id,
        entityType: 'planned_route',
        entityId,
        plannedRouteId,
        source: 'creator',
        reportedAt: now,
      });
    }

    await ctx.runMutation(internal.tags.recomputeRouteSummariesInternal, {
      plannedRouteId,
    });

    return { plannedRouteId, tagCount: tagIds.length };
  },
});

/** Post-walk community tag contributions. */
export const submitWalkTags = mutation({
  args: {
    walkId: v.id('walks'),
    tagIds: tagIdsArg,
    plannedRouteId: v.optional(v.id('plannedRoutes')),
    experimentVariant: v.optional(taggingExperimentVariantValidator),
    questionnaireAnswers: v.optional(v.any()),
    skipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const walk = await ctx.db.get(args.walkId);
    if (!walk) throw new Error('Walk not found');
    if (walk.userId !== user._id) throw new Error('Forbidden');
    if (walk.status !== 'completed') {
      throw new Error('Tags can only be submitted for completed walks');
    }

    const routeId = args.plannedRouteId ?? walk.plannedRouteId;

    if (args.skipped) {
      await ctx.db.patch(args.walkId, {
        taggingSkipped: true,
        taggingCompletedAt: Date.now(),
      });
      await recordExperimentEvent(ctx, {
        userId: user._id,
        experimentKey: WALK_TAGGING_EXPERIMENT_KEY,
        eventType: 'skipped',
        variant: args.experimentVariant,
        entityType: 'walk',
        entityId: args.walkId.toString(),
      });
      return { walkId: args.walkId, skipped: true as const };
    }

    await validateActiveTagIds(ctx, args.tagIds);

    if (routeId !== undefined) {
      const route = await ctx.db.get(routeId);
      if (!route) throw new Error('Linked route not found');
    }

    await replaceWalkerContributions(ctx, {
      userId: user._id,
      entityType: 'walk',
      entityId: args.walkId.toString(),
      plannedRouteId: routeId,
      tagIds: args.tagIds,
      experimentVariant: args.experimentVariant,
      questionnaireAnswers: args.questionnaireAnswers,
    });

    const walkPatch: {
      taggingCompletedAt: number;
      taggingSkipped: boolean;
      plannedRouteId?: Id<'plannedRoutes'>;
    } = {
      taggingCompletedAt: Date.now(),
      taggingSkipped: false,
    };
    if (routeId !== undefined && walk.plannedRouteId !== routeId) {
      walkPatch.plannedRouteId = routeId;
    }
    await ctx.db.patch(args.walkId, walkPatch);

    if (routeId !== undefined) {
      await ctx.runMutation(internal.tags.recomputeRouteSummariesInternal, {
        plannedRouteId: routeId,
      });
    }

    await recordExperimentEvent(ctx, {
      userId: user._id,
      experimentKey: WALK_TAGGING_EXPERIMENT_KEY,
      eventType: 'completed',
      variant: args.experimentVariant,
      entityType: 'walk',
      entityId: args.walkId.toString(),
      metadata: {
        tagCount: args.tagIds.length,
        plannedRouteId: routeId?.toString(),
      },
    });

    await evaluateBadgesForUser(ctx, {
      userId: user._id,
      eventType: 'tag_submitted',
      sourceId: args.walkId,
    });

    return { walkId: args.walkId, tagCount: args.tagIds.length, plannedRouteId: routeId };
  },
});

/** Post follow-session tag contributions (same aggregation as walks). */
export const submitFollowSessionTags = mutation({
  args: {
    followSessionId: v.id('followSessions'),
    tagIds: tagIdsArg,
    plannedRouteId: v.optional(v.id('plannedRoutes')),
    experimentVariant: v.optional(taggingExperimentVariantValidator),
    questionnaireAnswers: v.optional(v.any()),
    skipped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(args.followSessionId);
    if (!session) throw new Error('Follow session not found');
    if (session.userId !== user._id) throw new Error('Forbidden');
    if (session.status !== 'completed') {
      throw new Error('Tags can only be submitted for completed follow sessions');
    }

    const routeId = args.plannedRouteId ?? session.plannedRouteId;

    if (args.skipped) {
      await ctx.db.patch(args.followSessionId, {
        taggingSkipped: true,
        taggingCompletedAt: Date.now(),
      });
      await recordExperimentEvent(ctx, {
        userId: user._id,
        experimentKey: WALK_TAGGING_EXPERIMENT_KEY,
        eventType: 'skipped',
        variant: args.experimentVariant,
        entityType: 'follow_session',
        entityId: args.followSessionId.toString(),
      });
      return { followSessionId: args.followSessionId, skipped: true as const };
    }

    await validateActiveTagIds(ctx, args.tagIds);

    await replaceWalkerContributions(ctx, {
      userId: user._id,
      entityType: 'follow_session',
      entityId: args.followSessionId.toString(),
      plannedRouteId: routeId,
      tagIds: args.tagIds,
      experimentVariant: args.experimentVariant,
      questionnaireAnswers: args.questionnaireAnswers,
    });

    const sessionPatch: {
      taggingCompletedAt: number;
      taggingSkipped: boolean;
      plannedRouteId?: Id<'plannedRoutes'>;
    } = {
      taggingCompletedAt: Date.now(),
      taggingSkipped: false,
    };
    if (routeId !== undefined && session.plannedRouteId !== routeId) {
      sessionPatch.plannedRouteId = routeId;
    }
    await ctx.db.patch(args.followSessionId, sessionPatch);

    if (routeId !== undefined) {
      await ctx.runMutation(internal.tags.recomputeRouteSummariesInternal, {
        plannedRouteId: routeId,
      });
    }

    await recordExperimentEvent(ctx, {
      userId: user._id,
      experimentKey: WALK_TAGGING_EXPERIMENT_KEY,
      eventType: 'completed',
      variant: args.experimentVariant,
      entityType: 'follow_session',
      entityId: args.followSessionId.toString(),
      metadata: {
        tagCount: args.tagIds.length,
        plannedRouteId: routeId?.toString(),
      },
    });

    return {
      followSessionId: args.followSessionId,
      tagCount: args.tagIds.length,
      plannedRouteId: routeId,
    };
  },
});

/** Rebuild routeTagSummaries for one planned route. */
export const recomputeRouteSummariesInternal = internalMutation({
  args: { plannedRouteId: v.id('plannedRoutes') },
  handler: async (ctx, { plannedRouteId }) => {
    const route = await ctx.db.get(plannedRouteId);
    if (!route) return;

    const creatorTagIdSet = new Set(
      (route.creatorTagIds ?? []).map((id) => id.toString()),
    );

    const byRouteId = await ctx.db
      .query('tagContributions')
      .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', plannedRouteId))
      .collect();

    const entityId = plannedRouteId.toString();
    const byEntity = await ctx.db
      .query('tagContributions')
      .withIndex('by_entityType_and_entityId', (q) =>
        q.eq('entityType', 'planned_route').eq('entityId', entityId),
      )
      .collect();

    const seenContributionIds = new Set<string>();
    const allContributions: Doc<'tagContributions'>[] = [];
    for (const c of [...byRouteId, ...byEntity]) {
      if (seenContributionIds.has(c._id.toString())) continue;
      seenContributionIds.add(c._id.toString());
      allContributions.push(c);
    }

    const rollups = new Map<string, ContributionRollup>();

    for (const tagId of route.creatorTagIds ?? []) {
      rollups.set(tagId.toString(), {
        tagId: tagId.toString(),
        confirmationCount: 0,
        creatorConfirmed: true,
        autoSuggested: false,
        lastReportedAt: route.createdAt,
      });
    }

    for (const c of allContributions) {
      const key = c.tagId.toString();
      const existing = rollups.get(key) ?? {
        tagId: key,
        confirmationCount: 0,
        creatorConfirmed: creatorTagIdSet.has(key),
        autoSuggested: false,
        lastReportedAt: 0,
      };
      rollups.set(key, mergeContributionIntoRollup(existing, c));
    }

    const existingSummaries = await ctx.db
      .query('routeTagSummaries')
      .withIndex('by_plannedRouteId', (q) => q.eq('plannedRouteId', plannedRouteId))
      .collect();
    for (const row of existingSummaries) {
      await ctx.db.delete(row._id);
    }

    const now = Date.now();
    for (const rollup of rollups.values()) {
      const tagId = rollup.tagId as Id<'tagDefinitions'>;
      const def = await ctx.db.get(tagId);
      if (!def) continue;

      const lastReportedAt = rollup.lastReportedAt || route.createdAt;
      await ctx.db.insert('routeTagSummaries', {
        plannedRouteId,
        tagId,
        confirmationCount: rollup.confirmationCount,
        creatorConfirmed: rollup.creatorConfirmed,
        autoSuggested: rollup.autoSuggested,
        lastReportedAt,
        confidenceScore: computeConfidenceScore(
          def.kind,
          rollup.confirmationCount,
          rollup.creatorConfirmed,
          lastReportedAt,
          now,
        ),
      });
    }
  },
});

async function seedTagDefinitionsFromTaxonomy(
  ctx: MutationCtx,
  replaceExisting: boolean,
) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of TAG_TAXONOMY_SEED) {
    const existing = await ctx.db
      .query('tagDefinitions')
      .withIndex('by_slug', (q) => q.eq('slug', seed.slug))
      .unique();

    if (!existing) {
      await ctx.db.insert('tagDefinitions', seed);
      inserted++;
      continue;
    }

    if (replaceExisting) {
      await ctx.db.patch(existing._id, seed);
      updated++;
    } else {
      skipped++;
    }
  }

  return { inserted, updated, skipped, total: TAG_TAXONOMY_SEED.length };
}

/**
 * One-time bootstrap when tagDefinitions is empty (no admin required).
 * After the vocabulary exists, use seedTagDefinitions (admin) to update it.
 */
export const bootstrapTagDefinitionsIfEmpty = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('tagDefinitions').first();
    if (existing) {
      return { bootstrapped: false as const, reason: 'already_seeded' as const };
    }
    const result = await seedTagDefinitionsFromTaxonomy(ctx, false);
    return { bootstrapped: true as const, ...result };
  },
});

/** Admin: idempotent seed of tagDefinitions from TAG_TAXONOMY_SEED. */
export const seedTagDefinitions = mutation({
  args: { replaceExisting: v.optional(v.boolean()) },
  handler: async (ctx, { replaceExisting }) => {
    await requireAdmin(ctx);
    return seedTagDefinitionsFromTaxonomy(ctx, replaceExisting ?? false);
  },
});

/** Admin: recompute summaries for all routes (backfill / repair). */
export const recomputeAllRouteSummaries = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const routes = await ctx.db.query('plannedRoutes').collect();
    for (const route of routes) {
      await ctx.runMutation(internal.tags.recomputeRouteSummariesInternal, {
        plannedRouteId: route._id,
      });
    }
    return { routeCount: routes.length };
  },
});

/** Manual trigger on a single route (owner or admin). */
export const recomputeRouteSummaries = mutation({
  args: { plannedRouteId: v.id('plannedRoutes') },
  handler: async (ctx, { plannedRouteId }) => {
    const user = await requireUser(ctx);
    const route = await ctx.db.get(plannedRouteId);
    if (!route) throw new Error('Route not found');
    if (route.userId !== user._id && user.isAdmin !== true) {
      throw new Error('Not authorised');
    }
    await ctx.runMutation(internal.tags.recomputeRouteSummariesInternal, {
      plannedRouteId,
    });
    return { plannedRouteId };
  },
});
