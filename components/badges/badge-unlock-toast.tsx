import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import type { NewlyUnlockedBadge } from '@/convex/badgeEngine/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscribeToBadgeUnlocks } from '@/lib/badges/badge-unlock-events';

const TOAST_DURATION_MS = 4500;

function formatToastMessage(badges: NewlyUnlockedBadge[]): string {
  if (badges.length === 1) {
    return `Badge unlocked: ${badges[0].name}`;
  }
  return `${badges.length} badges unlocked`;
}

export function BadgeUnlockToastHost() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeToBadgeUnlocks((badges) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(formatToastMessage(badges));
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setMessage(null);
          },
        );
      }, TOAST_DURATION_MS);
    });
  }, [opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + Spacing.sm, opacity }]}
    >
      <Pressable
        onPress={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
            ({ finished }) => {
              if (finished) setMessage(null);
            },
          );
        }}
        style={[
          styles.toast,
          {
            backgroundColor: colors.backgroundCard,
            borderColor: colors.border,
            ...Shadows.modal,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="ribbon" size={18} color={colors.primary} />
        </View>
        <ThemedText
          style={[styles.message, { fontFamily: Typography.fontMedium }]}
          numberOfLines={2}
        >
          {message}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: Typography.sizes.sm,
  },
});
