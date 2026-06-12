'use client';

import type { BadgeCategoryGallery, BadgeGalleryItem } from '@/lib/badges/gallery-types';
import { useState } from 'react';
import { BadgeGrid, BadgeGridCell } from './badge-grid';

export type BadgeCategorySectionProps = {
  category: BadgeCategoryGallery;
  onSelectBadge: (badge: BadgeGalleryItem, category: BadgeCategoryGallery) => void;
  defaultOpen?: boolean;
};

export function BadgeCategorySection({
  category,
  onSelectBadge,
  defaultOpen = true,
}: BadgeCategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const earned = category.badges.filter((b) => b.status === 'earned').length;

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: category.color }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{category.name}</p>
          <p className="text-[10px] text-gray-500">
            {earned} of {category.badges.length} earned
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-4 pt-2 border-t border-gray-100">
          <BadgeGrid ariaLabel={`${category.name} badges`}>
            {category.badges.map((badge) => (
              <BadgeGridCell
                key={badge.key}
                name={badge.name}
                icon={badge.icon}
                categoryColor={category.color}
                tier={badge.tier}
                status={badge.status}
                progressPercent={badge.progressPercent}
                isNew={badge.isNew}
                lockedDescription={badge.lockedDescription}
                onClick={() => onSelectBadge(badge, category)}
              />
            ))}
          </BadgeGrid>
        </div>
      )}
    </section>
  );
}
