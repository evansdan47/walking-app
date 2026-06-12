import { v } from 'convex/values';
import type { Infer } from 'convex/values';
import {
  badgeCriteriaTypeValidator,
  badgePeriodValidator,
  badgeRuleTypeValidator,
} from './userValidators';

type CriteriaType = Infer<typeof badgeCriteriaTypeValidator>;

const periodField = { period: v.optional(badgePeriodValidator) };

export const walkCountRuleConfigValidator = v.object({
  target: v.number(),
  ...periodField,
});

export const distanceRuleConfigValidator = v.object({
  targetMetres: v.number(),
  ...periodField,
});

export const singleWalkDistanceRuleConfigValidator = v.object({
  targetMetres: v.number(),
});

export const countRuleConfigValidator = v.object({
  target: v.number(),
  ...periodField,
});

export const walkOnWeekendRuleConfigValidator = v.object({
  target: v.number(),
});

export const emptyRuleConfigValidator = v.object({});

export const badgeRuleConfigValidator = v.union(
  walkCountRuleConfigValidator,
  distanceRuleConfigValidator,
  singleWalkDistanceRuleConfigValidator,
  countRuleConfigValidator,
  walkOnWeekendRuleConfigValidator,
  emptyRuleConfigValidator,
);

export type BadgeRuleType = Infer<typeof badgeRuleTypeValidator>;
export type BadgePeriod = Infer<typeof badgePeriodValidator>;
export type WalkCountRuleConfig = Infer<typeof walkCountRuleConfigValidator>;
export type DistanceRuleConfig = Infer<typeof distanceRuleConfigValidator>;
export type SingleWalkDistanceRuleConfig = Infer<typeof singleWalkDistanceRuleConfigValidator>;
export type CountRuleConfig = Infer<typeof countRuleConfigValidator>;
export type WalkOnWeekendRuleConfig = Infer<typeof walkOnWeekendRuleConfigValidator>;
export type EmptyRuleConfig = Infer<typeof emptyRuleConfigValidator>;

export function criteriaTypeToRuleType(criteriaType: CriteriaType): BadgeRuleType {
  switch (criteriaType) {
    case 'total_distance_m':
      return 'total_distance';
    case 'single_walk_distance_m':
      return 'single_walk_distance';
    case 'total_elevation_gain_m':
      return 'total_elevation_gain';
    default:
      return criteriaType;
  }
}

export function criteriaToRuleConfig(
  criteriaType: CriteriaType,
  criteriaThreshold?: number,
): Record<string, unknown> {
  const target = criteriaThreshold ?? 1;
  switch (criteriaType) {
    case 'total_distance_m':
    case 'single_walk_distance_m':
    case 'total_elevation_gain_m':
      return { targetMetres: target, period: 'lifetime' as const };
    case 'walk_count':
    case 'planned_route_count':
    case 'walk_on_weekend':
      return { target, period: 'lifetime' as const };
    default:
      return {};
  }
}

export function getRuleConfigValidator(ruleType: BadgeRuleType) {
  switch (ruleType) {
    case 'walk_count':
      return walkCountRuleConfigValidator;
    case 'total_distance':
    case 'total_elevation_gain':
      return distanceRuleConfigValidator;
    case 'single_walk_distance':
      return singleWalkDistanceRuleConfigValidator;
    case 'planned_route_count':
      return countRuleConfigValidator;
    case 'walk_on_weekend':
      return walkOnWeekendRuleConfigValidator;
    default:
      return emptyRuleConfigValidator;
  }
}
