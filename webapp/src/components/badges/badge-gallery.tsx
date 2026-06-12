'use client';

import { BadgeCategorySection } from '@/components/badges/badge-category-section';
import { BadgeDetailPopover } from '@/components/badges/badge-detail-popover';
import { BadgeGrid, BadgeGridCell } from '@/components/badges/badge-grid';
import { TIER_BORDER, TIER_LABEL, type BadgeTier } from '@/lib/badges/tier-styles';
import { api } from '@convex/_generated/api';
import type { BadgeCategoryGallery, BadgeGalleryItem } from '@/lib/badges/gallery-types';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type StatusFilter = 'all' | 'earned' | 'locked' | 'in_progress';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'locked', label: 'Locked' },
  { id: 'in_progress', label: 'In progress' },
];

function matchesStatusFilter(badge: BadgeGalleryItem, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  return badge.status === filter;
}

function GallerySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-gray-100" />
      ))}
    </div>
  );
}

export type BadgeGalleryProps = {
  /** Dropdown panel uses a compact header; full page shows tier legend. */
  variant?: 'menu' | 'page';
};

export function BadgeGallery({ variant = 'menu' }: BadgeGalleryProps) {
  const gallery = useQuery(api.badges.getGalleryForCurrentUser);
  const recent = useQuery(api.badges.listRecentUnlocked, { limit: 5 });
  const markSeen = useMutation(api.badges.markBadgeSeen);
  const recalculate = useMutation(api.badges.recalculateForCurrentUser);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [recalcState, setRecalcState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    badge: BadgeGalleryItem;
    category: BadgeCategoryGallery;
  } | null>(null);

  const filteredCategories = useMemo(() => {
    if (!gallery) return [];

    return gallery.categories
      .filter((cat) => categoryFilter === null || cat.key === categoryFilter)
      .map((cat) => ({
        ...cat,
        badges: cat.badges.filter((badge) => matchesStatusFilter(badge, statusFilter)),
      }))
      .filter((cat) => cat.badges.length > 0);
  }, [gallery, statusFilter, categoryFilter]);

  function handleMarkSeen(badgeKey: string) {
    void markSeen({ badgeKey }).catch(() => {
      /* non-fatal — dot may persist until next open */
    });
  }

  async function handleRecalculate() {
    setRecalcState('loading');
    setRecalcMessage(null);
    try {
      const result = await recalculate({});
      const unlocked = result.newlyUnlocked.length;
      const progress = result.progressUpdated;
      if (unlocked === 0 && progress === 0) {
        setRecalcMessage('Your badges are up to date.');
      } else {
        const parts: string[] = [];
        if (unlocked > 0) {
          parts.push(`${unlocked} badge${unlocked === 1 ? '' : 's'} unlocked`);
        }
        if (progress > 0) {
          parts.push(
            `progress updated on ${progress} badge${progress === 1 ? '' : 's'}`,
          );
        }
        setRecalcMessage(`${parts.join('; ')}.`);
      }
      setRecalcState('done');
    } catch {
      setRecalcState('error');
      setRecalcMessage('Could not recalculate. Try again.');
    }
  }

  if (gallery === undefined || recent === undefined) {
    return <GallerySkeleton />;
  }

  if (gallery === null) {
    return (
      <p className="text-xs text-gray-500">Sign in to view your badges.</p>
    );
  }

  const isPage = variant === 'page';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`font-bold text-gray-900 ${isPage ? 'text-lg' : 'text-sm'}`}>Badges</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {gallery.earnedCount} of {gallery.totalCount} earned
            {gallery.unseenCount > 0 && (
              <span className="text-brand font-medium"> · {gallery.unseenCount} new</span>
            )}
          </p>
        </div>
        {!isPage && (
          <Link
            href="/account/badges"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand hover:underline shrink-0"
          >
            Open in new window
          </Link>
        )}
      </div>

      {recent.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold text-gray-700 mb-2">Recently unlocked</h3>
          <BadgeGrid ariaLabel="Recently unlocked badges">
            {recent.map((badge) => (
              <BadgeGridCell
                key={badge.key}
                name={badge.name}
                icon={badge.icon}
                categoryColor={badge.categoryColor}
                tier={badge.tier}
                status="earned"
                isNew={badge.isNew}
                onClick={() => {
                  const category = gallery.categories.find((c) => c.key === badge.categoryKey);
                  const item = category?.badges.find((b) => b.key === badge.key);
                  if (category && item) {
                    setSelected({ badge: item, category });
                  }
                }}
              />
            ))}
          </BadgeGrid>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
              statusFilter === f.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-colors ${
            categoryFilter === null
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          All categories
        </button>
        {gallery.categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setCategoryFilter(cat.key)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-colors ${
              categoryFilter === cat.key
                ? 'text-white border-transparent'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            style={
              categoryFilter === cat.key
                ? { backgroundColor: cat.color, borderColor: cat.color }
                : undefined
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredCategories.length === 0 ? (
        <p className="text-xs text-gray-400 py-6 text-center">
          No badges match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <BadgeCategorySection
              key={category.key}
              category={category}
              onSelectBadge={(badge, cat) => setSelected({ badge, category: cat })}
              defaultOpen={categoryFilter !== null || statusFilter !== 'all'}
            />
          ))}
        </div>
      )}

      {isPage && (
        <footer className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-[11px] font-semibold text-gray-700">Tier legend</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(TIER_LABEL) as BadgeTier[]).map((tier) => (
              <div key={tier} className="flex items-center gap-1.5 text-[10px] text-gray-600">
                <span
                  className="w-3 h-3 rounded-full border-2"
                  style={{ borderColor: TIER_BORDER[tier], backgroundColor: 'transparent' }}
                />
                {TIER_LABEL[tier]}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400">
            Badges are earned automatically from your walks, goals, and account activity.
          </p>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => void handleRecalculate()}
              disabled={recalcState === 'loading'}
              className="text-[10px] font-medium text-brand hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {recalcState === 'loading' ? 'Recalculating…' : 'Recalculate my badges'}
            </button>
            {recalcMessage && (
              <p
                className={`text-[10px] ${recalcState === 'error' ? 'text-red-600' : 'text-gray-500'}`}
              >
                {recalcMessage}
              </p>
            )}
          </div>
        </footer>
      )}

      {selected && (
        <BadgeDetailPopover
          badge={selected.badge}
          categoryColor={selected.category.color}
          categoryName={selected.category.name}
          open
          onClose={() => setSelected(null)}
          onMarkSeen={handleMarkSeen}
        />
      )}
    </div>
  );
}
