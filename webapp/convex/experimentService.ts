import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
  asWalkTaggingVariant,
  EXPERIMENT_SEEDS,
  getExperimentSeed,
  WALK_TAGGING_EXPERIMENT_KEY,
} from './experimentDefinitions';
import { isVariantAllowed, pickVariantDeterministic } from './experimentCore';

type DbCtx = Pick<QueryCtx, 'db'> | Pick<MutationCtx, 'db'>;

export type ExperimentView = {
  experimentKey: string;
  enabled: boolean;
  variant: string | null;
  assignedAt: number | null;
  config: Record<string, unknown> | null;
  label: string;
  description: string | null;
};

function isEnvKillSwitchActive(envVarName: string | undefined): boolean {
  if (!envVarName) return false;
  const value = process.env[envVarName];
  return value === 'false' || value === '0';
}

export async function getExperimentConfig(
  ctx: DbCtx,
  experimentKey: string,
): Promise<Doc<'experimentConfigs'> | null> {
  return await ctx.db
    .query('experimentConfigs')
    .withIndex('by_key', (q) => q.eq('key', experimentKey))
    .unique();
}

export async function ensureExperimentConfig(
  ctx: MutationCtx,
  experimentKey: string,
): Promise<Doc<'experimentConfigs'>> {
  const existing = await getExperimentConfig(ctx, experimentKey);
  if (existing) return existing;

  const seed = getExperimentSeed(experimentKey);
  if (!seed) {
    throw new Error(`Unknown experiment: ${experimentKey}`);
  }

  const configId = await ctx.db.insert('experimentConfigs', {
    ...seed,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(configId);
  if (!created) throw new Error('Failed to create experiment config');
  return created;
}

function resolveConfigView(
  experimentKey: string,
  stored: Doc<'experimentConfigs'> | null,
) {
  const seed = getExperimentSeed(experimentKey);
  if (stored) return stored;
  if (!seed) return null;
  return seed;
}

type ExperimentConfigLike = Pick<
  Doc<'experimentConfigs'>,
  'enabled' | 'envKillSwitch'
>;

export function isExperimentRuntimeEnabled(config: ExperimentConfigLike): boolean {
  if (!config.enabled) return false;
  if (isEnvKillSwitchActive(config.envKillSwitch)) return false;
  return true;
}

async function getAssignment(
  ctx: DbCtx,
  userId: Id<'users'>,
  experimentKey: string,
): Promise<Doc<'experimentAssignments'> | null> {
  return await ctx.db
    .query('experimentAssignments')
    .withIndex('by_userId_and_experimentKey', (q) =>
      q.eq('userId', userId).eq('experimentKey', experimentKey),
    )
    .unique();
}

async function syncLegacyWalkTaggingFields(
  ctx: MutationCtx,
  userId: Id<'users'>,
  variant: string,
  assignedAt: number,
) {
  const walkVariant = asWalkTaggingVariant(variant);
  if (!walkVariant) return;

  await ctx.db.patch(userId, {
    taggingExperimentVariant: walkVariant,
    taggingExperimentAssignedAt: assignedAt,
  });
}

export async function getExperimentView(
  ctx: DbCtx,
  user: Doc<'users'> | null,
  experimentKey: string,
): Promise<ExperimentView> {
  const seed = getExperimentSeed(experimentKey);
  if (!seed) {
    return {
      experimentKey,
      enabled: false,
      variant: null,
      assignedAt: null,
      config: null,
      label: experimentKey,
      description: null,
    };
  }

  const config = resolveConfigView(
    experimentKey,
    await getExperimentConfig(ctx, experimentKey),
  );
  if (!config) {
    return {
      experimentKey,
      enabled: false,
      variant: null,
      assignedAt: null,
      config: null,
      label: seed.label,
      description: seed.description ?? null,
    };
  }

  const enabled = isExperimentRuntimeEnabled(config);
  if (!user) {
    return {
      experimentKey,
      enabled: false,
      variant: null,
      assignedAt: null,
      config: null,
      label: config.label,
      description: config.description ?? null,
    };
  }

  const assignment = await getAssignment(ctx, user._id, experimentKey);
  const legacyVariant =
    !assignment &&
    experimentKey === WALK_TAGGING_EXPERIMENT_KEY &&
    user.taggingExperimentVariant
      ? user.taggingExperimentVariant
      : null;
  const legacyAssignedAt =
    legacyVariant !== null ? (user.taggingExperimentAssignedAt ?? null) : null;

  return {
    experimentKey,
    enabled,
    variant: assignment?.variant ?? legacyVariant,
    assignedAt: assignment?.assignedAt ?? legacyAssignedAt,
    config: enabled ? ((config.config as Record<string, unknown> | undefined) ?? null) : null,
    label: config.label,
    description: config.description ?? null,
  };
}

export async function assignExperimentVariant(
  ctx: MutationCtx,
  user: Doc<'users'>,
  experimentKey: string,
  options?: {
    method?: Doc<'experimentAssignments'>['method'];
    variant?: string;
    assignedByUserId?: Id<'users'>;
  },
): Promise<string> {
  const config = await ensureExperimentConfig(ctx, experimentKey);
  if (!isExperimentRuntimeEnabled(config)) {
    throw new Error(`Experiment "${experimentKey}" is not enabled`);
  }

  const existing = await getAssignment(ctx, user._id, experimentKey);
  if (existing) return existing.variant;

  if (
    experimentKey === WALK_TAGGING_EXPERIMENT_KEY &&
    user.taggingExperimentVariant &&
    isVariantAllowed(user.taggingExperimentVariant, config.variants)
  ) {
    const assignedAt = user.taggingExperimentAssignedAt ?? Date.now();
    await ctx.db.insert('experimentAssignments', {
      userId: user._id,
      experimentKey,
      variant: user.taggingExperimentVariant,
      assignedAt,
      method: 'hash',
    });
    return user.taggingExperimentVariant;
  }

  let variant = options?.variant;
  const method = options?.method ?? 'hash';

  if (!variant) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    variant = pickVariantDeterministic(
      identity.tokenIdentifier,
      experimentKey,
      config.variants,
    );
  }

  if (!isVariantAllowed(variant, config.variants)) {
    throw new Error(`Variant "${variant}" is not allowed for experiment "${experimentKey}"`);
  }

  const assignedAt = Date.now();
  await ctx.db.insert('experimentAssignments', {
    userId: user._id,
    experimentKey,
    variant,
    assignedAt,
    method,
    ...(options?.assignedByUserId !== undefined
      ? { assignedByUserId: options.assignedByUserId }
      : {}),
  });

  if (experimentKey === WALK_TAGGING_EXPERIMENT_KEY) {
    await syncLegacyWalkTaggingFields(ctx, user._id, variant, assignedAt);
  }

  return variant;
}

export async function adminSetExperimentVariant(
  ctx: MutationCtx,
  targetUserId: Id<'users'>,
  experimentKey: string,
  variant: string,
  adminUserId: Id<'users'>,
): Promise<string> {
  const config = await ensureExperimentConfig(ctx, experimentKey);
  if (!isVariantAllowed(variant, config.variants)) {
    throw new Error(`Variant "${variant}" is not allowed for experiment "${experimentKey}"`);
  }

  const existing = await getAssignment(ctx, targetUserId, experimentKey);
  const assignedAt = Date.now();

  if (existing) {
    await ctx.db.patch(existing._id, {
      variant,
      assignedAt,
      method: 'admin',
      assignedByUserId: adminUserId,
    });
  } else {
    await ctx.db.insert('experimentAssignments', {
      userId: targetUserId,
      experimentKey,
      variant,
      assignedAt,
      method: 'admin',
      assignedByUserId: adminUserId,
    });
  }

  if (experimentKey === WALK_TAGGING_EXPERIMENT_KEY) {
    await syncLegacyWalkTaggingFields(ctx, targetUserId, variant, assignedAt);
  }

  return variant;
}

export async function recordExperimentEvent(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>;
    experimentKey: string;
    eventType: string;
    variant?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<Id<'experimentEvents'>> {
  return await ctx.db.insert('experimentEvents', {
    userId: args.userId,
    experimentKey: args.experimentKey,
    eventType: args.eventType,
    ...(args.variant !== undefined ? { variant: args.variant } : {}),
    ...(args.entityType !== undefined ? { entityType: args.entityType } : {}),
    ...(args.entityId !== undefined ? { entityId: args.entityId } : {}),
    ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    recordedAt: Date.now(),
  });
}

export async function seedExperimentConfigs(
  ctx: MutationCtx,
  adminUserId: Id<'users'>,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  const now = Date.now();

  for (const seed of EXPERIMENT_SEEDS) {
    const existing = await ctx.db
      .query('experimentConfigs')
      .withIndex('by_key', (q) => q.eq('key', seed.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: seed.label,
        description: seed.description,
        variants: seed.variants,
        config: seed.config,
        envKillSwitch: seed.envKillSwitch,
        updatedAt: now,
        updatedByUserId: adminUserId,
      });
      updated++;
    } else {
      await ctx.db.insert('experimentConfigs', {
        ...seed,
        updatedAt: now,
        updatedByUserId: adminUserId,
      });
      inserted++;
    }
  }

  return { inserted, updated };
}

export async function getExperimentAdminSummary(
  ctx: DbCtx,
  experimentKey: string,
) {
  const assignments = await ctx.db
    .query('experimentAssignments')
    .withIndex('by_experimentKey', (q) => q.eq('experimentKey', experimentKey))
    .collect();

  const events = await ctx.db
    .query('experimentEvents')
    .withIndex('by_experimentKey_and_recordedAt', (q) =>
      q.eq('experimentKey', experimentKey),
    )
    .collect();

  const assignmentsByVariant: Record<string, number> = {};
  for (const row of assignments) {
    assignmentsByVariant[row.variant] = (assignmentsByVariant[row.variant] ?? 0) + 1;
  }

  const eventsByType: Record<string, number> = {};
  const eventsByVariantAndType: Record<string, Record<string, number>> = {};
  for (const row of events) {
    eventsByType[row.eventType] = (eventsByType[row.eventType] ?? 0) + 1;
    const variant = row.variant ?? 'unknown';
    if (!eventsByVariantAndType[variant]) {
      eventsByVariantAndType[variant] = {};
    }
    eventsByVariantAndType[variant]![row.eventType] =
      (eventsByVariantAndType[variant]![row.eventType] ?? 0) + 1;
  }

  return {
    experimentKey,
    assignmentCount: assignments.length,
    assignmentsByVariant,
    eventCount: events.length,
    eventsByType,
    eventsByVariantAndType,
  };
}
