/**
 * Pure experiment assignment helpers — reusable across experiments.
 */

export type VariantWeight = {
  id: string;
  weight: number;
};

/** Stable 32-bit hash for deterministic bucket selection. */
export function deterministicHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Pick a variant from weighted options using hash(seed + experimentKey).
 * Reproducible per user/experiment pair; supports unequal weights.
 */
export function pickVariantDeterministic(
  seed: string,
  experimentKey: string,
  variants: VariantWeight[],
): string {
  const active = variants.filter((variant) => variant.weight > 0);
  if (active.length === 0) {
    throw new Error(`Experiment "${experimentKey}" has no active variants`);
  }

  const totalWeight = active.reduce((sum, variant) => sum + variant.weight, 0);
  const bucket = deterministicHash(`${experimentKey}:${seed}`) % 10_000;
  const target = (bucket / 10_000) * totalWeight;

  let cumulative = 0;
  for (const variant of active) {
    cumulative += variant.weight;
    if (target < cumulative) return variant.id;
  }

  return active[active.length - 1]!.id;
}

export function isVariantAllowed(
  variantId: string,
  variants: VariantWeight[],
): boolean {
  return variants.some((variant) => variant.id === variantId && variant.weight > 0);
}
