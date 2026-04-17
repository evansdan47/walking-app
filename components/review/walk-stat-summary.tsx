import { StyleSheet, Text, View } from 'react-native';

import { DistanceDisplay } from '@/components/recording/distance-display';
import { formatDuration } from '@/components/recording/duration-display';
import { PaceDisplay } from '@/components/recording/pace-display';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkStats } from '@/lib/db/walks';

interface WalkStatSummaryProps {
  stats: WalkStats | null;
  photoCount?: number;
}

interface StatRow {
  label: string;
  value: string;
}

function buildRows(stats: WalkStats): StatRow[] {
  const gain = stats.elevationGainMetres;
  const loss = stats.elevationLossMetres;

  // Net elevation change: gain - loss (positive = net up, negative = net down)
  let netElev = '--';
  if (gain != null && loss != null) {
    const net = Math.round(gain - loss);
    netElev = net >= 0 ? `+${net} m` : `${net} m`;
  } else if (gain != null) {
    netElev = `+${Math.round(gain)} m`;
  }

  return [
    { label: 'Elevation change',  value: netElev },
    { label: 'Total ascent',      value: gain != null ? `+${Math.round(gain)} m` : '--' },
    { label: 'Total descent',     value: loss != null ? `-${Math.round(loss)} m` : '--' },
    { label: 'Duration',          value: formatDuration(stats.durationSeconds) },
    { label: 'Time moving',       value: formatDuration(stats.movingTimeSeconds) },
    { label: 'Time stopped',      value: formatDuration(stats.stoppedTimeSeconds) },
    { label: 'Waypoints stored',  value: String(stats.pointCount) },
    { label: 'Steps counted (D)', value: stats.stepCount != null ? String(stats.stepCount) : '--' },
    ...(stats.hcStepCount != null
      ? [{ label: 'Steps counted (HC)', value: String(stats.hcStepCount) }]
      : []),
    ...(stats.caloriesKcal != null
      ? [{ label: 'Calories burned', value: `${Math.round(stats.caloriesKcal)} kcal` }]
      : []),
    ...(stats.avgHeartRateBpm != null
      ? [{ label: 'Avg heart rate', value: `${Math.round(stats.avgHeartRateBpm)} bpm` }]
      : []),
    ...(stats.maxHeartRateBpm != null
      ? [{ label: 'Max heart rate', value: `${Math.round(stats.maxHeartRateBpm)} bpm` }]
      : []),
  ];
}

export function WalkStatSummary({ stats, photoCount }: WalkStatSummaryProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const rows = stats ? buildRows(stats) : [];
  const allRows: StatRow[] = [
    ...rows,
    ...(photoCount != null ? [{ label: 'Photos taken', value: String(photoCount) }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Hero row: Distance | Pace */}
      <View style={styles.heroRow}>
        <View style={styles.heroCell}>
          <DistanceDisplay distanceMetres={stats?.distanceMetres ?? 0} />
        </View>
        <View style={styles.heroCell}>
          <PaceDisplay paceSecsPerKm={stats?.avgPaceSecsPerKm} />
        </View>
      </View>

      {/* Detail table */}
      <View style={[styles.table, { borderColor: colors.border }]}>
        {allRows.map((row, i) => (
          <View
            key={row.label}
            style={[
              styles.row,
              { borderTopColor: colors.border },
              i === 0 && styles.rowFirst,
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{row.label}</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{row.value}</Text>
          </View>
        ))}
      </View>
      {stats?.hcSynced && (
        <View style={[styles.hcBadge, { backgroundColor: colors.successMuted, borderColor: colors.success }]}>
          <Text style={[styles.hcBadgeText, { color: colors.success }]}>Synced to Health Connect</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heroCell: {
    flex: 1,
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    flexShrink: 1,
    marginRight: Spacing.sm,
  },
  rowValue: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    textAlign: 'right',
  },
  hcBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  hcBadgeText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
});

