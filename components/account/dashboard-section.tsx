import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type DashboardSectionProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
};

export function DashboardSection({ title, actionLabel, onAction, children }: DashboardSectionProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}>
      <View style={styles.header}>
        <ThemedText type="bodySemiBold" style={styles.title}>
          {title}
        </ThemedText>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <ThemedText type="link" style={styles.action}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.base,
  },
  action: {
    fontSize: Typography.sizes.sm,
  },
});
