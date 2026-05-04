import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  // If a signed-in user somehow navigates back to the auth screens (e.g. via
  // the Android hardware back button), immediately redirect them to the app.
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/(tabs)" />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
