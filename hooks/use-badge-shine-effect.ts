import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import {
  DEFAULT_BADGE_SHINE_EFFECT,
  isBadgeShineEffect,
  type BadgeShineEffect,
} from '@/lib/badges/shine-effects';

export function useBadgeShineEffect(override?: BadgeShineEffect): BadgeShineEffect {
  const settings = useAppQuery(api.badges.getUiSettings);
  if (override) return override;
  const fromServer = settings?.newBadgeShineEffect;
  if (typeof fromServer === 'string' && isBadgeShineEffect(fromServer)) {
    return fromServer;
  }
  return DEFAULT_BADGE_SHINE_EFFECT;
}
