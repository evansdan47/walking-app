/** Dwell time per slide — keep in sync with carousel interval and CSS animation duration. */
export const HERO_SLIDE_INTERVAL_MS = 10_000;

/**
 * Ken Burns–style motion presets for hero backgrounds.
 * Each runs once over HERO_SLIDE_INTERVAL_MS (see globals.css keyframes).
 */
export const HERO_KEN_BURNS_EFFECTS = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "zoom-pan-right",
  "zoom-pan-left",
  "drift-up-right",
  "drift-down-left",
] as const;

export type HeroKenBurnsEffect = (typeof HERO_KEN_BURNS_EFFECTS)[number];

/** Maps effect id → CSS class on `.hero-kb-frame`. */
export function heroKenBurnsClass(effect: HeroKenBurnsEffect): string {
  return `hero-kb-${effect}`;
}

/** Pick a random effect, optionally avoiding the previous one. */
export function pickHeroKenBurnsEffect(
  exclude?: HeroKenBurnsEffect,
): HeroKenBurnsEffect {
  const pool =
    exclude && HERO_KEN_BURNS_EFFECTS.length > 1
      ? HERO_KEN_BURNS_EFFECTS.filter((e) => e !== exclude)
      : HERO_KEN_BURNS_EFFECTS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
