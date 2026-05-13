import { useAuth } from '@clerk/expo';
import { Redirect, Slot } from 'expo-router';

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  // isLoaded is false both on initial mount AND briefly after SSO setActive
  // while Clerk propagates the new session. Returning null (spinner) in both
  // cases prevents a premature redirect back to sign-in.
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return <Slot />;
}
