import type { Doc } from '@/convex/_generated/dataModel';

export type BadgeGalleryStatus = 'locked' | 'earned' | 'in_progress';

export type BadgeGalleryItem = {
  key: string;
  name: string;
  description: string;
  lockedDescription?: string;
  tier?: Doc<'badgeDefinitions'>['tier'];
  icon: string;
  categoryKey: string;
  displayOrder: number;
  status: BadgeGalleryStatus;
  unlockedAt?: number;
  seenAt?: number;
  isNew: boolean;
  progressPercent?: number;
  currentValue?: number;
  targetValue?: number;
};

export type BadgeCategoryGallery = {
  key: string;
  name: string;
  color: string;
  icon: string;
  displayOrder: number;
  badges: BadgeGalleryItem[];
};

export type RecentUnlockedBadge = {
  key: string;
  name: string;
  tier?: Doc<'badgeDefinitions'>['tier'];
  icon: string;
  categoryKey: string;
  categoryColor: string;
  unlockedAt: number;
  isNew: boolean;
};
