'use client';

import { UserSessionSync } from '@/components/user-session-sync';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useMemo } from 'react';

function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  const convex = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
    [],
  );
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSessionSync />
      {children}
    </ConvexProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/">
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </ClerkProvider>
  );
}
