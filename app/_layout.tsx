import { AppErrorBoundary } from '@/components/shared/app-error-boundary';
import { SplashOverlay } from '@/components/ui/splash-overlay';
import { ClerkProvider } from '@clerk/expo';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    useFonts,
} from '@expo-google-fonts/inter';
import {
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// @clerk/expo uses NativeEventEmitter with a native module that doesn't implement the
// addListener/removeListeners contract required in React Native 0.65+. These are
// harmless dev-mode warnings from within the Clerk library; suppress them until
// the package is updated.
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
  // Convex HTTP transport constructs Response(body, {status: 0}) when a network
  // request fails during reconnection (e.g. after long device idle). The client
  // recovers automatically — suppress the dev overlay noise.
  'Failed to construct \'Response\': The status provided (0) is outside the range',
  // Convex internal: fires for every active subscription when the WebSocket
  // reconnects after a long background idle (all queries re-deliver simultaneously).
  // The delay is from connectivity loss, not a real server-side slowness.
  'received query results totaling',
]);

// Must be imported at the root so the background task is registered
// before the OS tries to resume it after a force-quit restart.
import '@/lib/location/background-task';

// Initialise Mapbox with the public access token once at app startup.
// The token is exposed to the JS bundle via the EXPO_PUBLIC_ prefix.
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

import { MobileBuildGate } from '@/components/app/mobile-build-gate';
import { QueuedWalkProvider } from '@/contexts/queued-walk-context';
import { ReviewRouteProvider } from '@/contexts/review-route-context';
import { WalkSessionProvider } from '@/contexts/walk-session-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useConvexAuth } from '@/hooks/use-convex-auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

/**
 * Persists Clerk session tokens between app restarts using expo-secure-store.
 * Required so users stay signed in after closing and reopening the app.
 */
const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  deleteToken: (key: string) => SecureStore.deleteItemAsync(key),
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      // Hide native splash and hand off to our custom overlay
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
        tokenCache={tokenCache}
      >
        <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
          <MobileBuildGate>
          <WalkSessionProvider>
            <QueuedWalkProvider>
              <ReviewRouteProvider>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                  <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="walk-summary"
                      options={{
                        headerShown: false,
                        presentation: 'transparentModal',
                        animation: 'fade',
                      }}
                    />
                    <Stack.Screen
                      name="walk-follow"
                      options={{
                        headerShown: false,
                        presentation: 'fullScreenModal',
                      }}
                    />
                    <Stack.Screen
                      name="plan-walk"
                      options={{
                        headerShown: false,
                        presentation: 'fullScreenModal',
                      }}
                    />
                  </Stack>
                <StatusBar style="auto" />
              </ThemeProvider>
              </ReviewRouteProvider>
            </QueuedWalkProvider>
          </WalkSessionProvider>
          </MobileBuildGate>
        </ConvexProviderWithAuth>
      </ClerkProvider>
      {showSplash && <SplashOverlay onDone={handleSplashDone} />}
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
