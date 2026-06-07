export const WALK_TAGGING_EXPERIMENT_KEY = 'walk_tagging_ui';

export type WalkTaggingVariant = 'A' | 'B' | 'C';

export type WalkTaggingExperimentConfig = {
  showSkip: boolean;
  maxQuestions: number;
};

export const EXPERIMENT_EVENTS = {
  promptShown: 'prompt_shown',
  completed: 'completed',
  skipped: 'skipped',
} as const;
