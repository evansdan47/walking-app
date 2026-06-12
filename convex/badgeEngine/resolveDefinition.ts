import type { Doc } from '../_generated/dataModel';
import {
  criteriaToRuleConfig,
  criteriaTypeToRuleType,
} from '../badgeRuleValidators';
import type { ResolvedBadgeDefinition } from './types';

/** Normalise v1 and v2 badge definition documents for the engine. */
export function resolveBadgeDefinition(doc: Doc<'badgeDefinitions'>): ResolvedBadgeDefinition {
  const ruleType = doc.ruleType ?? criteriaTypeToRuleType(doc.criteriaType);
  const ruleConfig =
    doc.ruleConfig ?? criteriaToRuleConfig(doc.criteriaType, doc.criteriaThreshold);

  return {
    id: doc._id,
    key: doc.key ?? doc.slug,
    categoryKey: doc.categoryKey ?? doc.category,
    name: doc.name ?? doc.label,
    description: doc.description,
    tier: doc.tier,
    ruleType,
    ruleConfig: ruleConfig as Record<string, unknown>,
    isActive: doc.isActive,
    isRepeatable: doc.isRepeatable ?? false,
    isHiddenUntilUnlocked: doc.isHiddenUntilUnlocked ?? false,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
  };
}

export function isBadgeAvailable(def: ResolvedBadgeDefinition, now = Date.now()): boolean {
  if (!def.isActive) return false;
  if (def.startsAt !== undefined && now < def.startsAt) return false;
  if (def.endsAt !== undefined && now > def.endsAt) return false;
  return true;
}
