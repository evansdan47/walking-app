'use client';

import { AccountMenuPanel } from '@/components/account/account-menu-panel';
import { UserAvatar } from '@/components/account/user-avatar';
import { useRef, useState } from 'react';

export function AccountMenuTrigger() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 hover:bg-gray-100 transition-colors"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Account menu"
      >
        <UserAvatar size="sm" />
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AccountMenuPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
      />
    </>
  );
}
