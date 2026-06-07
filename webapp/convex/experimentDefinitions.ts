import type { Doc } from './_generated/dataModel';
import type { VariantWeight } from './experimentCore';

/** Walk completion tagging UI — experiments A (browser), B (smart confirm), C (questionnaire). */
export const WALK_TAGGING_EXPERIMENT_KEY = 'walk_tagging_ui';

export type WalkTaggingVariant = 'A' | 'B' | 'C';

export type WalkTaggingExperimentConfig = {
  showSkip: boolean;
  maxQuestions: number;
};

export type ExperimentSeed = Omit<
  Doc<'experimentConfigs'>,
  '_id' | '_creationTime'
>;

export const EXPERIMENT_SEEDS: ExperimentSeed[] = [
  {
    key: WALK_TAGGING_EXPERIMENT_KEY,
    label: 'Walk tagging UI',
    description:
      'A/B/C test for post-walk tag capture: category browser, smart confirmation, or questionnaire.',
    enabled: false,
    variants: [
      { id: 'A', weight: 1 },
      { id: 'B', weight: 1 },
      { id: 'C', weight: 1 },
    ],
    config: {
      showSkip: true,
      maxQuestions: 7,
    } satisfies WalkTaggingExperimentConfig,
    envKillSwitch: 'TAGGING_EXPERIMENTS_ENABLED',
    updatedAt: 0,
  },
];

export function getExperimentSeed(key: string): ExperimentSeed | undefined {
  return EXPERIMENT_SEEDS.find((seed) => seed.key === key);
}

export function asWalkTaggingVariant(variant: string): WalkTaggingVariant | null {
  if (variant === 'A' || variant === 'B' || variant === 'C') return variant;
  return null;
}

export function walkTaggingVariants(weights: VariantWeight[]): VariantWeight[] {
  const allowed = new Set<WalkTaggingVariant>(['A', 'B', 'C']);
  return weights.filter((variant) => allowed.has(variant.id as WalkTaggingVariant));
}
