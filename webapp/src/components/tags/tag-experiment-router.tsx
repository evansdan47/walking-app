'use client';

import type { Doc, Id } from '@convex/_generated/dataModel';
import { useEffect, useMemo, useState } from 'react';
import type { WalkTaggingVariant } from '@/lib/experiments';
import {
  mapQuestionnaireToSlugs,
  slugsToTagIds,
  type QuestionnaireAnswers,
} from '@/lib/tag-questionnaire-mapping';
import { TagCategoryBrowser } from './tag-category-browser';
import { TagQuestionnaire } from './tag-questionnaire';
import { TagSmartConfirmation } from './tag-smart-confirmation';

type TagDefinition = Doc<'tagDefinitions'>;

type Suggestion = {
  tagId: Id<'tagDefinitions'>;
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

type TagExperimentRouterProps = {
  variant: WalkTaggingVariant;
  allTags: TagDefinition[];
  suggestions: Suggestion[];
  selectedIds: Set<Id<'tagDefinitions'>>;
  onChange: (ids: Set<Id<'tagDefinitions'>>) => void;
  maxQuestions?: number;
  onQuestionnaireChange?: (answers: QuestionnaireAnswers) => void;
};

export function TagExperimentRouter({
  variant,
  allTags,
  suggestions,
  selectedIds,
  onChange,
  maxQuestions = 7,
  onQuestionnaireChange,
}: TagExperimentRouterProps) {
  const suggestedSlugs = useMemo(() => new Set(suggestions.map((s) => s.slug)), [suggestions]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswers>({});

  useEffect(() => {
    if (variant !== 'C') return;
    const slugs = mapQuestionnaireToSlugs(questionnaireAnswers);
    onChange(new Set(slugsToTagIds(slugs, allTags) as Id<'tagDefinitions'>[]));
    onQuestionnaireChange?.(questionnaireAnswers);
  }, [variant, questionnaireAnswers, allTags, onChange, onQuestionnaireChange]);

  useEffect(() => {
    if (variant === 'C') return;
    if (selectedIds.size > 0) return;
    const fromSuggestions = suggestions.map((s) => s.tagId);
    if (fromSuggestions.length > 0) onChange(new Set(fromSuggestions));
  }, [variant, suggestions, selectedIds.size, onChange]);

  if (variant === 'B') {
    return (
      <TagSmartConfirmation
        allTags={allTags}
        suggestions={suggestions}
        selectedIds={selectedIds}
        onChange={onChange}
      />
    );
  }

  if (variant === 'C') {
    return (
      <TagQuestionnaire
        maxQuestions={maxQuestions}
        onChange={(answers) => {
          setQuestionnaireAnswers(answers);
        }}
      />
    );
  }

  return (
    <TagCategoryBrowser
      tags={allTags}
      selectedIds={selectedIds}
      onChange={onChange}
      suggestedSlugs={suggestedSlugs}
      maxHeightClass="max-h-64"
    />
  );
}
