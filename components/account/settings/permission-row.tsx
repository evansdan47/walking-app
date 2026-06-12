import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type PermStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

type PermissionRowProps = {
  label: string;
  sublabel?: string;
  status: PermStatus;
  onRequest?: () => void;
};

export function PermissionRow({ label, sublabel, status, onRequest }: PermissionRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const dotColor =
    status === 'granted' ? colors.success :
    status === 'unavailable' ? colors.textMuted :
    '#f59e0b';

  const statusLabel =
    status === 'granted' ? 'Granted' :
    status === 'denied' ? 'Denied' :
    status === 'unavailable' ? 'Unavailable' :
    'Not set';

  return (
    <View style={styles.row}>
      <View style={styles.labelCol}>
        <ThemedText type="body">{label}</ThemedText>
        {sublabel ? (
          <ThemedText type="caption" style={{ color: colors.textMuted }}>{sublabel}</ThemedText>
        ) : null}
      </View>
      <View style={styles.right}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <ThemedText type="caption" style={{ color: colors.textMuted }}>{statusLabel}</ThemedText>
        {(status === 'denied' || status === 'undetermined') && onRequest ? (
          <Pressable onPress={onRequest} hitSlop={8} style={[styles.enableBtn, { borderColor: colors.primary }]}>
            <ThemedText type="caption" style={{ color: colors.primary }}>
              Enable
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  labelCol: { flex: 1, gap: 2 },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  enableBtn: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginLeft: Spacing.xs,
  },
});
