import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function SkeletonBlock({
  width,
  height,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  style?: object;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: Radius.sm,
          backgroundColor: colors.border,
        },
        style,
      ]}
    />
  );
}

export function GoalsSectionSkeleton() {
  return (
    <View style={styles.goals}>
      {Array.from({ length: 2 }).map((_, i) => (
        <View key={i} style={styles.goalRow}>
          <SkeletonBlock width="55%" height={14} />
          <SkeletonBlock width="35%" height={10} />
          <SkeletonBlock width="100%" height={8} style={{ marginTop: Spacing.xs }} />
        </View>
      ))}
    </View>
  );
}

export function BadgesSectionSkeleton() {
  return (
    <View style={styles.badges}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ flex: 1 }}>
          <SkeletonBlock width="100%" height={56} style={{ borderRadius: Radius.md }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  goals: {
    gap: Spacing.base,
  },
  goalRow: {
    gap: Spacing.xs,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
});
