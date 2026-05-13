import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DistanceDisplay } from '@/components/recording/distance-display';
import { formatDuration } from '@/components/recording/duration-display';
import { PaceDisplay } from '@/components/recording/pace-display';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkStats } from '@/lib/db/walks';

interface TabWalkStatsProps {
  stats: WalkStats | null;
  unit: 'km' | 'mi';
  startedAt?: number;
  onUnitToggle: () => void;
  photoCount?: number;
}

function formatWalkDate(ts: number): { date: string; day: string; time: string } {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const day = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  return { date, day, time };
}

export function TabWalkStats({ stats, unit, startedAt, onUnitToggle, photoCount }: TabWalkStatsProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const walkDate = startedAt != null ? formatWalkDate(startedAt) : null;

  const rows = [
    ...(walkDate ? [
      { label: 'Date', value: walkDate.date },
      { label: 'Day',  value: walkDate.day },
      { label: 'Time', value: walkDate.time },
    ] : []),
    { label: 'Duration',         value: stats ? formatDuration(stats.durationSeconds)      : '--' },
    { label: 'Time moving',      value: stats ? formatDuration(stats.movingTimeSeconds)   : '--' },
    { label: 'Time stopped',     value: stats ? formatDuration(stats.stoppedTimeSeconds)  : '--' },
    { label: 'Waypoints stored', value: stats ? stats.pointCount.toLocaleString()         : '--' },
    ...(photoCount != null ? [{ label: 'Photos taken', value: String(photoCount) }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Unit toggle — top right */}
      <View style={styles.unitRow}>
        <View style={[styles.segmentControl, { borderColor: colors.border }]}>
          <Pressable
            style={[styles.segment, unit === 'km' && { backgroundColor: colors.primary }]}
            onPress={() => { if (unit !== 'km') onUnitToggle(); }}
          >
            <Text style={[styles.segmentLabel, { color: unit === 'km' ? colors.textInverse : colors.textMuted }]}>
              KM
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, unit === 'mi' && { backgroundColor: colors.primary }]}
            onPress={() => { if (unit !== 'mi') onUnitToggle(); }}
          >
            <Text style={[styles.segmentLabel, { color: unit === 'mi' ? colors.textInverse : colors.textMuted }]}>
              MI
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Hero stat cards */}
      <View style={styles.heroRow}>
        <View style={styles.heroCell}>
          <DistanceDisplay distanceMetres={stats?.distanceMetres ?? 0} unit={unit} />
        </View>
        <View style={styles.heroCell}>
          <PaceDisplay paceSecsPerKm={stats?.avgPaceSecsPerKm} unit={unit} />
        </View>
      </View>

      {/* Detail stat table */}
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
  unitRow: {
    alignItems: 'flex-end',
  },
  segmentControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.5,
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
  },
  rowValue: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
});
