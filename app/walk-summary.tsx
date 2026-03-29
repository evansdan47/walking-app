import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppHeader } from '@/components/shared/app-header';
import { WalkSummaryCard } from '@/components/shared/walk-summary-card';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getWalk } from '@/lib/db/walks';

export default function WalkSummaryScreen() {
  const { walkId } = useLocalSearchParams<{ walkId: string }>();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const router = useRouter();

  const walk = walkId ? getWalk(walkId) : null;

  if (!walk || !walk.stats || !walk.endedAt) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <AppHeader title="Walk Summary" />
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Walk data not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <AppHeader title="Walk Summary" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <WalkSummaryCard
          walk={{
            title: walk.title,
            startedAt: walk.startedAt,
            endedAt: walk.endedAt,
            stats: walk.stats,
          }}
        />
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: Spacing.base,
    gap: Spacing.base,
    paddingBottom: Spacing.xxl,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
  },
  doneButton: {
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  doneText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
});
