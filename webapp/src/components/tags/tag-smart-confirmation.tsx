'use client';

import type { Doc, Id } from '@convex/_generated/dataModel';
import { useMemo } from 'react';
import { TagCategoryBrowser } from './tag-category-browser';
import { TagChipList } from './tag-chip';

type TagDefinition = Doc<'tagDefinitions'>;

type Suggestion = {
  tagId: Id<'tagDefinitions'>;
  slug: string;
  label: string;
  confidence: number;
  reason: string;
};

type TagSmartConfirmationProps = {
  allTags: TagDefinition[];
  suggestions: Suggestion[];
  selectedIds: Set<Id<'tagDefinitions'>>;
  onChange: (ids: Set<Id<'tagDefinitions'>>) => void;
};

export function TagSmartConfirmation({
  allTags,
  suggestions,
  selectedIds,
  onChange,
}: TagSmartConfirmationProps) {
  const suggestedSlugs = useMemo(() => new Set(suggestions.map((s) => s.slug)), [suggestions]);
  const quickAddTags = useMemo(
    () =>
      allTags.filter(
        (tag) =>
          (tag.kind === 'subjective' || tag.category === 'features' || tag.category === 'dog') &&
          !selectedIds.has(tag._id),
      ),
    [allTags, selectedIds],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-slate mb-1">We&apos;ve identified</p>
        <TagChipList
          items={suggestions.map((s) => ({
            id: s.tagId,
            label: s.label,
            suggested: !selectedIds.has(s.tagId),
          }))}
          selectedIds={selectedIds}
          onToggle={(id) => {
            const next = new Set(selectedIds);
            if (next.has(id as Id<'tagDefinitions'>)) next.delete(id as Id<'tagDefinitions'>);
            else next.add(id as Id<'tagDefinitions'>);
            onChange(next);
          }}
        />
        <p className="text-[11px] text-slate-light mt-2">Tap to confirm or remove suggestions.</p>
      </div>

      {quickAddTags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate mb-2">Anything else worth mentioning?</p>
          <TagChipList
            items={quickAddTags.slice(0, 12).map((tag) => ({
              id: tag._id,
              label: tag.label,
              kind: tag.kind,
            }))}
            selectedIds={selectedIds}
            onToggle={(id) => {
              const next = new Set(selectedIds);
              const tagId = id as Id<'tagDefinitions'>;
              if (next.has(tagId)) next.delete(tagId);
              else next.add(tagId);
              onChange(next);
            }}
          />
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-light hover:text-slate font-medium">
          Browse all tags
        </summary>
        <div className="mt-2">
          <TagCategoryBrowser
            tags={allTags}
            selectedIds={selectedIds}
            onChange={onChange}
            suggestedSlugs={suggestedSlugs}
            maxHeightClass="max-h-40"
          />
        </div>
      </details>
    </div>
  );
}
