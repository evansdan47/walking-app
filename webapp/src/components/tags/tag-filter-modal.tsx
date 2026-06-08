'use client';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { TagCategoryBrowser } from './tag-category-browser';

type TagFilterModalProps = {
  open: boolean;
  selectedSlugs: string[];
  onApply: (slugs: string[]) => void;
  onClose: () => void;
};

function slugsToIds(slugs: string[], tags: Doc<'tagDefinitions'>[]): Set<Id<'tagDefinitions'>> {
  const bySlug = new Map(tags.map((t) => [t.slug, t._id]));
  return new Set(slugs.map((s) => bySlug.get(s)).filter((id): id is Id<'tagDefinitions'> => !!id));
}

function idsToSlugs(ids: Set<Id<'tagDefinitions'>>, tags: Doc<'tagDefinitions'>[]): string[] {
  const byId = new Map(tags.map((t) => [t._id, t.slug]));
  return [...ids].map((id) => byId.get(id)).filter((s): s is string => !!s);
}

export function TagFilterModal({ open, selectedSlugs, onApply, onClose }: TagFilterModalProps) {
  const allTags = useQuery(api.tags.listActiveTags, open ? {} : 'skip');
  const bootstrapTags = useMutation(api.tags.bootstrapTagDefinitionsIfEmpty);
  const [selectedIds, setSelectedIds] = useState<Set<Id<'tagDefinitions'>>>(new Set());
  const bootstrapAttempted = useRef(false);

  const tags = allTags ?? [];

  useEffect(() => {
    if (!open || !allTags?.length) return;
    setSelectedIds(slugsToIds(selectedSlugs, allTags));
  }, [open, selectedSlugs, allTags]);

  useEffect(() => {
    if (!open) {
      bootstrapAttempted.current = false;
      return;
    }
    if (allTags === undefined || allTags.length > 0 || bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void bootstrapTags({});
  }, [open, allTags, bootstrapTags]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-filter-title"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full sm:max-w-lg mx-0 sm:mx-4 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="h-1 w-full bg-brand shrink-0" />
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 id="tag-filter-title" className="text-base font-bold text-slate">
            Filter by tags
          </h2>
          <p className="text-[11px] text-slate-light mt-0.5">
            Choose what you&apos;re looking for — routes matching any selected tag will appear.
          </p>
        </div>

        <div className="px-5 py-4 overflow-y-auto min-h-0 flex-1">
          <TagCategoryBrowser
            tags={tags}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            isLoading={allTags === undefined}
            maxHeightClass="max-h-none"
          />
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedCount === 0}
            className="text-sm font-medium text-slate hover:text-brand disabled:opacity-40"
          >
            Clear tags
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(idsToSlugs(selectedIds, tags));
                onClose();
              }}
              className="px-4 py-2 text-sm font-semibold bg-brand hover:bg-brand-dark text-white rounded-lg"
            >
              {selectedCount > 0 ? `Apply (${selectedCount})` : 'Show all routes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
