import { describe, expect, it } from 'vitest';
import type { Id } from '../_generated/dataModel';
import {
  buildActiveProgressChainKeys,
  progressChainKey,
  shouldTrackProgress,
} from './progressChains';
import type { ResolvedBadgeDefinition } from './types';

function makeDef(
  overrides: Partial<ResolvedBadgeDefinition> & Pick<ResolvedBadgeDefinition, 'key' | 'id'>,
): ResolvedBadgeDefinition {
  return {
    name: overrides.key,
    description: '',
    categoryKey: 'distance_milestones',
    ruleType: 'total_distance',
    ruleConfig: { period: 'lifetime', targetMetres: 1000 },
    tier: 'bronze',
    isActive: true,
    isRepeatable: false,
    isHiddenUntilUnlocked: false,
    ...overrides,
  };
}

describe('progressChains', () => {
  it('groups distance milestones by category and period', () => {
    const def = makeDef({ id: 'a' as Id<'badgeDefinitions'>, key: 'dist_5k' });
    expect(progressChainKey(def)).toBe('distance_milestones:total_distance:lifetime');
  });

  it('picks the lowest unearned target as the active chain step', () => {
    const defs = [
      makeDef({
        id: 'c' as Id<'badgeDefinitions'>,
        key: 'dist_10k',
        ruleConfig: { period: 'lifetime', targetMetres: 10_000 },
      }),
      makeDef({
        id: 'a' as Id<'badgeDefinitions'>,
        key: 'dist_5k',
        ruleConfig: { period: 'lifetime', targetMetres: 5000 },
      }),
      makeDef({
        id: 'b' as Id<'badgeDefinitions'>,
        key: 'dist_1k',
        ruleConfig: { period: 'lifetime', targetMetres: 1000 },
      }),
    ];
    const unlocked = new Set<Id<'badgeDefinitions'>>(['b' as Id<'badgeDefinitions'>]);

    const active = buildActiveProgressChainKeys(defs, unlocked);
    expect(active.get('distance_milestones:total_distance:lifetime')).toBe('dist_5k');
  });

  it('returns no active step when the chain is complete', () => {
    const defs = [
      makeDef({
        id: 'a' as Id<'badgeDefinitions'>,
        key: 'dist_5k',
        ruleConfig: { period: 'lifetime', targetMetres: 5000 },
      }),
    ];
    const unlocked = new Set<Id<'badgeDefinitions'>>(['a' as Id<'badgeDefinitions'>]);

    const active = buildActiveProgressChainKeys(defs, unlocked);
    expect(active.size).toBe(0);
  });

  it('tracks progress only for the active chain head', () => {
    const defs = [
      makeDef({
        id: 'a' as Id<'badgeDefinitions'>,
        key: 'dist_5k',
        ruleConfig: { period: 'lifetime', targetMetres: 5000 },
      }),
      makeDef({
        id: 'b' as Id<'badgeDefinitions'>,
        key: 'dist_10k',
        ruleConfig: { period: 'lifetime', targetMetres: 10_000 },
      }),
    ];
    const active = buildActiveProgressChainKeys(defs, new Set());

    expect(shouldTrackProgress(defs[0], active)).toBe(true);
    expect(shouldTrackProgress(defs[1], active)).toBe(false);
  });
});
