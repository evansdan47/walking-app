'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';

export function BetaBadge({ className = '' }: { className?: string }) {
  const summary = useQuery(api.users.getAccountSummary);
  if (summary && summary.subscription.plan !== 'beta') return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden>
        <path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.8 6.4 19.5l2.1-6.7L3 8.8h6.8L12 2z" />
      </svg>
      Beta
    </span>
  );
}
