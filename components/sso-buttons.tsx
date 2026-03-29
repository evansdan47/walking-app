import { useSSO } from '@clerk/expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Required for expo-web-browser to close the auth session on redirect back
WebBrowser.maybeCompleteAuthSession();

type SsoStrategy = 'oauth_google' | 'oauth_apple' | 'oauth_facebook';

interface SsoProvider {
  strategy: SsoStrategy;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  brandColor: string;
  iosOnly?: boolean;
}

const PROVIDERS: SsoProvider[] = [
  {
    strategy: 'oauth_apple',
    label: 'Apple',
    icon: 'apple',
    brandColor: '#000000',
    iosOnly: true,
  },
  {
    strategy: 'oauth_google',
    label: 'Google',
    icon: 'google',
    brandColor: '#4285F4',
  },
  {
    strategy: 'oauth_facebook',
    label: 'Facebook',
    icon: 'facebook',
    brandColor: '#1877F2',
  },
];

export function SsoButtons() {
  const { startSSOFlow } = useSSO();
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  const handleSSO = async (strategy: SsoStrategy) => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Do not navigate imperatively — Clerk's isSignedIn state propagating
        // will cause TabLayout's guard to redirect to /(tabs) automatically.
        // An immediate router.replace races against Clerk's state update on
        // Android and causes a bounce back to the sign-in screen.
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      Alert.alert('Sign In Failed', message);
    }
  };

  const visibleProviders = PROVIDERS.filter(
    (p) => !p.iosOnly || Platform.OS === 'ios',
  );

  // On iOS the Apple icon is black; respect dark mode
  const appleIconColor = scheme === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <View>
      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <ThemedText type="body" style={[styles.dividerLabel, { color: colors.textMuted }]}>
          or continue with
        </ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Provider buttons */}
      {visibleProviders.map(({ strategy, label, icon, brandColor, iosOnly }) => (
        <Pressable
          key={strategy}
          style={[
            styles.button,
            { backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
          onPress={() => handleSSO(strategy)}
        >
          <MaterialCommunityIcons
            name={icon}
            size={22}
            color={iosOnly ? appleIconColor : brandColor}
            style={styles.icon}
          />
          <ThemedText type="bodySemiBold" style={styles.label}>
            Continue with {label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    marginHorizontal: Spacing.sm,
    fontSize: 13,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    marginRight: 22 + Spacing.sm, // offset icon width so text appears centred
  },
});
