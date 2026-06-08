'use client';

import { api } from '@convex/_generated/api';
import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';

import { WEB_APP_VERSION } from '@/lib/app-version';

/**
 * Records web sign-in / session start in Convex (lastLoginAtWeb, lastWebAppVersion).
 * Mount inside ConvexProviderWithClerk.
 */
export function UserSessionSync() {
  const { user, isSignedIn } = useUser();
  const upsertCurrentUser = useMutation(api.users.upsertCurrentUser);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user) {
      lastUserIdRef.current = null;
      return;
    }

    if (lastUserIdRef.current === user.id) return;
    lastUserIdRef.current = user.id;

    const name = user.fullName ?? undefined;
    const email = user.primaryEmailAddress?.emailAddress ?? undefined;

    void upsertCurrentUser({
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      client: 'web',
      webAppVersion: WEB_APP_VERSION,
    }).catch(() => {});
  }, [isSignedIn, user, upsertCurrentUser]);

  return null;
}
