import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface WalkHeaderCardProps {
  title: string | null;
  startedAt: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function WalkHeaderCard({ title, startedAt }: WalkHeaderCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const dateStr = formatDate(startedAt);

  return (
    <View style={styles.card}>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{dateStr}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.xs,
  },
  meta: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
});
