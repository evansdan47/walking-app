import type { Doc } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';

export const BADGE_UI_SETTINGS_KEY = 'global' as const;

export type BadgeNewShineEffect = Doc<'badgeUiSettings'>['newBadgeShineEffect'];

export const DEFAULT_BADGE_NEW_SHINE_EFFECT: BadgeNewShineEffect = 'soft_sweep';

export type BadgeUiSettingsResult = {
  newBadgeShineEffect: BadgeNewShineEffect;
};

export async function loadBadgeUiSettings(ctx: Pick<QueryCtx, 'db'>): Promise<BadgeUiSettingsResult> {
  const row = await ctx.db
    .query('badgeUiSettings')
    .withIndex('by_key', (q) => q.eq('key', BADGE_UI_SETTINGS_KEY))
    .unique();

  return {
    newBadgeShineEffect: row?.newBadgeShineEffect ?? DEFAULT_BADGE_NEW_SHINE_EFFECT,
  };
}
