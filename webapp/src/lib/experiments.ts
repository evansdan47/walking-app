/**
 * Client-side experiment keys and types.
 * Server definitions live in convex/experimentDefinitions.ts — keep keys in sync.
 * @see docs/experiments.md
 */

export const WALK_TAGGING_EXPERIMENT_KEY = 'walk_tagging_ui';

export type WalkTaggingVariant = 'A' | 'B' | 'C';

export type WalkTaggingExperimentConfig = {
  showSkip: boolean;
  maxQuestions: number;
};

export type ExperimentView = {
  experimentKey: string;
  enabled: boolean;
  variant: string | null;
  assignedAt: number | null;
  config: Record<string, unknown> | null;
  label: string;
  description: string | null;
};

/** Standard funnel events — extend per experiment as needed. */
export const EXPERIMENT_EVENTS = {
  promptShown: 'prompt_shown',
  completed: 'completed',
  skipped: 'skipped',
} as const;
