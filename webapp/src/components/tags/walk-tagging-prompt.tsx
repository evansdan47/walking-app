'use client';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EXPERIMENT_EVENTS } from '@/lib/experiments';
import { useWalkTaggingExperiment } from '@/hooks/use-experiment';
import { TagExperimentRouter } from './tag-experiment-router';
import type { QuestionnaireAnswers } from '@/lib/tag-questionnaire-mapping';

type WalkTaggingPromptProps = {
  walkId: Id<'walks'>;
  plannedRouteId?: Id<'plannedRoutes'>;
  onDone: () => void;
};

export function WalkTaggingPrompt({ walkId, plannedRouteId, onDone }: WalkTaggingPromptProps) {
  const experiment = useWalkTaggingExperiment();
  const allTags = useQuery(api.tags.listActiveTags, {});
  const suggestions = useQuery(api.tags.suggestForWalk, { walkId });
  const bootstrapTags = useMutation(api.tags.bootstrapTagDefinitionsIfEmpty);
  const submitWalkTags = useMutation(api.tags.submitWalkTags);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<Id<'tagDefinitions'>>>(new Set());
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const promptRecorded = useRef(false);
  const bootstrapAttempted = useRef(false);

  useEffect(() => {
    if (!experiment.enabled || experiment.isLoading) return;
    if (experiment.variant) return;
    void experiment.assign();
  }, [experiment]);

  useEffect(() => {
    if (allTags === undefined || allTags.length > 0 || bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void bootstrapTags({});
  }, [allTags, bootstrapTags]);

  useEffect(() => {
    if (!experiment.enabled || !experiment.variant || promptRecorded.current) return;
    promptRecorded.current = true;
    void experiment.recordEvent(EXPERIMENT_EVENTS.promptShown, {
      variant: experiment.variant,
      entityType: 'walk',
      entityId: walkId,
    });
  }, [experiment, walkId]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await submitWalkTags({
        walkId,
        tagIds: [...selectedTagIds],
        ...(plannedRouteId !== undefined ? { plannedRouteId } : {}),
        ...(experiment.variant ? { experimentVariant: experiment.variant } : {}),
        ...(experiment.variant === 'C' ? { questionnaireAnswers } : {}),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save tags');
    } finally {
      setSubmitting(false);
    }
  }, [
    walkId,
    plannedRouteId,
    selectedTagIds,
    experiment.variant,
    questionnaireAnswers,
    submitWalkTags,
    onDone,
  ]);

  const handleSkip = useCallback(async () => {
    setSubmitting(true);
    setError('');
    try {
      await submitWalkTags({
        walkId,
        tagIds: [],
        skipped: true,
        ...(plannedRouteId !== undefined ? { plannedRouteId } : {}),
        ...(experiment.variant ? { experimentVariant: experiment.variant } : {}),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not skip tagging');
    } finally {
      setSubmitting(false);
    }
  }, [walkId, plannedRouteId, experiment.variant, submitWalkTags, onDone]);

  if (!experiment.enabled || experiment.isLoading) return null;
  if (!experiment.variant) return null;

  const variant = experiment.variant;
  const config = experiment.config;
  const showSkip = config?.showSkip ?? true;
  const maxQuestions = config?.maxQuestions ?? 7;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="walk-tagging-title"
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative z-10 w-full sm:max-w-md mx-0 sm:mx-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="h-1 w-full bg-brand shrink-0" />
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 id="walk-tagging-title" className="text-base font-bold text-slate">
            How was your walk?
          </h2>
          <p className="text-[11px] text-slate-light mt-0.5">
            Help other walkers by sharing what the route was like.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto min-h-0 flex-1">
          {allTags === undefined || suggestions === undefined ? (
            <p className="text-sm text-slate-light">Loading…</p>
          ) : (
            <TagExperimentRouter
              variant={variant}
              allTags={allTags as Doc<'tagDefinitions'>[]}
              suggestions={suggestions}
              selectedIds={selectedTagIds}
              onChange={setSelectedTagIds}
              maxQuestions={maxQuestions}
              onQuestionnaireChange={setQuestionnaireAnswers}
            />
          )}
          {error && <p className="text-[11px] text-red-500 mt-3">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end shrink-0">
          {showSkip && (
            <button
              type="button"
              onClick={handleSkip}
              disabled={submitting}
              className="px-4 py-1.5 text-sm font-medium text-slate hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || allTags === undefined}
            className="px-4 py-1.5 text-sm font-semibold bg-brand hover:bg-brand-dark text-white rounded-lg disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
