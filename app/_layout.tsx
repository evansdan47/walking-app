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
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Mapbox from '@rnmapbox/maps';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// @clerk/expo uses NativeEventEmitter with a native module that doesn't implement the
// addListener/removeListeners contract required in React Native 0.65+. These are
// harmless dev-mode warnings from within the Clerk library; suppress them until
// the package is updated.
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method.',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method.',
]);

// Must be imported at the root so the background task is registered
// before the OS tries to resume it after a force-quit restart.
import '@/lib/location/background-task';

// Initialise Mapbox with the public access token once at app startup.
// The token is exposed to the JS bundle via the EXPO_PUBLIC_ prefix.
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

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

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
        tokenCache={tokenCache}
      >
        <ConvexProviderWithAuth client={convex} useAuth={useConvexAuth}>
          <WalkSessionProvider>
            <ReviewRouteProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
                  <Stack.Screen name="walk-summary" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="walk-review"
                    options={{
                      headerShown: false,
                      presentation: 'transparentModal',
                      animation: 'fade',
                    }}
                  />
                </Stack>
                <StatusBar style="auto" />
              </ThemeProvider>
            </ReviewRouteProvider>
          </WalkSessionProvider>
        </ConvexProviderWithAuth>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
