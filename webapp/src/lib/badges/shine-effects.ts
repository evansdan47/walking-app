/** Diagonal shine styles for newly earned badges (admin-selectable). */
export const BADGE_SHINE_EFFECTS = [
  {
    id: 'soft_sweep',
    label: 'Style 1: Soft sweep',
    description: 'A wide, subtle band moves across the badge.',
  },
  {
    id: 'sharp_sweep',
    label: 'Style 2: Sharp sweep',
    description: 'A narrow, bright band for a crisp shine.',
  },
  {
    id: 'glossy_sweep',
    label: 'Style 3: Glossy sweep',
    description: 'A soft glossy highlight with gentle fade.',
  },
  {
    id: 'multi_bands',
    label: 'Style 4: Multi bands',
    description: 'Multiple thin bands for extra sparkle.',
  },
  {
    id: 'bright_flash',
    label: 'Style 5: Bright flash',
    description: 'A stronger flash for maximum impact.',
  },
] as const;

export type BadgeShineEffect = (typeof BADGE_SHINE_EFFECTS)[number]['id'];

export const DEFAULT_BADGE_SHINE_EFFECT: BadgeShineEffect = 'soft_sweep';

export function isBadgeShineEffect(value: string): value is BadgeShineEffect {
  return BADGE_SHINE_EFFECTS.some((effect) => effect.id === value);
}
