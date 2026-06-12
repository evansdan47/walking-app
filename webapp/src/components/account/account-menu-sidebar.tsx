'use client';

import type { ReactNode } from 'react';
import {
  ACCOUNT_EXTERNAL_LINKS,
  ACCOUNT_MENU_VIEWS,
  type AccountMenuView,
} from '@/components/account/account-menu-views';
import { AccountNavIcon } from '@/components/account/account-nav-icon';
import { SubscriptionNavBadge } from '@/components/account/subscription-panel';
import { WEB_APP_VERSION } from '@/lib/app-version';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

type AccountMenuSidebarProps = {
  view: AccountMenuView;
  onSelectView: (view: AccountMenuView) => void;
  onSignOut: () => void;
};

function NavButton({
  active,
  onClick,
  icon,
  label,
  trailing,
}: {
  active: boolean;
  onClick: () => void;
  icon: AccountMenuView | 'account' | 'help';
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors text-left ${
        active
          ? 'bg-emerald-50 text-emerald-900 rounded-r-lg'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg'
      }`}
    >
      <AccountNavIcon icon={icon} size="sm" />
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function AccountMenuSidebar({ view, onSelectView, onSignOut }: AccountMenuSidebarProps) {
  const account = useQuery(api.users.getAccountSummary);

  return (
    <aside className="w-44 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50/80 min-h-0">
      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {ACCOUNT_MENU_VIEWS.map((item) => (
          <NavButton
            key={item.id}
            active={view === item.id}
            onClick={() => onSelectView(item.id)}
            icon={item.id}
            label={item.label}
            trailing={item.id === 'subscription' ? <SubscriptionNavBadge /> : undefined}
          />
        ))}
      </nav>

      <div className="mx-3 border-t border-gray-200" />

      <nav className="flex flex-col gap-0.5 px-2 py-2">
        {ACCOUNT_EXTERNAL_LINKS.map(({ href, label, icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
          >
            <AccountNavIcon icon={icon} size="sm" />
            <span className="flex-1">{label}</span>
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        ))}
        {account?.isAdmin && (
          <a
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
          >
            <AccountNavIcon icon="admin" size="sm" />
            <span className="flex-1">Admin</span>
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        )}
      </nav>

      <div className="flex-1 min-h-2" />

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onSignOut}
          className="w-full text-left px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>

      <div className="px-4 py-3 border-t border-gray-200 text-[10px] text-gray-400 leading-relaxed">
        <p className="font-medium text-gray-500">Rambleio v{WEB_APP_VERSION}</p>
        <p className="mt-0.5">© {new Date().getFullYear()} Rambleio</p>
      </div>
    </aside>
  );
}
