import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Walk, WalkStats } from '@/lib/db/walks';
import { haversineMetres } from '@/lib/location/haversine';
import type { RoutePoint } from '@/lib/review/build-route';

// ---------------------------------------------------------------------------
// Circuit detection
// ---------------------------------------------------------------------------

const CIRCUIT_DISTANCE_RATIO = 0.05; // 5% of total distance
const CIRCUIT_ABSOLUTE_MAX_M = 200;  // never requires closing within more than 200 m

interface CircuitResult {
  isCircuit: boolean;
  closingDistanceM: number;
  closingPct: number;
}

function detectCircuit(route: RoutePoint[], totalDistanceM: number): CircuitResult | null {
  if (route.length < 2) return null;
  const first = route[0]!;
  const last = route[route.length - 1]!;
  const closingDistanceM = haversineMetres(first.latitude, first.longitude, last.latitude, last.longitude);
  const threshold = Math.min(CIRCUIT_ABSOLUTE_MAX_M, totalDistanceM * CIRCUIT_DISTANCE_RATIO);
  const isCircuit = closingDistanceM <= threshold;
  const closingPct = totalDistanceM > 0 ? (closingDistanceM / totalDistanceM) * 100 : 0;
  return { isCircuit, closingDistanceM, closingPct };
}

function fmtM(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  title: string;
  badge?: string;
}
function SectionHeader({ title, badge }: SectionHeaderProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {badge && (
        <View style={[styles.sectionBadge, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
          <Text style={[styles.sectionBadgeText, { color: colors.textMuted }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

// Circuit status card — detected / not detected
interface CircuitCardProps {
  circuit: CircuitResult;
}
function CircuitCard({ circuit }: CircuitCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const { isCircuit, closingDistanceM, closingPct } = circuit;
  const accentColor = isCircuit ? colors.success : colors.textMuted;
  const accentBg = isCircuit ? colors.successMuted : colors.backgroundMuted;
  const borderColor = isCircuit ? colors.success : colors.border;

  return (
    <View style={[styles.circuitCard, { backgroundColor: colors.backgroundCard, borderColor }]}>
      <View style={styles.circuitCardInner}>
        {/* Icon */}
        <View style={[styles.circuitIconWrap, { backgroundColor: accentBg }]}>
          <Ionicons
            name={isCircuit ? 'refresh-circle-outline' : 'git-branch-outline'}
            size={22}
            color={accentColor}
          />
        </View>

        {/* Text */}
        <View style={styles.circuitText}>
          <Text style={[styles.circuitTitle, { color: accentColor }]}>
            {isCircuit ? 'Circuit detected' : 'Out & back / linear'}
          </Text>
          <Text style={[styles.circuitSub, { color: colors.textMuted }]}>
            {isCircuit
              ? `Start and finish are ${fmtM(closingDistanceM)} apart (${closingPct.toFixed(1)}% of total distance). This looks like a circuit walk.`
              : `Start and finish are ${fmtM(closingDistanceM)} apart (${closingPct.toFixed(1)}% of total distance). Record a route that starts and ends at the same point to enable circuit features.`}
          </Text>
        </View>

        {/* Route diagram illustration */}
        <CircuitDiagram isCircuit={isCircuit} accentColor={accentColor} />
      </View>
    </View>
  );
}

// Simple SVG-free route shape diagram
function CircuitDiagram({ isCircuit, accentColor }: { isCircuit: boolean; accentColor: string }) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const dotColor = accentColor;
  const lineColor = colors.border;

  if (isCircuit) {
    // Oval circuit shape using border-radius trick
    return (
      <View style={styles.diagram}>
        <View style={[styles.diagramCircuit, { borderColor: dotColor }]}>
          {/* Start/end dot */}
          <View style={[styles.diagramDot, { backgroundColor: dotColor, bottom: -4, left: '50%', marginLeft: -4 }]} />
          {/* Flag at top */}
          <View style={[styles.diagramFlag, { top: -6, right: 6 }]}>
            <Ionicons name="flag" size={10} color={dotColor} />
          </View>
        </View>
      </View>
    );
  }

  // Linear / out-and-back: two dots connected by a line
  return (
    <View style={styles.diagram}>
      <View style={styles.diagramLinear}>
        <View style={[styles.diagramDot, { backgroundColor: dotColor }]} />
        <View style={[styles.diagramLine, { backgroundColor: lineColor }]} />
        <Ionicons name="flag-outline" size={12} color={dotColor} />
      </View>
    </View>
  );
}

// Lap comparison placeholder
function LapComparisonCard({ isCircuit }: { isCircuit: boolean }) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View style={[styles.infoCard, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
      <View style={[styles.infoIconWrap, { backgroundColor: colors.backgroundCard }]}>
        <Ionicons name="stats-chart-outline" size={22} color={colors.textMuted} />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>
          {isCircuit ? 'Lap comparison coming soon' : 'Circuit walks only'}
        </Text>
        <Text style={[styles.infoSub, { color: colors.textMuted }]}>
          {isCircuit
            ? 'When enabled, this will compare your pace, distance, and key stats against your previous runs of this circuit to help you track progress over time.'
            : 'Training comparison is available for circuit walks. Record a route that starts and ends at the same point.'}
        </Text>
      </View>
    </View>
  );
}

// Previous Attempts placeholder
function PreviousAttemptsCard() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  return (
    <View style={[styles.attemptsCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      <View style={styles.attemptsInner}>
        <View style={[styles.attemptsIconWrap, { backgroundColor: colors.backgroundMuted }]}>
          <Ionicons name="time-outline" size={22} color={colors.textMuted} />
        </View>
        <View style={styles.attemptsText}>
          <Text style={[styles.attemptsTitle, { color: colors.text }]}>No comparisons available yet</Text>
          <Text style={[styles.attemptsSub, { color: colors.textMuted }]}>
            We're building circuit detection and lap comparison. Once available, your previous attempts on this route will appear here.
          </Text>
        </View>
        {/* Mountain illustration placeholder */}
        <View style={styles.mountainIllustration}>
          <Ionicons name="image-outline" size={36} color={colors.border} />
        </View>
      </View>
    </View>
  );
}

// Training Insights cards
interface InsightCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
}
function InsightCard({ icon, iconBg, iconColor, title, subtitle }: InsightCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  return (
    <View style={[styles.insightCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}>
      <View style={[styles.insightIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as never} size={18} color={iconColor} />
      </View>
      <Text style={[styles.insightTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.insightSub, { color: colors.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TabTrainingProps {
  walk: Walk;
  stats: WalkStats | null;
  route: RoutePoint[];
}

export function TabTraining({ walk, stats, route }: TabTrainingProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const totalDistanceM = stats?.distanceMetres ?? 0;
  const circuit = detectCircuit(route, totalDistanceM);
  const isCircuit = circuit?.isCircuit ?? false;

  return (
    <View style={styles.container}>
      {/* ── Training Overview ───────────────────────────────── */}
      <SectionHeader title="Training Overview" />

      {/* Circuit status */}
      {circuit ? (
        <CircuitCard circuit={circuit} />
      ) : (
        <View style={[styles.infoCard, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
          <View style={[styles.infoIconWrap, { backgroundColor: colors.backgroundCard }]}>
            <Ionicons name="help-circle-outline" size={22} color={colors.textMuted} />
          </View>
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>No route data</Text>
            <Text style={[styles.infoSub, { color: colors.textMuted }]}>
              Circuit detection requires recorded route points.
            </Text>
          </View>
        </View>
      )}

      {/* Lap comparison placeholder */}
      <LapComparisonCard isCircuit={isCircuit} />

      {/* ── Previous Attempts ──────────────────────────────── */}
      <SectionHeader title="Previous Attempts" badge="Coming in a future update" />
      <PreviousAttemptsCard />

      {/* ── Training Insights ──────────────────────────────── */}
      <SectionHeader title="Training Insights" badge="MVP" />

      <View style={styles.insightsRow}>
        <InsightCard
          icon="time-outline"
          iconBg="#e3f2fd"
          iconColor="#1565c0"
          title="Consistency is key"
          subtitle="Keep recording this route to see your trends here."
        />
        <InsightCard
          icon="trending-up-outline"
          iconBg={colors.successMuted}
          iconColor={colors.success}
          title="Track improvement"
          subtitle="We'll show your pace trends over time."
        />
        <InsightCard
          icon="trophy-outline"
          iconBg={colors.primaryMuted}
          iconColor={colors.primary}
          title="Beat your best"
          subtitle="Compare your fastest runs on this route."
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  sectionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionBadgeText: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
  // Circuit card
  circuitCard: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    padding: Spacing.base,
  },
  circuitCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  circuitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuitText: {
    flex: 1,
    gap: 4,
  },
  circuitTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  circuitSub: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
  },
  // Route diagram
  diagram: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagramCircuit: {
    width: 40,
    height: 28,
    borderRadius: 20,
    borderWidth: 1.5,
    position: 'relative',
  },
  diagramLinear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  diagramDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'relative',
  },
  diagramLine: {
    width: 20,
    height: 1.5,
  },
  diagramFlag: {
    position: 'absolute',
  },
  // Info / placeholder cards (lap comparison, no circuit)
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.base,
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  infoSub: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
  },
  // Previous attempts card
  attemptsCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.base,
  },
  attemptsInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  attemptsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptsText: {
    flex: 1,
    gap: 4,
  },
  attemptsTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  attemptsSub: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
  },
  mountainIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    opacity: 0.4,
  },
  // Training insights
  insightsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  insightCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  insightTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
  insightSub: {
    fontFamily: Typography.fontRegular,
    fontSize: 10,
    lineHeight: 13,
  },
});
