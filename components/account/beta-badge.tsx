import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function BetaBadge() {
  const summary = useAppQuery(api.users.getAccountSummary);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  if (summary && summary.subscription.plan !== 'beta') return null;

  return (
    <View style={[styles.badge, { backgroundColor: colors.primaryMuted }]}>
      <Ionicons name="star" size={11} color={colors.primary} />
      <ThemedText
        style={[styles.label, { color: colors.primary, fontFamily: Typography.fontMedium }]}
      >
        Beta Member
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  label: {
    fontSize: Typography.sizes.xs,
  },
});
