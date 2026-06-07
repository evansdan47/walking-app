import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAdmin, requireUser } from './authHelpers';
import { WALK_TAGGING_EXPERIMENT_KEY } from './experimentDefinitions';
import {
  adminSetExperimentVariant,
  assignExperimentVariant,
  ensureExperimentConfig,
  getExperimentAdminSummary,
  getExperimentView,
  recordExperimentEvent,
  seedExperimentConfigs,
} from './experimentService';
import { experimentVariantWeightValidator } from './experimentValidators';

// ── Queries ───────────────────────────────────────────────────────────────────

/** Generic experiment state for any registered experiment key. */
export const get = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const user = await ctx.auth.getUserIdentity();
    const dbUser = user
      ? await ctx.db
          .query('users')
          .withIndex('by_tokenIdentifier', (q) =>
            q.eq('tokenIdentifier', user.tokenIdentifier),
          )
          .unique()
      : null;

    return getExperimentView(ctx, dbUser, key);
  },
});

/** Walk tagging experiment — convenience wrapper around `experiments.get`. */
export const getWalkTagging = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    const dbUser = user
      ? await ctx.db
          .query('users')
          .withIndex('by_tokenIdentifier', (q) =>
            q.eq('tokenIdentifier', user.tokenIdentifier),
          )
          .unique()
      : null;

    const view = await getExperimentView(ctx, dbUser, WALK_TAGGING_EXPERIMENT_KEY);
    return {
      enabled: view.enabled,
      variant: view.variant,
      config: view.config,
      assignedAt: view.assignedAt,
      label: view.label,
      description: view.description,
    };
  },
});

/** Admin funnel summary — assignment counts and event breakdown. */
export const adminGetSummary = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    return getExperimentAdminSummary(ctx, key);
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Sticky hash-based assignment (idempotent). Call before first experiment UI. */
export const assign = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const user = await requireUser(ctx);
    return {
      key,
      variant: await assignExperimentVariant(ctx, user, key),
    };
  },
});

/** Record a funnel/interaction event for experiment analysis. */
export const recordEvent = mutation({
  args: {
    key: v.string(),
    eventType: v.string(),
    variant: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const eventId = await recordExperimentEvent(ctx, {
      userId: user._id,
      experimentKey: args.key,
      eventType: args.eventType,
      variant: args.variant,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
    });
    return { eventId };
  },
});

/** Admin: enable/disable experiment, adjust weights, or update UI config. */
export const adminUpdateConfig = mutation({
  args: {
    key: v.string(),
    enabled: v.optional(v.boolean()),
    variants: v.optional(v.array(experimentVariantWeightValidator)),
    config: v.optional(v.any()),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const config = await ensureExperimentConfig(ctx, args.key);

    await ctx.db.patch(config._id, {
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
      ...(args.variants !== undefined ? { variants: args.variants } : {}),
      ...(args.config !== undefined ? { config: args.config } : {}),
      ...(args.label !== undefined ? { label: args.label } : {}),
      ...(args.description !== undefined ? { description: args.description } : {}),
      updatedAt: Date.now(),
      updatedByUserId: admin._id,
    });

    return { key: args.key };
  },
});

/** Admin: force a user into a specific variant (dogfooding / QA). */
export const adminSetUserVariant = mutation({
  args: {
    key: v.string(),
    userId: v.id('users'),
    variant: v.string(),
  },
  handler: async (ctx, { key, userId, variant }) => {
    const admin = await requireAdmin(ctx);
    const assignedVariant = await adminSetExperimentVariant(
      ctx,
      userId,
      key,
      variant,
      admin._id,
    );
    return { key, userId, variant: assignedVariant };
  },
});

/** Admin: seed or refresh default experiment configs from code definitions. */
export const adminSeedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    return seedExperimentConfigs(ctx, admin._id);
  },
});
