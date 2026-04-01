import { StyleSheet, Text, View } from 'react-native';

import { DistanceDisplay } from '@/components/recording/distance-display';
import { formatDuration } from '@/components/recording/duration-display';
import { PaceDisplay } from '@/components/recording/pace-display';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkStats } from '@/lib/db/walks';

interface WalkStatSummaryProps {
  stats: WalkStats | null;
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
    { label: 'Steps counted',     value: stats.stepCount != null ? String(stats.stepCount) : '--' },
  ];
}

export function WalkStatSummary({ stats }: WalkStatSummaryProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const rows = stats ? buildRows(stats) : [];

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
        {rows.map((row, i) => (
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
});

