import { useAuth, useUser } from '@clerk/expo';
import { useMutation } from 'convex/react';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/shared/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RouteColourPicker } from '@/components/ui/route-colour-picker';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouteColours } from '@/hooks/use-route-colours';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { colours, setColour, resetColours } = useRouteColours();

  const upsertCurrentUser = useMutation(api.users.upsertCurrentUser);

  // Ensure the user document exists in Convex whenever this screen mounts
  useEffect(() => {
    if (!user) return;
    upsertCurrentUser({
      ...(user.fullName ? { name: user.fullName } : {}),
      ...(user.primaryEmailAddress?.emailAddress
        ? { email: user.primaryEmailAddress.emailAddress }
        : {}),
    }).catch(() => {
      // Silent fail — will retry next mount
    });
  }, [user, upsertCurrentUser]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const displayName = user?.fullName ?? user?.firstName ?? 'Walker';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Profile" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar placeholder */}
        <ThemedView
          variant="backgroundCard"
          style={[styles.avatar, { borderColor: colors.border }]}
        >
          <ThemedText type="title">{displayName.charAt(0).toUpperCase()}</ThemedText>
        </ThemedView>

        <ThemedText type="title" style={styles.name}>
          {displayName}
        </ThemedText>
        {email ? (
          <ThemedText type="body" style={[styles.email, { color: colors.textMuted }]}>
            {email}
          </ThemedText>
        ) : null}

        {/* Dev: Route Colours */}
        <View style={[styles.devSection, { borderColor: colors.border }]}>
          <View style={styles.devHeader}>
            <ThemedText type="bodyMed" style={styles.devTitle}>
              Dev — Route Colours
            </ThemedText>
            <Pressable onPress={resetColours} hitSlop={8}>
              <ThemedText type="caption" style={{ color: colors.primary }}>
                Reset
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="caption" style={[styles.devHint, { color: colors.textMuted }]}>
            Adjust the colours used on the route review map. Changes apply next time a walk is opened.
          </ThemedText>
          <RouteColourPicker
            label="Positive (fast / descent)"
            colour={colours.positive}
            onChange={(hex) => setColour('positive', hex)}
          />
          <RouteColourPicker
            label="Neutral (flat / indeterminate)"
            colour={colours.neutral}
            onChange={(hex) => setColour('neutral', hex)}
          />
          <RouteColourPicker
            label="Negative (slow / ascent)"
            colour={colours.negative}
            onChange={(hex) => setColour('negative', hex)}
          />
        </View>

        <View style={styles.spacer} />

        <Pressable
          style={[styles.signOutButton, { borderColor: colors.border }]}
          onPress={handleSignOut}
        >
          <ThemedText type="bodyMed" style={{ color: colors.textMuted }}>
            Sign Out
          </ThemedText>
        </Pressable>

        <ThemedText type="caption" style={[styles.version, { color: colors.textMuted }]}>
          v{appVersion}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: Spacing.lg,
    flexGrow: 1,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
    marginTop: Spacing.sm,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  email: {
    marginBottom: Spacing.lg,
  },
  // Dev section
  devSection: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.base,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devTitle: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  devHint: {
    marginBottom: Spacing.xs,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.lg,
  },
  signOutButton: {
    width: '100%',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  version: {
    marginBottom: Spacing.lg,
    opacity: 0.5,
  },
});

