import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { ElevationChart } from '@/components/review/elevation-chart';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkStats } from '@/lib/db/walks';
import { buildElevationProfile } from '@/lib/review/build-elevation-profile';
import type { RoutePoint } from '@/lib/review/build-route';

interface TabElevationProps {
  points: RoutePoint[];
  stats: WalkStats | null;
}

function fmtM(val: number | undefined): string {
  if (val == null) return '--';
  return `${Math.round(val)} m`;
}

function fmtPct(val: number | undefined): string {
  if (val == null) return '--';
  return `${val.toFixed(1)} %`;
}

// ---------------------------------------------------------
// Small detail stat row within a card
// ---------------------------------------------------------
interface DetailRowProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  last?: boolean;
  borderColor: string;
  textColor: string;
  mutedColor: string;
}

function DetailRow({ icon, iconBg, iconColor, label, value, last, borderColor, textColor, mutedColor }: DetailRowProps) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]}>
      <View style={[styles.detailIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as never} size={18} color={iconColor} />
      </View>
      <View style={styles.detailMid}>
        <Text style={[styles.detailLabel, { color: mutedColor }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: textColor }]}>{value}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------
// Ascent / Descent card
// ---------------------------------------------------------
interface ElevCardProps {
  type: 'ascent' | 'descent';
  total: number | undefined;
  longest: number | undefined;
  steepest: number | undefined;
}

function ElevCard({ type, total, longest, steepest }: ElevCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const isAscent = type === 'ascent';
  const accentColor = isAscent ? colors.success : colors.primary;
  const accentMuted = isAscent ? colors.successMuted : colors.primaryMuted;

  return (
    <View style={[styles.elevCard, { borderColor: accentColor, backgroundColor: colors.backgroundCard }]}>
      {/* Card header */}
      <View style={[styles.elevCardHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.elevCardHeaderIcon, { backgroundColor: accentMuted }]}>
          <Ionicons
            name={isAscent ? 'trending-up' : 'trending-down'}
            size={14}
            color={accentColor}
          />
        </View>
        <Text style={[styles.elevCardTitle, { color: accentColor }]}>
          {isAscent ? 'ASCENTS' : 'DESCENTS'}
        </Text>
      </View>

      {/* Stats */}
      <DetailRow
        icon={isAscent ? 'triangle-outline' : 'triangle-outline'}
        iconBg={accentMuted}
        iconColor={accentColor}
        label={isAscent ? 'Total ascent' : 'Total descent'}
        value={fmtM(total)}
        borderColor={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
      />
      <DetailRow
        icon={isAscent ? 'trending-up-outline' : 'trending-down-outline'}
        iconBg={accentMuted}
        iconColor={accentColor}
        label={isAscent ? 'Longest ascent' : 'Longest descent'}
        value={fmtM(longest)}
        borderColor={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
      />
      <DetailRow
        icon="resize-outline"
        iconBg={accentMuted}
        iconColor={accentColor}
        label={isAscent ? 'Steepest ascent' : 'Steepest descent'}
        value={fmtPct(steepest)}
        borderColor={colors.border}
        textColor={colors.text}
        mutedColor={colors.textMuted}
        last
      />
    </View>
  );
}

// ---------------------------------------------------------
// Main tab
// ---------------------------------------------------------

export function TabElevation({ points, stats }: TabElevationProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const elevationData = buildElevationProfile(points);
  const hasData = elevationData.length >= 2;

  return (
    <View style={styles.container}>
      {/* Elevation profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Elevation Profile</Text>
        {hasData ? (
          <ElevationChart data={elevationData} height={180} style={styles.chart} />
        ) : (
          <View style={[styles.noData, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
            <Ionicons name="trending-up-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.noDataText, { color: colors.textMuted }]}>
              No elevation data available
            </Text>
            <Text style={[styles.noDataSub, { color: colors.textMuted }]}>
              Altitude data was not recorded for this walk.
            </Text>
          </View>
        )}
      </View>

      {/* Elevation details section */}
      <Text style={[styles.sectionTitle, styles.detailsTitle, { color: colors.text }]}>
        Elevation Details
      </Text>

      <View style={styles.cardRow}>
        <View style={styles.cardCol}>
          <ElevCard
            type="ascent"
            total={stats?.elevationGainMetres}
            longest={stats?.longestAscentMetres}
            steepest={stats?.steepestAscentGradientPct}
          />
        </View>
        <View style={styles.cardCol}>
          <ElevCard
            type="descent"
            total={stats?.elevationLossMetres}
            longest={stats?.longestDescentMetres}
            steepest={stats?.steepestDescentGradientPct}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  profileCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.base,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
    marginBottom: Spacing.sm,
  },
  chart: {
    marginHorizontal: -Spacing.xs, // slight bleed for breathing room
  },
  noData: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xl,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noDataText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  noDataSub: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  detailsTitle: {
    marginBottom: 0,
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cardCol: {
    flex: 1,
  },
  // ElevCard
  elevCard: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  elevCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  elevCardHeaderIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elevCardTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.xs,
    letterSpacing: 0.5,
  },
  // DetailRow
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMid: {
    flex: 1,
    gap: 1,
  },
  detailLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: 10,
  },
  detailValue: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
});
