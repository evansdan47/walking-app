import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Closing the Chrome Custom Tab here lets the startSSOFlow() promise resolve
// with the session credentials so Clerk can call setActive().
WebBrowser.maybeCompleteAuthSession();

export default function SsoCallbackScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Once Clerk has propagated the new session (isSignedIn flips to true),
  // navigate to the main app. We land here because the OAuth redirect deep-link
  // causes Expo Router to push this route — we must redirect ourselves out.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/(tabs)');
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
