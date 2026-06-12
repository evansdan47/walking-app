import { type Href, useRouter } from 'expo-router';
import type { FunctionReturnType } from 'convex/server';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DashboardSection } from '@/components/account/dashboard-section';
import { GoalProgressBar } from '@/components/account/goal-progress-bar';
import { GoalsSectionSkeleton } from '@/components/account/section-skeletons';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAppQuery } from '@/hooks/use-app-query';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GOAL_PROGRESS_COLORS } from '@/lib/goal-format';

type OverviewGoal = FunctionReturnType<typeof api.userGoals.listRecentForOverview>[number];

const GoalList = memo(function GoalList({ goals }: { goals: OverviewGoal[] }) {
  return (
    <View style={styles.list}>
      {goals.map((goal, index) => (
        <GoalProgressBar
          key={goal._id}
          title={goal.title}
          subtitle={goal.subtitle}
          challengeDay={goal.challengeDay}
          progressValue={goal.progressValue}
          targetValue={goal.targetValue}
          unit={goal.unit}
          progressPercent={goal.progressPercent}
          color={GOAL_PROGRESS_COLORS[index % GOAL_PROGRESS_COLORS.length]}
        />
      ))}
    </View>
  );
});

export function ActiveGoalsSection() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const goals = useAppQuery(api.userGoals.listRecentForOverview, { limit: 2 });
  const displayGoals = Array.isArray(goals) ? goals : [];
  const isPending = goals === undefined;
  const showEmpty = goals !== undefined && displayGoals.length === 0;

  return (
    <DashboardSection
      title="Active goals"
      actionLabel="View all goals"
      onAction={() => router.push('/account/goals' as Href)}
    >
      <View style={styles.body}>
        {displayGoals.length > 0 ? <GoalList goals={displayGoals} /> : null}
        {displayGoals.length === 0 && isPending ? <GoalsSectionSkeleton /> : null}
        {showEmpty ? (
          <View style={styles.empty}>
            <ThemedText type="caption" style={{ color: colors.textMuted }}>
              No active goals yet.
            </ThemedText>
            <Pressable onPress={() => router.push('/account/goals' as Href)} hitSlop={8}>
              <ThemedText type="link" style={styles.emptyCta}>
                Create one
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </DashboardSection>
  );
}

const styles = StyleSheet.create({
  body: {
    minHeight: 120,
  },
  empty: {
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  emptyCta: {
    fontSize: 13,
  },
  list: {
    gap: Spacing.base,
  },
});
