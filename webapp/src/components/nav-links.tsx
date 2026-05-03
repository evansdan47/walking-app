'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';

const NAV_LINKS = [
  { mode: 'explore', label: 'Explore' },
  { mode: 'walks', label: 'My Walks' },
  { mode: 'planner', label: 'Planner' },
  { mode: 'community', label: 'Community' },
];

/**
 * Navigation links that switch modes on the /map page, forwarding
 * the current map viewport (?lat/lng/zoom) so position is preserved.
 */
export function NavLinks() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeMode = searchParams.get('mode');

  function navigate(e: MouseEvent<HTMLAnchorElement>, mode: string) {
    e.preventDefault();
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams();
    next.set('mode', mode);
    const lat = current.get('lat');
    const lng = current.get('lng');
    const zoom = current.get('zoom');
    if (lat) next.set('lat', lat);
    if (lng) next.set('lng', lng);
    if (zoom) next.set('zoom', zoom);
    router.push(`/map?${next.toString()}`);
  }

  return (
    <>
      {NAV_LINKS.map(({ mode, label }) => (
        <a
          key={mode}
          href={`/map?mode=${mode}`}
          onClick={(e) => navigate(e, mode)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
            activeMode === mode
              ? 'text-brand border-b-2 border-brand'
              : 'text-slate hover:text-brand'
          }`}
        >
          {label}
        </a>
      ))}
    </>
  );
}
