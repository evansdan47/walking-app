import type { Doc } from '@/convex/_generated/dataModel';

export type BadgeTier = NonNullable<Doc<'badgeDefinitions'>['tier']>;

export const TIER_BORDER: Record<BadgeTier, string> = {
  bronze: '#CD7F32',
  silver: '#9E9E9E',
  gold: '#F9A825',
  platinum: '#90CAF9',
};

export const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};
