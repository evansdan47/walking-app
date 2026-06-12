import type { Doc, Id } from '../_generated/dataModel';
import type { BadgeRuleType } from '../badgeRuleValidators';

export type BadgeEventType =
  | 'walk_completed'
  | 'walk_synced'
  | 'route_planned'
  | 'goal_created'
  | 'profile_updated'
  | 'follow_completed'
  | 'tag_submitted'
  | 'recalculate'
  | 'manual';

export type EvaluateHints = {
  hasAvatar?: boolean;
};

export type ResolvedBadgeDefinition = {
  id: Id<'badgeDefinitions'>;
  key: string;
  categoryKey: string;
  name: string;
  description: string;
  tier?: Doc<'badgeDefinitions'>['tier'];
  ruleType: BadgeRuleType;
  ruleConfig: Record<string, unknown>;
  isActive: boolean;
  isRepeatable: boolean;
  isHiddenUntilUnlocked: boolean;
  startsAt?: number;
  endsAt?: number;
};

export type RuleEvaluationResult = {
  currentValue: number;
  targetValue: number;
  met: boolean;
};

export type NewlyUnlockedBadge = {
  badgeKey: string;
  name: string;
  tier?: Doc<'badgeDefinitions'>['tier'];
  categoryKey: string;
};

export type EvaluateBadgesResult = {
  newlyUnlocked: NewlyUnlockedBadge[];
  progressUpdated: number;
};

export type CompletedWalkSnapshot = Pick<
  Doc<'walks'>,
  '_id' | 'startedAt' | 'endedAt' | 'stats' | 'plannedRouteId'
>;

export type FollowSessionSnapshot = Pick<
  Doc<'followSessions'>,
  '_id' | 'status' | 'plannedRouteId' | 'userId'
>;
