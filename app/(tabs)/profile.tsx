import { useAuth, useUser } from '@clerk/expo';
import { useMutation } from 'convex/react';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { AppHeader } from '@/components/shared/app-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

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

      <ThemedView style={styles.spacer} />

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  name: {
    marginBottom: Spacing.xs,
  },
  email: {
    marginBottom: Spacing.lg,
  },
  spacer: {
    flex: 1,
    backgroundColor: 'transparent',
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

