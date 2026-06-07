'use client';

import { NavLinks } from '@/components/nav-links';
import { usePreview } from '@/components/preview-context';
import { UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

export function DashboardHeader() {
  const { isPreviewing } = usePreview();

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

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          <Suspense fallback={null}>
            <NavLinks />
          </Suspense>
        </nav>

        {/* Right: Account */}
        <div className="flex items-center justify-end shrink-0">
          <UserButton />
        </div>
      </div>
    </header>
  );
}
