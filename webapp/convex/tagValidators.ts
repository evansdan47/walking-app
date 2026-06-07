import { v } from 'convex/values';

/** Tag category — matches taxonomy groups in docs/taggingsystem.md */
export const tagCategoryValidator = v.union(
  v.literal('landscape'),
  v.literal('terrain'),
  v.literal('path_type'),
  v.literal('route_style'),
  v.literal('difficulty'),
  v.literal('facilities'),
  v.literal('features'),
  v.literal('accessibility'),
  v.literal('dog'),
  v.literal('seasonal'),
  v.literal('hazards'),
);

export const tagKindValidator = v.union(
  v.literal('objective'),
  v.literal('subjective'),
  v.literal('seasonal'),
);

export const tagEntityTypeValidator = v.union(
  v.literal('planned_route'),
  v.literal('walk'),
  v.literal('follow_session'),
);

export const tagContributionSourceValidator = v.union(
  v.literal('creator'),
  v.literal('walker'),
  v.literal('auto_confirmed'),
  v.literal('auto_rejected'),
);

export const taggingExperimentVariantValidator = v.union(
  v.literal('A'),
  v.literal('B'),
  v.literal('C'),
);
