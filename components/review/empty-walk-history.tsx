import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function EmptyWalkHistory() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View style={styles.container}>
      <IconSymbol name="map" size={48} color={colors.textMuted} />
      <Text style={[styles.heading, { color: colors.text }]}>No walks yet</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        Start recording to see your history here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  heading: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.lg,
    marginTop: Spacing.sm,
  },
  body: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
    lineHeight: 22,
  },
});
