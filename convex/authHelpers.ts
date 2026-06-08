import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { DEFAULT_PREFERENCES, DEFAULT_SUBSCRIPTION } from './userAccountCore';

type AuthCtx = QueryCtx | MutationCtx;

async function findUserByIdentity(
  ctx: AuthCtx,
  tokenIdentifier: string,
): Promise<Doc<'users'> | null> {
  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .unique();
}

/** Create a users row from the current auth identity (mutations only). */
async function ensureUserFromIdentity(ctx: MutationCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  const existing = await findUserByIdentity(ctx, identity.tokenIdentifier);
  if (existing) return existing;

  const now = Date.now();
  const userId = await ctx.db.insert('users', {
    tokenIdentifier: identity.tokenIdentifier,
    ...(identity.name !== undefined ? { name: identity.name } : {}),
    ...(identity.email !== undefined ? { email: identity.email } : {}),
    subscription: DEFAULT_SUBSCRIPTION,
    preferences: DEFAULT_PREFERENCES,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(userId);
  if (!created) throw new Error('User not found');
  return created;
}

export async function requireUser(ctx: AuthCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await findUserByIdentity(ctx, identity.tokenIdentifier);
  if (!user) throw new Error('User not found');
  return user;
}

export async function requireAdmin(ctx: AuthCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  // Admin mutations are often run from the Convex dashboard before the user
  // has opened the app (no upsertCurrentUser yet). Auto-create the row then.
  const user =
    'insert' in ctx.db
      ? await ensureUserFromIdentity(ctx as MutationCtx)
      : await requireUser(ctx);

  if (user.isAdmin !== true) throw new Error('Admin access required');
  return user;
}

export async function getOptionalUser(ctx: AuthCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
}

export type PlannedRouteId = Id<'plannedRoutes'>;
export type TagDefinitionId = Id<'tagDefinitions'>;
export type WalkId = Id<'walks'>;
export type FollowSessionId = Id<'followSessions'>;
