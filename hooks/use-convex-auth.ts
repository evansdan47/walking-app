import { useAuth } from "@clerk/expo";

/**
 * Bridges Clerk's auth state into the shape that ConvexProviderWithAuth expects:
 *   { isLoading, isAuthenticated, fetchAccessToken }
 *
 * fetchAccessToken fetches a JWT from Clerk using the "convex" template,
 * which must be configured in the Clerk dashboard (JWT Templates → convex).
 */
export function useConvexAuth() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  return {
    isLoading: !isLoaded,
    isAuthenticated: isSignedIn ?? false,
    fetchAccessToken: async ({
      forceRefreshToken,
    }: {
      forceRefreshToken: boolean;
    }) => {
      const fresh = await getToken({
        template: "convex",
        skipCache: forceRefreshToken,
      });
      if (fresh) return fresh;
      // During forced refresh the cache may be briefly empty — keep the session
      // alive with the last good token instead of dropping all subscriptions.
      if (forceRefreshToken) {
        return (await getToken({ template: "convex", skipCache: false })) ?? null;
      }
      return null;
    },
  };
}
