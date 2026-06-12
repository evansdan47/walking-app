import type { Id } from '../_generated/dataModel';
import type { BadgeRuleType } from '../badgeRuleValidators';
import type { ResolvedBadgeDefinition } from './types';

/** Cumulative milestone rules — only the next unearned step shows progress. */
export const PROGRESS_CHAIN_RULE_TYPES = new Set<BadgeRuleType>([
  'total_distance',
  'total_elevation_gain',
]);

export function progressChainKey(def: ResolvedBadgeDefinition): string | null {
  if (!PROGRESS_CHAIN_RULE_TYPES.has(def.ruleType)) return null;
  const period = def.ruleConfig.period;
  const periodKey =
    period === 'daily' ||
    period === 'weekly' ||
    period === 'monthly' ||
    period === 'yearly' ||
    period === 'lifetime'
      ? period
      : 'lifetime';
  return `${def.categoryKey}:${def.ruleType}:${periodKey}`;
}

export function chainTargetValue(def: ResolvedBadgeDefinition): number {
  const config = def.ruleConfig;
  if (typeof config.targetMetres === 'number') return config.targetMetres;
  if (typeof config.target === 'number') return config.target;
  if (typeof config.targetSeconds === 'number') return config.targetSeconds;
  return 0;
}

export function buildActiveProgressChainKeys(
  definitions: ResolvedBadgeDefinition[],
  unlockedIds: Set<Id<'badgeDefinitions'>>,
): Map<string, string> {
  const byChain = new Map<string, ResolvedBadgeDefinition[]>();

  for (const def of definitions) {
    const chainKey = progressChainKey(def);
    if (chainKey === null) continue;
    const list = byChain.get(chainKey) ?? [];
    list.push(def);
    byChain.set(chainKey, list);
  }

  const active = new Map<string, string>();

  for (const [chainKey, chain] of byChain) {
    const sorted = [...chain].sort((a, b) => {
      const diff = chainTargetValue(a) - chainTargetValue(b);
      if (diff !== 0) return diff;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });

    const next = sorted.find((def) => !unlockedIds.has(def.id));
    if (next) {
      active.set(chainKey, next.key);
    }
  }

  return active;
}

export function shouldTrackProgress(
  def: ResolvedBadgeDefinition,
  activeChainKeys: Map<string, string>,
): boolean {
  const chainKey = progressChainKey(def);
  if (chainKey === null) return true;
  return activeChainKeys.get(chainKey) === def.key;
}
