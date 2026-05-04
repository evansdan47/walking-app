import { useAuth } from '@clerk/expo';
import { Redirect, Slot } from 'expo-router';
import { useEffect } from 'react';
import { Alert, BackHandler } from 'react-native';

export default function TabLayout() {
  const { isSignedIn, isLoaded, signOut } = useAuth();

  // Intercept the Android hardware back button while the user is inside the
  // authenticated tab area.  Without this, pressing back navigates to the
  // sign-in screen even though the user is still signed in, causing a loop.
  // Instead we show a confirmation dialog so accidental presses are safe.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Sign Out',
        'Do you want to sign out?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: () => void signOut() },
        ],
      );
      return true; // block the default back navigation
    });
    return () => subscription.remove();
  }, [signOut]);

  // isLoaded is false both on initial mount AND briefly after SSO setActive
  // while Clerk propagates the new session. Returning null (spinner) in both
  // cases prevents a premature redirect back to sign-in.
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return <Slot />;
}
