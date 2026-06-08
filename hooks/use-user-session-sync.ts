import { useUser } from '@clerk/expo';
import { api } from '@/convex/_generated/api';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';

import { getMobileClientInfo } from '@/lib/mobile-client-info';

/**
 * Syncs the signed-in Clerk user to Convex and records mobile login metadata.
 * Mount once near the app root (inside Clerk + Convex providers).
 */
export function useUserSessionSync() {
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

    const mobile = getMobileClientInfo();
    void upsertCurrentUser({
      ...(user.fullName ? { name: user.fullName } : {}),
      ...(user.primaryEmailAddress?.emailAddress
        ? { email: user.primaryEmailAddress.emailAddress }
        : {}),
      client: 'mobile',
      mobileBuild: mobile.build,
      mobileVersion: mobile.version,
      mobilePlatform: mobile.platform,
    }).catch(() => {});
  }, [isSignedIn, user, upsertCurrentUser]);
}
