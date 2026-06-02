'use client';

import { NavLinks } from '@/components/nav-links';
import { StartWalkButton } from '@/components/app-download-panel';
import { usePreview } from '@/components/preview-context';
import { usePace } from '@/components/pace-context';
import { ActivityPicker } from '@/components/ui/activity-picker';
import { UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

export function DashboardHeader() {
  const { isPreviewing } = usePreview();
  const { pace, setPace } = usePace();

  return (
    <header
      className={[
        'absolute top-0 left-0 right-0 z-20',
        'bg-white/95 backdrop-blur-sm border-b border-gray-200/80 shadow-sm',
        'transition-transform duration-300 ease-in-out',
        isPreviewing ? '-translate-y-full pointer-events-none' : 'translate-y-0',
      ].join(' ')}
    >
      <div className="h-14 px-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/home" className="shrink-0">
            <Image
              src="/Logo.png"
              alt="Rambleio"
              height={32}
              width={32}
              className="h-8 w-8"
              priority
            />
          </Link>
        </div>

        {/* Center: Nav links — absolutely centered in the header */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLinks />
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          {/* Global pace selector */}
          <ActivityPicker value={pace} onChange={setPace} />
          <button className="w-8 h-8 flex items-center justify-center text-slate hover:text-slate rounded-md hover:bg-gray-100 transition-colors" aria-label="Notifications">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <Link
            href="/profile"
            className="w-8 h-8 flex items-center justify-center text-slate hover:text-slate rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Profile settings"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </Link>
          <StartWalkButton />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
