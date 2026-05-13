import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WeekBucket } from '@/lib/db/walks';

interface WeeklySummaryCardProps {
  buckets: WeekBucket[];
  selectedWeekStart?: number;
  onSelectWeek?: (weekStart: number) => void;
}

function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function weekLabel(weekStart: number, isNewestWeek: boolean): string {
  if (isNewestWeek) return 'This\nWeek';
  const d = new Date(weekStart);
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

export function WeeklySummaryCard({ buckets, selectedWeekStart, onSelectWeek }: WeeklySummaryCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { width: screenWidth } = useWindowDimensions();

  const newestBucket = buckets[buckets.length - 1];
  if (!newestBucket) return null;

  // Stats shown are for the selected week (defaults to newest/current)
  const effectiveSelectedStart = selectedWeekStart ?? newestBucket.weekStart;
  const statBucket = buckets.find((b) => b.weekStart === effectiveSelectedStart) ?? newestBucket;
  const isCurrentWeekSelected = statBucket.weekStart === newestBucket.weekStart;

  const totalDistance = statBucket.distanceMetres;
  const totalDuration = statBucket.durationSeconds;
  const sessionCount = statBucket.sessionCount;

  // Bar chart dimensions
  const chartHPad = Spacing.base;
  const chartWidth = screenWidth - Spacing.base * 2 - Spacing.base * 2 - 2; // card padding × 2 + border
  const barAreaWidth = chartWidth - chartHPad * 2;
  const barCount = buckets.length;
  const barGap = 6;
  const barWidth = Math.floor((barAreaWidth - barGap * (barCount - 1)) / barCount);
  const barMaxHeight = 48;
  const chartSvgHeight = barMaxHeight + 32; // + label area (2-line labels need ~32px)

  const maxDist = Math.max(...buckets.map((b) => b.distanceMetres), 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      {/* Section label */}
      <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
        {isCurrentWeekSelected ? 'THIS WEEK' : `WEEK OF ${new Date(effectiveSelectedStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()}`}
      </Text>

      {/* Top stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDistance(totalDistance)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Distance</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{sessionCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sessions</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDuration(totalDuration)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time Rambling</Text>
        </View>
      </View>

      {/* Bar chart — only shown when there is more than one week of history */}
      {buckets.length > 1 && (
        <>
          <Text style={[styles.chartCaption, { color: colors.textMuted }]}>
            Weekly history (distance)
          </Text>
          <Svg width={barAreaWidth} height={chartSvgHeight} style={styles.chart}>
            {buckets.map((bucket, i) => {
              const isNewestWeek = i === buckets.length - 1;
              const isSelected = bucket.weekStart === effectiveSelectedStart;
              const barHeight = Math.max(4, (bucket.distanceMetres / maxDist) * barMaxHeight);
              const x = i * (barWidth + barGap);
              const y = barMaxHeight - barHeight;
              const label = weekLabel(bucket.weekStart, isNewestWeek);
              const labelLines = label.split('\n');
              const barColour = isSelected ? '#1b6d24' : '#87a576';

              return (
                <G key={bucket.weekStart} transform={`translate(${x}, 0)`} onPress={() => onSelectWeek?.(bucket.weekStart)}>
                  <Rect
                    x={0}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={3}
                    fill={barColour}
                  />
                  {/* Transparent hit area covering bar + label */}
                  <Rect x={0} y={0} width={barWidth} height={chartSvgHeight} fill="transparent" />
                  {labelLines.map((line, li) => (
                    <SvgText
                      key={li}
                      x={barWidth / 2}
                      y={barMaxHeight + 10 + li * 11}
                      textAnchor="middle"
                      fontSize={9}
                      fill={barColour}
                      fontFamily={isSelected ? Typography.fontBold : Typography.fontRegular}
                    >
                      {line}
                    </SvgText>
                  ))}
                </G>
              );
            })}
          </Svg>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.xs,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
  statValue: {
    fontFamily: Typography.fontDisplay,
    fontSize: Typography.sizes.lg,
    lineHeight: 28,
  },
  statLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    marginTop: 1,
  },
  chartCaption: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    marginTop: Spacing.xs,
  },
  chart: {
    alignSelf: 'flex-start',
  },
});
