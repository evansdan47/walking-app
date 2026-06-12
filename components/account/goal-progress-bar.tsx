import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import {
  formatChallengeDayLabel,
  formatGoalProgress,
  formatGoalTarget,
  type GoalUnit,
} from '@/lib/goal-format';
import type { DistanceUnit, ElevationUnit } from '@/lib/format-units';

type GoalProgressBarProps = {
  title: string;
  subtitle?: string;
  challengeDay?: number;
  progressValue: number;
  targetValue: number;
  unit: GoalUnit;
  progressPercent: number;
  color?: string;
};

export function GoalProgressBar({
  title,
  subtitle,
  challengeDay,
  progressValue,
  targetValue,
  unit,
  progressPercent,
  color = '#2e7d32',
}: GoalProgressBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { preferences } = useDisplayPreferences();
  const distanceUnit: DistanceUnit = preferences.distanceUnit;
  const elevationUnit: ElevationUnit = preferences.elevationUnit;
  const pct = Math.min(100, progressPercent);
  const currentLabel = formatGoalProgress(progressValue, unit, distanceUnit, elevationUnit);
  const targetLabel = formatGoalTarget(targetValue, unit, distanceUnit, elevationUnit);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleCol}>
          <ThemedText type="bodyMed" style={styles.title} numberOfLines={2}>
            {title}
          </ThemedText>
          <View style={styles.metaRow}>
            {subtitle ? (
              <ThemedText type="caption" style={{ color: colors.textMuted }}>
                {subtitle}
              </ThemedText>
            ) : null}
            {challengeDay != null ? (
              <View style={[styles.dayChip, { backgroundColor: colors.primaryMuted }]}>
                <ThemedText
                  style={[styles.dayChipText, { color: colors.primary, fontFamily: Typography.fontMedium }]}
                >
                  {formatChallengeDayLabel(challengeDay)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        <ThemedText type="caption" style={[styles.values, { color: colors.textMuted }]}>
          {currentLabel} / {targetLabel}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.backgroundMuted }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: Typography.sizes.sm,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dayChip: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  dayChipText: {
    fontSize: Typography.sizes.xs,
  },
  values: {
    flexShrink: 0,
    textAlign: 'right',
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
