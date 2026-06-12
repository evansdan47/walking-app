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

export type ShineGradientStop = { offset: number; opacity: number };

export type ShineEffectConfig = {
  duration: number;
  bandScale: number;
  stops: ShineGradientStop[];
};

/** Native gradient approximations of web `globals.css` shine bands. */
export const SHINE_EFFECT_CONFIG: Record<BadgeShineEffect, ShineEffectConfig> = {
  soft_sweep: {
    duration: 3200,
    bandScale: 0.5,
    stops: [
      { offset: 0, opacity: 0 },
      { offset: 0.35, opacity: 0.08 },
      { offset: 0.5, opacity: 0.38 },
      { offset: 0.65, opacity: 0.08 },
      { offset: 1, opacity: 0 },
    ],
  },
  sharp_sweep: {
    duration: 2600,
    bandScale: 0.35,
    stops: [
      { offset: 0, opacity: 0 },
      { offset: 0.47, opacity: 0.2 },
      { offset: 0.5, opacity: 0.85 },
      { offset: 0.53, opacity: 0.2 },
      { offset: 1, opacity: 0 },
    ],
  },
  glossy_sweep: {
    duration: 3600,
    bandScale: 0.55,
    stops: [
      { offset: 0, opacity: 0 },
      { offset: 0.3, opacity: 0.08 },
      { offset: 0.5, opacity: 0.28 },
      { offset: 0.7, opacity: 0.08 },
      { offset: 1, opacity: 0 },
    ],
  },
  multi_bands: {
    duration: 2800,
    bandScale: 0.6,
    stops: [
      { offset: 0, opacity: 0 },
      { offset: 0.34, opacity: 0.06 },
      { offset: 0.4, opacity: 0.22 },
      { offset: 0.43, opacity: 0.38 },
      { offset: 0.48, opacity: 0.06 },
      { offset: 0.54, opacity: 0.05 },
      { offset: 0.59, opacity: 0.32 },
      { offset: 0.65, opacity: 0.05 },
      { offset: 0.71, opacity: 0.07 },
      { offset: 0.76, opacity: 0.42 },
      { offset: 0.82, opacity: 0.07 },
      { offset: 1, opacity: 0 },
    ],
  },
  bright_flash: {
    duration: 2400,
    bandScale: 0.45,
    stops: [
      { offset: 0, opacity: 0 },
      { offset: 0.34, opacity: 0.35 },
      { offset: 0.5, opacity: 0.95 },
      { offset: 0.66, opacity: 0.35 },
      { offset: 1, opacity: 0 },
    ],
  },
};
