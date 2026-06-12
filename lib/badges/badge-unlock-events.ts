import type { NewlyUnlockedBadge } from '@/convex/badgeEngine/types';

type BadgeUnlockListener = (badges: NewlyUnlockedBadge[]) => void;

const listeners = new Set<BadgeUnlockListener>();

export function subscribeToBadgeUnlocks(listener: BadgeUnlockListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitBadgeUnlocks(badges: NewlyUnlockedBadge[]): void {
  if (badges.length === 0) return;
  for (const listener of listeners) {
    listener(badges);
  }
}
