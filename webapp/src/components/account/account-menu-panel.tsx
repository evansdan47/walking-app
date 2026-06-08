'use client';

import { AccountMenuOverview } from '@/components/account/account-menu-overview';
import { AccountMenuPreferences } from '@/components/account/account-menu-preferences';
import { AccountMenuProfile } from '@/components/account/account-menu-profile';
import { AccountMenuGoals } from '@/components/account/account-menu-goals';
import { AccountMenuSubscription } from '@/components/account/account-menu-subscription';
import { AccountMenuSection } from '@/components/account/account-menu-section';
import { AccountMenuSidebar } from '@/components/account/account-menu-sidebar';
import {
  ACCOUNT_MENU_VIEW_COPY,
  type AccountMenuView,
} from '@/components/account/account-menu-views';
import { useClerk } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type AccountMenuPanelProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

export function AccountMenuPanel({ open, onClose, anchorRef }: AccountMenuPanelProps) {
  const { signOut } = useClerk();
  const [view, setView] = useState<AccountMenuView>('overview');
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setView('overview');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  function handleSignOut() {
    onClose();
    void signOut({ redirectUrl: '/' });
  }

  if (!mounted || !open) return null;

  const copy = ACCOUNT_MENU_VIEW_COPY[view];

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="Account menu"
      className="fixed top-14 right-3 sm:right-4 z-50 w-[min(100vw-1.5rem,44rem)] max-h-[calc(100vh-4rem)] flex flex-col rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden"
    >
      <div className="flex flex-1 min-h-0 relative">
        <AccountMenuSidebar
          view={view}
          onSelectView={setView}
          onSignOut={handleSignOut}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label="Close account menu"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            {view === 'overview' ? (
              <AccountMenuOverview onNavigate={setView} />
            ) : view === 'profile' ? (
              <AccountMenuProfile />
            ) : view === 'preferences' ? (
              <AccountMenuPreferences />
            ) : view === 'subscription' ? (
              <AccountMenuSubscription />
            ) : view === 'goals' ? (
              <AccountMenuGoals />
            ) : (
              <AccountMenuSection title={copy.title} description={copy.description} />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
