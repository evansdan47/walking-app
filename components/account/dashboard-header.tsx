import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type DashboardHeaderProps = {
  title?: string;
  embedded?: boolean;
  onMenuPress: () => void;
  onSettingsPress: () => void;
};

export function DashboardHeader({
  title = 'My Rambleio',
  embedded = false,
  onMenuPress,
  onSettingsPress,
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingTop: embedded ? Spacing.sm : insets.top + Spacing.sm,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          onPress={onMenuPress}
          hitSlop={8}
          style={styles.side}
          accessibilityRole="button"
          accessibilityLabel="Open account menu"
        >
          <Ionicons name="menu" size={24} color={colors.icon} />
        </Pressable>

        <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>

        <Pressable
          onPress={onSettingsPress}
          hitSlop={8}
          style={[styles.side, styles.sideRight]}
          accessibilityRole="button"
          accessibilityLabel="Open preferences"
        >
          <Ionicons name="settings-outline" size={22} color={colors.icon} />
        </Pressable>
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
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
