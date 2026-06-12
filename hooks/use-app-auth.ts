import { useAuth } from '@clerk/expo';

/** Clerk-backed auth — stable during Convex JWT refresh blips. */
export function useAppAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  return {
    authLoading: !isLoaded,
    isAuthenticated: isSignedIn ?? false,
  };
}
