'use client';

import { ACTIVITY_ICONS, ACTIVITY_PROFILES, ActivityType } from '@/lib/activity-pace';
import { useEffect, useRef, useState } from 'react';

interface ActivityPickerProps {
  value: ActivityType;
  onChange: (type: ActivityType) => void;
  /** Additional class names for the trigger button wrapper. */
  className?: string;
  /** Compact trigger for panel headers (no full-width button). */
  compact?: boolean;
  /** Which edge of the trigger the dropdown aligns to. */
  menuAlign?: 'left' | 'right';
}

/**
 * Dropdown selector for activity type (Amble / Ramble / Jogger / Runner).
 * Each option shows an SVG icon alongside the activity label and description.
 * Dismisses on outside click or Escape.
 */
export function ActivityPicker({
  value,
  onChange,
  className = '',
  compact = false,
  menuAlign = 'left',
}: ActivityPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
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

  const selected = ACTIVITY_PROFILES[value];
  const icons = ACTIVITY_ICONS[value];

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center hover:bg-gray-100 rounded-lg transition-colors ${
          compact
            ? 'gap-1 px-2 py-1 shrink-0'
            : 'gap-1.5 px-1.5 py-1 w-full'
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected.description}
      >
        <ActivityIcon type={value} size={compact ? 16 : 18} />
        <span className={`font-bold text-slate leading-none ${compact ? 'text-xs' : 'text-sm'}`}>
          {selected.label}
        </span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`w-3 h-3 text-slate-light shrink-0 transition-transform ${compact ? '' : 'ml-auto'}`}
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Select activity"
          className={`absolute top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-45 ${
            menuAlign === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {(Object.keys(ACTIVITY_PROFILES) as ActivityType[]).map(type => {
            const profile = ACTIVITY_PROFILES[type];
            const isSelected = type === value;
            return (
              <button
                key={type}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(type); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  isSelected ? 'bg-green-50 text-green-800' : 'text-slate hover:bg-gray-50'
                }`}
              >
                <ActivityIcon type={type} size={22} color={isSelected ? '#2E7D32' : '#607D8B'} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold leading-none mb-0.5 ${isSelected ? 'text-green-800' : 'text-slate'}`}>
                    {profile.label}
                  </p>
                  <p className="text-[10px] text-slate-light leading-tight">{profile.description}</p>
                </div>
                {isSelected && (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-700 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the SVG icon for a given activity type.
 * All icons use a 24×24 viewBox with stroke-based paths.
 */
export function ActivityIcon({
  type,
  size = 24,
  color = 'currentColor',
  className = '',
}: {
  type: ActivityType;
  size?: number;
  color?: string;
  className?: string;
}) {
  const icon = ACTIVITY_ICONS[type];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={icon.strokeWidth ?? 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {icon.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
