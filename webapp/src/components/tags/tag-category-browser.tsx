'use client';

import type { Doc, Id } from '@convex/_generated/dataModel';
import { useMemo, useState } from 'react';
import { groupTagsByCategory } from '@/lib/tag-categories';
import { TagChipList } from './tag-chip';

type TagDefinition = Doc<'tagDefinitions'>;

type TagCategoryBrowserProps = {
  tags: TagDefinition[];
  selectedIds: Set<Id<'tagDefinitions'>>;
  onChange: (ids: Set<Id<'tagDefinitions'>>) => void;
  /** Slugs pre-selected by auto-detect (highlighted when not yet toggled on). */
  suggestedSlugs?: Set<string>;
  maxHeightClass?: string;
  isLoading?: boolean;
};

export function TagCategoryBrowser({
  tags,
  selectedIds,
  onChange,
  suggestedSlugs,
  maxHeightClass = 'max-h-52',
  isLoading = false,
}: TagCategoryBrowserProps) {
  const groups = useMemo(() => groupTagsByCategory(tags), [tags]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleTag(tagId: Id<'tagDefinitions'>) {
    const next = new Set(selectedIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    onChange(next);
  }

  function isExpanded(category: string) {
    return expanded[category] ?? true;
  }

  function toggleCategory(category: string) {
    setExpanded((prev) => ({ ...prev, [category]: !isExpanded(category) }));
  }

  if (isLoading) {
    return <p className="text-[11px] text-slate-light py-2">Loading tags…</p>;
  }

  if (tags.length === 0) {
    return (
      <p className="text-[11px] text-slate-light py-2">
        Tag vocabulary is not available yet. It should load automatically — try closing and reopening this dialog.
      </p>
    );
  }

  return (
    <div className={`overflow-y-auto pr-1 ${maxHeightClass}`}>
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const selectedInGroup = group.tags.filter((t) => selectedIds.has(t._id)).length;
          return (
            <section key={group.category}>
              <button
                type="button"
                onClick={() => toggleCategory(group.category)}
                className="w-full flex items-center justify-between text-left mb-1.5 group"
              >
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-light group-hover:text-slate">
                  {group.label}
                </span>
                <span className="flex items-center gap-2">
                  {selectedInGroup > 0 && (
                    <span className="text-[10px] font-semibold text-brand">{selectedInGroup}</span>
                  )}
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 text-slate-light transition-transform ${isExpanded(group.category) ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              {isExpanded(group.category) && (
                <TagChipList
                  items={group.tags.map((tag) => ({
                    id: tag._id,
                    label: tag.label,
                    kind: tag.kind,
                    suggested: suggestedSlugs?.has(tag.slug) && !selectedIds.has(tag._id),
                  }))}
                  selectedIds={selectedIds}
                  onToggle={(id) => toggleTag(id as Id<'tagDefinitions'>)}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
