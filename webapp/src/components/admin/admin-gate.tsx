'use client';

import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const summary = useQuery(api.users.getAccountSummary);

  useEffect(() => {
    if (summary === null) {
      router.replace('/home');
      return;
    }
    if (summary && !summary.isAdmin) {
      router.replace('/home');
    }
  }, [summary, router]);

  if (summary === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading admin…</p>
      </div>
    );
  }

  if (!summary?.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
