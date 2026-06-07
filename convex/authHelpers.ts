import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

type AuthCtx = QueryCtx | MutationCtx;

export async function requireUser(ctx: AuthCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const user = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new Error('User not found');
  return user;
}

export async function requireAdmin(ctx: AuthCtx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx);
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
