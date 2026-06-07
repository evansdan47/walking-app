'use client';

import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback } from 'react';
import {
  WALK_TAGGING_EXPERIMENT_KEY,
  type WalkTaggingExperimentConfig,
  type WalkTaggingVariant,
} from '@/lib/experiments';

type RecordEventOptions = {
  variant?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Generic experiment hook — query state, sticky assign, and funnel events.
 * Add a new experiment by registering it in convex/experimentDefinitions.ts.
 */
export function useExperiment(experimentKey: string) {
  const state = useQuery(api.experiments.get, { key: experimentKey });
  const assignMutation = useMutation(api.experiments.assign);
  const recordEventMutation = useMutation(api.experiments.recordEvent);

  const assign = useCallback(async () => {
    const result = await assignMutation({ key: experimentKey });
    return result.variant;
  }, [assignMutation, experimentKey]);

  const recordEvent = useCallback(
    async (eventType: string, options?: RecordEventOptions) => {
      await recordEventMutation({
        key: experimentKey,
        eventType,
        ...(options?.variant !== undefined ? { variant: options.variant } : {}),
        ...(options?.entityType !== undefined ? { entityType: options.entityType } : {}),
        ...(options?.entityId !== undefined ? { entityId: options.entityId } : {}),
        ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
      });
    },
    [recordEventMutation, experimentKey],
  );

  return {
    state,
    isLoading: state === undefined,
    enabled: state?.enabled ?? false,
    variant: state?.variant ?? null,
    config: state?.config ?? null,
    assignedAt: state?.assignedAt ?? null,
    assign,
    recordEvent,
  };
}

/** Walk tagging A/B/C experiment (post-walk tag capture UI). */
export function useWalkTaggingExperiment() {
  const experiment = useExperiment(WALK_TAGGING_EXPERIMENT_KEY);

  return {
    ...experiment,
    variant: (experiment.variant as WalkTaggingVariant | null) ?? null,
    config: (experiment.config as WalkTaggingExperimentConfig | null) ?? null,
  };
}
