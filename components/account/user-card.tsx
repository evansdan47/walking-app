import { useUser } from '@clerk/expo';
import { type Href, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { BetaBadge } from '@/components/account/beta-badge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function UserCard() {
  const router = useRouter();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const displayName = user?.fullName ?? user?.firstName ?? 'Walker';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const imageUrl = user?.imageUrl;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colorScheme === 'dark' ? colors.backgroundMuted : colors.secondaryMuted,
        },
      ]}
    >
      <View style={styles.content}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.secondaryMuted }]}>
            <ThemedText style={[styles.initial, { fontFamily: Typography.fontBold }]}>
              {initial}
            </ThemedText>
          </View>
        )}

        <View style={styles.textCol}>
          <View style={styles.nameRow}>
            <ThemedText type="bodySemiBold" style={styles.name} numberOfLines={1}>
              {displayName}
            </ThemedText>
            <BetaBadge />
          </View>
          {email ? (
            <ThemedText type="caption" style={{ color: colors.textMuted }} numberOfLines={1}>
              {email}
            </ThemedText>
          ) : null}
          <ThemedText type="caption" style={[styles.journey, { color: colors.textMuted }]}>
            Thank you for being part of our journey.
          </ThemedText>
        </View>

        <Pressable
          onPress={() => router.push('/account/profile' as Href)}
          style={[styles.editBtn, { borderColor: colors.primary }]}
          hitSlop={4}
        >
          <ThemedText
            style={[styles.editBtnText, { color: colors.primary, fontFamily: Typography.fontMedium }]}
          >
            Edit profile
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    padding: Spacing.base,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: Typography.sizes.lg,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    fontSize: Typography.sizes.md,
  },
  journey: {
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  editBtn: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 11,
  },
});
