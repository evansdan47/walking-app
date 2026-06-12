'use client';

import { BadgeIcon } from '@/lib/badges/icon-map';
import {
  DEFAULT_BADGE_SHINE_EFFECT,
  type BadgeShineEffect,
  isBadgeShineEffect,
} from '@/lib/badges/shine-effects';
import { HEX_CLIP_PATH, TIER_BORDER, TIER_GLOW, type BadgeTier } from '@/lib/badges/tier-styles';
import type { BadgeGalleryStatus } from '@/lib/badges/gallery-types';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

export type BadgeHexProps = {
  name: string;
  icon: string;
  categoryColor: string;
  tier?: BadgeTier;
  status: BadgeGalleryStatus;
  progressPercent?: number;
  isNew?: boolean;
  /** Override the global new-badge shine style (admin preview). */
  newShineEffect?: BadgeShineEffect;
  /** Shown on hover when the badge is locked. */
  lockedDescription?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
};

const SIZES = {
  sm: { tile: 'w-11 h-12', icon: 'w-4 h-4', ring: 44 },
  md: { tile: 'w-14 h-16', icon: 'w-5 h-5', ring: 54 },
  lg: { tile: 'w-16 h-[4.5rem]', icon: 'w-6 h-6', ring: 62 },
} as const;

const LOCKED_FILL = '#E5E7EB';
const IN_PROGRESS_EMPTY = '#D1D5DB';

export function BadgeHex({
  name,
  icon,
  categoryColor,
  tier,
  status,
  progressPercent = 0,
  isNew = false,
  newShineEffect,
  lockedDescription,
  size = 'md',
  onClick,
  className = '',
}: BadgeHexProps) {
  const uiSettings = useQuery(api.badges.getUiSettings);
  const dims = SIZES[size];
  const locked = status === 'locked';
  const earned = status === 'earned';
  const inProgress = status === 'in_progress';
  const fillPercent = Math.min(100, Math.max(0, progressPercent));
  const borderColor = tier ? TIER_BORDER[tier] : 'rgba(255,255,255,0.35)';
  const glow = tier ? TIER_GLOW[tier] : 'none';
  const showNewShine = isNew && earned;

  const configuredEffect = uiSettings?.newBadgeShineEffect;
  const shineEffect =
    newShineEffect ??
    (configuredEffect && isBadgeShineEffect(configuredEffect)
      ? configuredEffect
      : DEFAULT_BADGE_SHINE_EFFECT);

  const hoverHint =
    locked && lockedDescription ? lockedDescription : locked && name ? name : undefined;

  const hexBackground = locked
    ? LOCKED_FILL
    : inProgress
      ? IN_PROGRESS_EMPTY
      : categoryColor;

  const content = (
    <div
      className={`relative flex flex-col items-center gap-1 ${className}`}
      title={hoverHint}
    >
      <div className="relative" style={{ width: dims.ring, height: dims.ring }}>
        <div
          className={`absolute inset-0 m-auto ${dims.tile} flex items-center justify-center overflow-hidden text-white transition-opacity ${
            locked ? 'opacity-55 grayscale' : ''
          }`}
          style={{
            clipPath: HEX_CLIP_PATH,
            backgroundColor: hexBackground,
            boxShadow: locked ? 'none' : earned ? glow : 'none',
            border: `2px solid ${locked ? '#CBD5E1' : borderColor}`,
          }}
        >
          {inProgress && (
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${fillPercent}%`,
                backgroundColor: categoryColor,
              }}
              aria-hidden
            />
          )}

          {showNewShine && (
            <div className="badge-shine z-[2]" aria-hidden>
              <div className={`badge-shine-band badge-shine-band--${shineEffect}`} />
            </div>
          )}

          <BadgeIcon
            iconKey={icon}
            className={`relative z-[3] ${dims.icon} ${locked ? 'opacity-70' : ''}`}
          />

          {locked && (
            <div className="absolute inset-0 z-[4] flex items-center justify-center bg-black/20">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/90" fill="currentColor" aria-hidden>
                <path d="M17 10h-1V8a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-3 0h-4V8a2 2 0 1 1 4 0v2Z" />
              </svg>
            </div>
          )}

          {earned && (
            <div
              className="absolute bottom-1 right-[18%] z-[4] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/95 shadow-sm"
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 text-emerald-600" fill="currentColor">
                <path d="M9.55 17.05 4.5 12l1.4-1.43 3.65 3.65 8.55-8.55L19.5 6.5l-9.95 10.55Z" />
              </svg>
            </div>
          )}
        </div>

        {showNewShine && (
          <span
            className="pointer-events-none absolute -top-0.5 -right-0.5 z-[5] rounded-full bg-brand px-1 py-px text-[7px] font-bold uppercase tracking-wide text-white ring-2 ring-white"
            aria-hidden
          >
            New
          </span>
        )}
      </div>

      {name ? (
        <span
          className={`text-center leading-tight max-w-[4.5rem] ${
            size === 'sm' ? 'text-[9px]' : 'text-[10px]'
          } ${locked ? 'text-gray-400' : inProgress ? 'text-gray-600' : 'text-gray-700'}`}
        >
          {name}
        </span>
      ) : null}
    </div>
  );

  if (!onClick) return content;

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg hover:bg-gray-50 p-1 -m-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      aria-label={`${name} badge, ${status.replace('_', ' ')}`}
    >
      {content}
    </button>
  );
}
