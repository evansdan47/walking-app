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
      return (
        (await getToken({ template: "convex", skipCache: forceRefreshToken })) ??
        null
      );
    },
  };
}
