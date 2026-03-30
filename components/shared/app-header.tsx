import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  /** Replaces the centre title text with a custom node (e.g. a TextInput). */
  centerContent?: ReactNode;
}

export function AppHeader({ title, onBack, rightAction, centerContent }: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const handleBack = onBack ?? (() => router.back());

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.sm,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {/* Left slot — back button or empty spacer */}
        <View style={styles.side}>
          {onBack !== undefined ? (
            <Pressable onPress={handleBack} hitSlop={8} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={colors.icon} />
            </Pressable>
          ) : null}
        </View>

        {/* Centre title or custom content */}
        {centerContent ?? (
          <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
        )}

        {/* Right slot */}
        <View style={styles.side}>{rightAction ?? null}</View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    padding: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
