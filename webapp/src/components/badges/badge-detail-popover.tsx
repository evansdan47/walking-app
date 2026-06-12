'use client';

import { fireBadgeConfetti } from '@/lib/badges/badge-confetti';
import { TIER_LABEL, type BadgeTier } from '@/lib/badges/tier-styles';
import type { BadgeGalleryItem } from '@/lib/badges/gallery-types';
import { useEffect, useRef } from 'react';
import { BadgeHex } from './badge-hex';

export type BadgeDetailPopoverProps = {
  badge: BadgeGalleryItem;
  categoryColor: string;
  categoryName: string;
  open: boolean;
  onClose: () => void;
  onMarkSeen?: (badgeKey: string) => void;
};

function formatUnlockDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatProgressValue(value: number, target: number): string {
  if (target >= 1000 && target % 1000 === 0) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} / ${target / 1000} km`;
  }
  return `${value.toLocaleString()} / ${target.toLocaleString()}`;
}

export function BadgeDetailPopover({
  badge,
  categoryColor,
  categoryName,
  open,
  onClose,
  onMarkSeen,
}: BadgeDetailPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      celebratedRef.current = false;
      return;
    }

    if (badge.status === 'earned' && badge.isNew && !celebratedRef.current) {
      celebratedRef.current = true;
      void fireBadgeConfetti(categoryColor);
    }

    if (badge.isNew && onMarkSeen) {
      onMarkSeen(badge.key);
    }
  }, [open, badge.isNew, badge.key, badge.status, categoryColor, onMarkSeen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onPointer(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const tierLabel = badge.tier ? TIER_LABEL[badge.tier as BadgeTier] : null;
  const description =
    badge.status === 'locked' && badge.lockedDescription
      ? badge.lockedDescription
      : badge.description;
  const celebrating = badge.status === 'earned' && badge.isNew;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/30">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${badge.name} badge details`}
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        {celebrating && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-50/90 to-transparent"
            aria-hidden
          />
        )}

        <div className="relative space-y-4 p-4">
          {celebrating && (
            <p className="text-center text-xs font-semibold text-brand">Badge unlocked!</p>
          )}

          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BadgeHex
                name=""
                icon={badge.icon}
                categoryColor={categoryColor}
                tier={badge.tier}
                status={badge.status}
                progressPercent={badge.progressPercent}
                isNew={badge.isNew}
                size="md"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold leading-snug text-gray-900">{badge.name}</h3>
                <p className="mt-0.5 text-[11px] text-gray-500">{categoryName}</p>
                {tierLabel && (
                  <p className="mt-1 text-[10px] font-semibold text-gray-600">{tierLabel} tier</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-xs leading-relaxed text-gray-600">{description}</p>

          {badge.status === 'earned' && badge.unlockedAt !== undefined && (
            <p className="text-[11px] font-medium text-emerald-700">
              Earned {formatUnlockDate(badge.unlockedAt)}
            </p>
          )}

          {badge.status === 'in_progress' &&
            badge.progressPercent !== undefined &&
            badge.currentValue !== undefined &&
            badge.targetValue !== undefined && (
              <div>
                <div className="mb-1 flex justify-between text-[10px] text-gray-600">
                  <span>Progress</span>
                  <span className="tabular-nums">{badge.progressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${badge.progressPercent}%`,
                      backgroundColor: categoryColor,
                    }}
                  />
                </div>
                <p className="mt-1 tabular-nums text-[10px] text-gray-500">
                  {formatProgressValue(badge.currentValue, badge.targetValue)}
                </p>
              </div>
            )}

          {badge.status === 'locked' && (
            <p className="text-[10px] text-gray-400">
              Earned automatically when you meet the criteria.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
