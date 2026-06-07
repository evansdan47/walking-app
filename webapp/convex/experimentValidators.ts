import { v } from 'convex/values';

export const experimentVariantWeightValidator = v.object({
  id: v.string(),
  weight: v.number(),
});

export const experimentAssignmentMethodValidator = v.union(
  v.literal('hash'),
  v.literal('admin'),
  v.literal('random'),
);
