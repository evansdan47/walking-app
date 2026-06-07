'use client';

import type { Id } from '@convex/_generated/dataModel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ActivityWalkPhoto } from '@/components/activity/activity-walk-photo';

type WalkPhotoViewerModalProps = {
  open: boolean;
  photos: ActivityWalkPhoto[];
  initialIndex: number;
  walkStartedAt: number;
  onClose: () => void;
  onActivePhotoChange?: (photoId: Id<'walkPhotos'> | null) => void;
};

function formatPhotoClockTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatElapsedFromStart(walkStartedAt: number, photoTs: number) {
  const secs = Math.max(0, Math.round((photoTs - walkStartedAt) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function WalkPhotoViewerModal({
  open,
  photos,
  initialIndex,
  walkStartedAt,
  onClose,
  onActivePhotoChange,
}: WalkPhotoViewerModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const thumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const current = photos[index];
  const canGoPrev = index > 0;
  const canGoNext = index < photos.length - 1;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(photos.length - 1, i + 1));
  }, [photos.length]);

  useEffect(() => {
    if (!open || !current) {
      onActivePhotoChange?.(null);
      return;
    }
    onActivePhotoChange?.(current._id);
  }, [open, current, onActivePhotoChange]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    const el = thumbRefs.current.get(index);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [index, open]);

  if (!open || photos.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Walk photo viewer"
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full text-white/90 hover:bg-white/10 transition-colors"
          aria-label="Close photo viewer"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {current && (
          <div className="px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium tabular-nums">
            {formatPhotoClockTime(current.timestamp)}
            <span className="text-white/60 mx-1.5">·</span>
            +{formatElapsedFromStart(walkStartedAt, current.timestamp)}
          </div>
        )}
        <div className="w-10" aria-hidden="true" />
      </div>

      {/* Main image */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-2">
        {current?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current._id}
            src={current.url}
            alt={current.caption ?? 'Walk photo'}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        ) : (
          <div className="text-white/50 text-sm">Image unavailable</div>
        )}

        {canGoPrev && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Previous photo"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        {canGoNext && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            aria-label="Next photo"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        <button
          type="button"
          className="absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize opacity-0"
          aria-hidden="true"
          tabIndex={-1}
          onClick={goPrev}
        />
        <button
          type="button"
          className="absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize opacity-0"
          aria-hidden="true"
          tabIndex={-1}
          onClick={goNext}
        />
      </div>

      {/* Footer: counter + thumbnail rail */}
      <div className="shrink-0 border-t border-white/10 bg-black/80 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-white/70 text-xs font-medium py-2 tabular-nums">
          Photo {index + 1} of {photos.length}
        </p>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {photos.map((photo, i) => {
            const isActive = i === index;
            return (
              <button
                key={photo._id}
                ref={(el) => {
                  if (el) thumbRefs.current.set(i, el);
                  else thumbRefs.current.delete(i);
                }}
                type="button"
                onClick={() => setIndex(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  isActive ? 'border-white ring-2 ring-white/40 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                aria-label={`View photo ${i + 1}`}
                aria-current={isActive ? 'true' : undefined}
              >
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt="" className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
