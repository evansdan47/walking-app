'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { TagChipList } from './tag-chip';

type RouteTagDisplayProps = {
  plannedRouteId: Id<'plannedRoutes'>;
  className?: string;
};

/**
 * Read-only route tags for Explore detail — creator tags and community-confirmed rollups.
 */
export function RouteTagDisplay({ plannedRouteId, className = '' }: RouteTagDisplayProps) {
  const summary = useQuery(api.tags.getRouteTagSummary, { plannedRouteId });

  if (summary === undefined) {
    return (
      <div className={className}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Route tags</p>
        <div className="h-6 w-32 bg-gray-100 rounded-full animate-pulse" />
      </div>
    );
  }

  if (!summary) return null;

  const visible = summary.tags
    .filter((row) => row.display)
    .sort((a, b) => {
      if (a.tag.category === b.tag.category) return a.tag.sortOrder - b.tag.sortOrder;
      return a.tag.category.localeCompare(b.tag.category);
    });

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Route tags</p>
      <TagChipList
        size="md"
        items={visible.map((row) => ({
          id: row.tagId,
          label: row.tag.label,
          kind: row.tag.kind,
          count:
            row.tag.kind === 'subjective' && row.confirmationCount > 0
              ? row.confirmationCount
              : row.tag.kind !== 'subjective' && row.confirmationCount > 0
                ? row.confirmationCount
                : undefined,
        }))}
      />
      {visible.some((row) => row.tag.kind === 'subjective' && row.confirmationCount > 0) && (
        <p className="text-[10px] text-gray-400 mt-2">Walker counts show community confirmations.</p>
      )}
    </div>
  );
}
