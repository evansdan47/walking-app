import type { Doc } from '@convex/_generated/dataModel';

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

export const TIER_GLOW: Record<BadgeTier, string> = {
  bronze: 'none',
  silver: '0 0 0 1px rgba(192,192,192,0.6)',
  gold: '0 0 8px rgba(255,215,0,0.55)',
  platinum: '0 0 10px rgba(144,202,249,0.85), 0 0 0 2px #E3F2FD',
};

export const HEX_CLIP_PATH =
  'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

/** Fallback category colours when DB categories are not seeded yet. */
export const CATEGORY_COLORS: Record<string, string> = {
  getting_started: '#2E7D32',
  distance_milestones: '#E65100',
  consistency: '#00897B',
  monthly_challenges: '#7B1FA2',
  exploration: '#1565C0',
  route_planning: '#827717',
  recording_quality: '#FF8F00',
  elevation: '#6D4C41',
  following_routes: '#C2185B',
  community_sharing: '#3949AB',
};
