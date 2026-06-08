'use client';

import type { Id } from '@convex/_generated/dataModel';
import { useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useUserPreferences } from '@/components/user-preferences-context';
import { formatDistanceMetresShort, formatElevationCompact } from '@/lib/format-units';
import { buildRoutePolyline, routeDifficultyColor } from '@/lib/route-thumb';

const ROUTE_THUMB_SIZE = 64;

export type WalkCardPhoto = {
  _id: Id<'walkPhotos'>;
  timestamp: number;
  url: string | null;
};

export type WalkCardEnrichment = {
  totalPhotos: number;
  photos: WalkCardPhoto[];
  routeCoordinates: Array<[number, number]>;
};

type WalkActivityCardProps = {
  walk: {
    _id: Id<'walks'>;
    title?: string;
    startedAt: number;
    status: string;
    stats?: {
      distanceMetres: number;
      durationSeconds: number;
      elevationGainMetres?: number;
    };
  };
  enrichment?: WalkCardEnrichment;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
  onView: () => void;
  onRemove: () => void;
};

function formatCardDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDurationShort(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function RouteThumb({
  coordinates,
  distanceMetres,
  elevationGainMetres,
}: {
  coordinates: Array<[number, number]>;
  distanceMetres: number;
  elevationGainMetres?: number;
}) {
  const polyline = buildRoutePolyline(coordinates, ROUTE_THUMB_SIZE);
  const stroke = routeDifficultyColor(distanceMetres, elevationGainMetres ?? 0);

  if (!polyline) {
    return <div className="w-16 h-16 shrink-0" />;
  }

  return (
    <svg
      width={ROUTE_THUMB_SIZE}
      height={ROUTE_THUMB_SIZE}
      viewBox={`0 0 ${ROUTE_THUMB_SIZE} ${ROUTE_THUMB_SIZE}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardMenu({
  onView,
  onRemoveRequest,
}: {
  onView: () => void;
  onRemoveRequest: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Walk options"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-sm text-slate hover:bg-gray-50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onView();
            }}
          >
            View
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRemoveRequest();
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export function WalkActivityCard({
  walk,
  enrichment,
  isHovered,
  onHover,
  onView,
  onRemove,
}: WalkActivityCardProps) {
  const { distanceUnit, elevationUnit } = useUserPreferences();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isInProgress = walk.status === 'recording' || walk.status === 'paused';

  const displayTitle =
    walk.title ??
    new Date(walk.startedAt).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const photos = enrichment?.photos ?? [];
  const totalPhotos = enrichment?.totalPhotos ?? 0;
  const extraPhotos = Math.max(0, totalPhotos - photos.length);
  const routeCoordinates = enrichment?.routeCoordinates ?? [];

  return (
    <>
      <article
        className={`rounded-xl border overflow-hidden bg-white transition-all cursor-pointer ${
          isHovered ? 'border-brand shadow-sm ring-1 ring-brand/20' : 'border-gray-100 hover:border-gray-200'
        }`}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={onView}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onView();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {/* Header: date + menu */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isInProgress && (
              <span className="shrink-0 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
            <p className="text-sm font-semibold text-green-700 truncate">
              {formatCardDate(walk.startedAt)}
            </p>
          </div>
          <CardMenu onView={onView} onRemoveRequest={() => setConfirmRemove(true)} />
        </div>

        {/* Photo strip */}
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-0.5 px-0.5">
            {photos.slice(0, 4).map((photo, idx) => {
              const isLast = idx === 3 && extraPhotos > 0;
              return (
                <div key={photo._id} className="relative aspect-square bg-gray-100 overflow-hidden">
                  {photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a41.09 41.09 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </div>
                  )}
                  {isLast && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <span className="text-white font-bold text-base">+{extraPhotos}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Route thumb + title + stats */}
        <div className="flex items-center gap-2 p-3">
          <RouteThumb
            coordinates={routeCoordinates}
            distanceMetres={walk.stats?.distanceMetres ?? 0}
            {...(walk.stats?.elevationGainMetres !== undefined
              ? { elevationGainMetres: walk.stats.elevationGainMetres }
              : {})}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{displayTitle}</p>
            {walk.stats && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 4v16M7 8l6-4 6 4" />
                  </svg>
                  {formatDistanceMetresShort(walk.stats.distanceMetres, distanceUnit)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  {formatDurationShort(walk.stats.durationSeconds)}
                </span>
                {(walk.stats.elevationGainMetres ?? 0) >= 1 && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 18 L12 6 L20 18 Z" />
                    </svg>
                    {formatElevationCompact(walk.stats.elevationGainMetres!, elevationUnit)}
                  </span>
                )}
              </div>
            )}
          </div>
          <span className="text-xl text-gray-300 shrink-0 leading-none" aria-hidden="true">›</span>
        </div>
      </article>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this walk?"
        message="This will permanently delete the walk, its GPS track, and all photos from your account. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => {
          setConfirmRemove(false);
          onRemove();
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}
