import { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

export type BadgeGalleryResult = NonNullable<
  FunctionReturnType<typeof api.badges.getGalleryForCurrentUser>
>;

export type BadgeCategoryGallery = BadgeGalleryResult['categories'][number];

export type BadgeGalleryItem = BadgeCategoryGallery['badges'][number];

export type BadgeGalleryStatus = BadgeGalleryItem['status'];

export type RecentUnlockedBadge = FunctionReturnType<
  typeof api.badges.listRecentUnlocked
>[number];
