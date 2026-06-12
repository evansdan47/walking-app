'use client';

import type { BadgeGalleryStatus } from '@/lib/badges/gallery-types';
import type { BadgeTier } from '@/lib/badges/tier-styles';
import type { ReactNode } from 'react';
import { BadgeHex } from './badge-hex';

export type BadgeGridProps = {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
};

export function BadgeGrid({ children, ariaLabel, className = '' }: BadgeGridProps) {
  return (
    <div
      className={`grid grid-cols-5 gap-x-1 gap-y-3 ${className}`}
      role="list"
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
    >
      {children}
    </div>
  );
}

export type BadgeGridCellProps = {
  name: string;
  icon: string;
  categoryColor: string;
  tier?: BadgeTier;
  status: BadgeGalleryStatus;
  progressPercent?: number;
  isNew?: boolean;
  lockedDescription?: string;
  onClick?: () => void;
};

export function BadgeGridCell({
  name,
  icon,
  categoryColor,
  tier,
  status,
  progressPercent,
  isNew,
  lockedDescription,
  onClick,
}: BadgeGridCellProps) {
  const locked = status === 'locked';

  return (
    <button
      type="button"
      role="listitem"
      onClick={onClick}
      className="flex min-w-0 flex-col items-center rounded-lg p-1 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label={`${name} badge, ${status.replace('_', ' ')}`}
      title={locked && lockedDescription ? lockedDescription : undefined}
    >
      <div className="flex h-14 w-full shrink-0 items-center justify-center">
        <BadgeHex
          name=""
          icon={icon}
          categoryColor={categoryColor}
          tier={tier}
          status={status}
          progressPercent={progressPercent}
          isNew={isNew}
          size="md"
        />
      </div>
      <div className="h-10 w-full shrink-0 pt-2">
        <span
          className={`block w-full text-center text-[10px] leading-[1.2] line-clamp-2 ${
            locked ? 'text-gray-400' : 'text-gray-700'
          }`}
        >
          {name}
        </span>
      </div>
    </button>
  );
}
