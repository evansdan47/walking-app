/**
 * ExploreSheetContent
 *
 * BottomSheet content for the Explore tab.
 *
 * States:
 *  • No route selected  → frosted header + scrollable route list
 *  • Route selected     → frosted header (with back) + route summary card
 */

import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useQuery } from 'convex/react';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';

import type { ExploreViewBounds, PlannedRoute } from './explore-map-layer';

// ── Helpers ───────────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Walking distance of a route in km, summing all leg segments. */
function routeDistKm(route: PlannedRoute): number {
  let total = 0;
  for (const leg of route.legs) {
    for (let i = 1; i < leg.points.length; i++) {
      const a = leg.points[i - 1]!;
      const b = leg.points[i]!;
      total += haversineKm(a.lat, a.lng, b.lat, b.lng);
    }
  }
  // Fall back to stored stat if points are sparse
  if (total < 0.01 && route.stats?.distanceKm) return route.stats.distanceKm;
  return total;
}

function fmtDist(km: number): string {
  if (km <= 0) return '—';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Estimated walking time using flat 4 km/h + Naismith's rule. */
function estimatedTimeMins(distKm: number, elevGainM: number): number {
  return (distKm / 4 + elevGainM / 600) * 60;
}

function fmtTime(mins: number): string {
  if (mins <= 0) return '—';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function difficulty(
  distKm: number,
  elevGainM: number,
): { label: string; color: string } {
  const grade = elevGainM / (distKm * 1000 || 1);
  if (grade > 0.08 || distKm > 15) return { label: 'Hard', color: '#37474f' };
  if (grade > 0.04 || distKm > 8)
    return { label: 'Moderate', color: '#E65100' };
  return { label: 'Easy', color: '#2E7D32' };
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Route list card ────────────────────────────────────────────────────────────

interface RouteListCardProps {
  route: PlannedRoute;
  onPress: () => void;
  colors: (typeof Colors)['light'];
}

function RouteListCard({ route, onPress, colors }: RouteListCardProps) {
  const distKm = routeDistKm(route);
  const elevGainM = route.stats?.elevationGainM ?? 0;
  const diff = difficulty(distKm, elevGainM);
  const timeMins = estimatedTimeMins(distKm, elevGainM);
  const legColor = route.legs[0]?.color ?? '#E65100';

  return (
    <TouchableOpacity
      style={[styles.listCard, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Color swatch */}
      <View style={[styles.listCardSwatch, { backgroundColor: legColor }]} />

      <View style={styles.listCardBody}>
        <Text
          style={[styles.listCardTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {route.title}
        </Text>

        {/* Stats row */}
        <View style={styles.listCardStats}>
          <View style={styles.listCardStat}>
            <IconSymbol name="arrow.left.and.right" size={12} color={colors.textMuted} />
            <Text style={[styles.listCardStatText, { color: colors.textMuted }]}>
              {fmtDist(distKm)}
            </Text>
          </View>
          <View style={styles.listCardStat}>
            <IconSymbol name="arrow.up.forward" size={12} color={colors.textMuted} />
            <Text style={[styles.listCardStatText, { color: colors.textMuted }]}>
              {elevGainM > 0 ? `${Math.round(elevGainM)} m` : '—'}
            </Text>
          </View>
          <View style={styles.listCardStat}>
            <IconSymbol name="clock" size={12} color={colors.textMuted} />
            <Text style={[styles.listCardStatText, { color: colors.textMuted }]}>
              {fmtTime(timeMins)}
            </Text>
          </View>
        </View>

        <View style={styles.listCardMeta}>
          <Text style={[styles.listCardMetaText, { color: colors.textMuted }]}>
            {fmtDate(route.createdAt)}
          </Text>
          <View style={[styles.difficultyBadge, { backgroundColor: diff.color }]}>
            <Text style={styles.difficultyBadgeText}>{diff.label}</Text>
          </View>
        </View>
      </View>

      <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ── Route summary (detail) card ───────────────────────────────────────────────

interface RouteSummaryProps {
  route: PlannedRoute;
  colors: (typeof Colors)['light'];
  onStartWalk: () => void;
  onEditRoute: () => void;
}

function RouteSummary({ route, colors, onStartWalk, onEditRoute }: RouteSummaryProps) {
  const distKm = routeDistKm(route);
  const elevGainM = route.stats?.elevationGainM ?? 0;
  const diff = difficulty(distKm, elevGainM);
  const timeMins = estimatedTimeMins(distKm, elevGainM);

  // Count unique control points across all legs as waypoints
  const waypointCount = route.legs.reduce(
    (sum, leg) => sum + leg.points.filter((p) => p.isControlPoint).length,
    0,
  );

  return (
    <View style={{ paddingBottom: Spacing.xl }}>
      {/* Stats strip */}
      <View
        style={[
          styles.statsStrip,
          { borderBottomColor: colors.border, borderTopColor: colors.border },
        ]}
      >
        <View style={styles.statCell}>
          <IconSymbol name="arrow.left.and.right" size={18} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {fmtDist(distKm)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Distance</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View style={styles.statCell}>
          <IconSymbol name="arrow.up.forward" size={18} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {elevGainM > 0 ? `${Math.round(elevGainM)} m` : '—'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Ascent</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View style={styles.statCell}>
          <IconSymbol name="clock" size={18} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {fmtTime(timeMins)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Est. Time</Text>
        </View>

        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

        <View style={styles.statCell}>
          <View style={[styles.difficultyDot, { backgroundColor: diff.color }]} />
          <Text style={[styles.statValue, { color: colors.text }]}>{diff.label}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Difficulty</Text>
        </View>
      </View>

      {/* Description */}
      {route.description ? (
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionText, { color: colors.text }]}>
            {route.description}
          </Text>
        </View>
      ) : null}

      {/* Route info */}
      <View style={[styles.section, { borderBottomColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Route Info</Text>
        <View style={styles.routeInfoRow}>
          <Text style={[styles.routeInfoLabel, { color: colors.textMuted }]}>Legs</Text>
          <Text style={[styles.routeInfoValue, { color: colors.text }]}>
            {route.legs.length}
          </Text>
        </View>
        {waypointCount > 0 && (
          <View style={styles.routeInfoRow}>
            <Text style={[styles.routeInfoLabel, { color: colors.textMuted }]}>Waypoints</Text>
            <Text style={[styles.routeInfoValue, { color: colors.text }]}>
              {waypointCount}
            </Text>
          </View>
        )}
        <View style={styles.routeInfoRow}>
          <Text style={[styles.routeInfoLabel, { color: colors.textMuted }]}>Created</Text>
          <Text style={[styles.routeInfoValue, { color: colors.text }]}>
            {fmtDate(route.createdAt)}
          </Text>
        </View>
        <View style={styles.routeInfoRow}>
          <Text style={[styles.routeInfoLabel, { color: colors.textMuted }]}>Visibility</Text>
          <Text style={[styles.routeInfoValue, { color: colors.text, textTransform: 'capitalize' }]}>
            {route.visibility ?? 'public'}
          </Text>
        </View>
      </View>

      {/* Leg list */}
      {route.legs.length > 1 && (
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Legs</Text>
          {route.legs.map((leg, i) => {
            const legDistKm = (() => {
              let d = 0;
              for (let j = 1; j < leg.points.length; j++) {
                const a = leg.points[j - 1]!;
                const b = leg.points[j]!;
                d += haversineKm(a.lat, a.lng, b.lat, b.lng);
              }
              return d;
            })();
            return (
              <View key={leg.id} style={styles.legRow}>
                <View style={[styles.legSwatch, { backgroundColor: leg.color }]} />
                <Text style={[styles.legName, { color: colors.text }]}>
                  {leg.name}
                </Text>
                <Text style={[styles.legDist, { color: colors.textMuted }]}>
                  {fmtDist(legDistKm)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Action buttons */}
      <View style={[styles.actionsRow, { paddingHorizontal: Spacing.base }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onStartWalk}
          activeOpacity={0.82}
        >
          <IconSymbol name="figure.walk" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Start Walk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.backgroundCard }]}
          onPress={onEditRoute}
          activeOpacity={0.82}
        >
          <IconSymbol name="map.fill" size={16} color={colors.text} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
            Edit Route
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: (typeof Colors)['light'] }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  const shimmer = colors.border;

  return (
    <Animated.View
      style={[
        styles.listCard,
        { backgroundColor: colors.backgroundCard, borderColor: colors.border, opacity },
      ]}
    >
      <View style={[styles.listCardSwatch, { backgroundColor: shimmer }]} />
      <View style={styles.listCardBody}>
        <View style={[styles.skeletonBar, { width: '60%', backgroundColor: shimmer }]} />
        <View style={[styles.listCardStats, { marginTop: 8 }]}>
          <View style={[styles.skeletonBar, { width: 52, backgroundColor: shimmer }]} />
          <View style={[styles.skeletonBar, { width: 40, backgroundColor: shimmer }]} />
          <View style={[styles.skeletonBar, { width: 46, backgroundColor: shimmer }]} />
        </View>
        <View style={[styles.listCardMeta, { marginTop: 6 }]}>
          <View style={[styles.skeletonBar, { width: 80, backgroundColor: shimmer }]} />
          <View style={[styles.skeletonBar, { width: 48, backgroundColor: shimmer }]} />
        </View>
      </View>
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ colors }: { colors: (typeof Colors)['light'] }) {
  return (
    <View style={styles.emptyState}>
      <IconSymbol name="map.fill" size={40} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No routes here
      </Text>
      <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
        Move the map to explore public routes in other areas.
      </Text>
    </View>
  );
}

// ── ExploreSheetContent ───────────────────────────────────────────────────────

export interface ExploreSheetContentProps {
  viewBounds: ExploreViewBounds | null;
  selectedRoute: PlannedRoute | null;
  onSelectRoute: (route: PlannedRoute) => void;
  onClearRoute: () => void;
  onStartWalk: (route: PlannedRoute) => void;
  onEditRoute: (route: PlannedRoute) => void;
}

export function ExploreSheetContent({
  viewBounds,
  selectedRoute,
  onSelectRoute,
  onClearRoute,
  onStartWalk,
  onEditRoute,
}: ExploreSheetContentProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  const routes = useQuery(
    api.planned_routes.listWithinBounds,
    viewBounds ?? 'skip',
  ) as PlannedRoute[] | undefined;

  // ─── Refs (all declared before logic so hook order stays fixed) ──────────────
  const lastInBoundsRef = useRef<PlannedRoute[] | null>(null);
  const committedModeRef = useRef<'nearest' | 'inbounds' | null>(null);
  const committedBoundsRef = useRef<ExploreViewBounds | null>(null);
  const lastNearestRef = useRef<PlannedRoute[] | null>(null);

  // ─── Bounds change: reset all per-viewport state ─────────────────────────────
  // committedBoundsRef tracks the viewBounds object reference.  A new reference
  // only appears when index.tsx creates a new bounds object (i.e. the debounce
  // fired with a meaningfully different viewport).  On each reset we start fresh
  // so the new area gets its own initial-load state.
  if (viewBounds !== committedBoundsRef.current) {
    committedBoundsRef.current = viewBounds;
    committedModeRef.current = null;
    lastInBoundsRef.current = null;  // fresh start for new area
    lastNearestRef.current = null;   // fresh start for new area
  }

  // ─── Update lastInBoundsRef ───────────────────────────────────────────────────
  // KEY FIX: only replace existing data with an empty result on first load.
  // Convex re-runs queries when the auth token refreshes and briefly returns []
  // while the server has no auth context.  Ignoring those transient empties
  // prevents the flip-flop between "list" and "empty state" at ~400 ms.
  if (routes !== undefined) {
    const prevInBounds = lastInBoundsRef.current;
    if (prevInBounds === null) {
      lastInBoundsRef.current = routes;
    } else if (routes.length > prevInBounds.length) {
      lastInBoundsRef.current = routes;
    } else if (routes.length === prevInBounds.length && routes.length > 0) {
      const prevIds = new Set(prevInBounds.map(r => r._id));
      if (routes.every(r => prevIds.has(r._id))) {
        // Same content — keep stable reference
      }
      // else: same count different IDs — auth oscillation, skip
    }
    // else: fewer routes — auth oscillation, skip
    if (committedModeRef.current !== 'inbounds') {
      committedModeRef.current = (lastInBoundsRef.current?.length ?? 0) >= 5 ? 'inbounds' : 'nearest';
    }
  }

  const knownRoutes = lastInBoundsRef.current; // null = first load for these bounds

  // ─── Sticky committed-mode ────────────────────────────────────────────────────
  // useNearestFallback is false only when committed to 'inbounds'.
  // Resets to null (→ true) when viewBounds changes above.
  const useNearestFallback = committedModeRef.current !== 'inbounds' && viewBounds !== null;

  // Centre of the current viewport — used for nearest-fallback query
  const viewCenter = viewBounds
    ? {
        centerLat: (viewBounds.minLat + viewBounds.maxLat) / 2,
        centerLng: (viewBounds.minLng + viewBounds.maxLng) / 2,
        limit: 5,
      }
    : null;

  const nearestRoutes = useQuery(
    api.planned_routes.listNearest,
    useNearestFallback && viewCenter ? viewCenter : 'skip',
  ) as PlannedRoute[] | undefined;

  // ─── Update lastNearestRef (ID-comparison stabilization) ──────────────────────
  if (nearestRoutes !== undefined) {
    const prevNearest = lastNearestRef.current;
    if (prevNearest === null) {
      lastNearestRef.current = nearestRoutes;
    } else if (nearestRoutes.length > prevNearest.length) {
      lastNearestRef.current = nearestRoutes;
    } else if (nearestRoutes.length === prevNearest.length && nearestRoutes.length > 0) {
      const prevIds = new Set(prevNearest.map(r => r._id));
      if (nearestRoutes.every(r => prevIds.has(r._id))) {
        // Same content — keep stable reference
      }
      // else: same count different IDs — auth oscillation, skip
    }
    // else: fewer routes — auth oscillation, skip
  }
  const knownNearest = lastNearestRef.current;

  // Show the small header spinner while either query is in-flight.
  // We deliberately do NOT replace the list with a big spinner on re-fetches —
  // that is what caused the visible flip-flop.
  const isFetching =
    (routes === undefined && viewBounds !== null) ||
    (useNearestFallback && nearestRoutes === undefined && viewCenter !== null);

  // Full-screen loading only on the very first open (no data at all yet).
  const isInitialLoad = isFetching && (useNearestFallback ? knownNearest === null : knownRoutes === null);

  // Which list to render
  const displayRoutes: PlannedRoute[] = useMemo(() => {
    if (useNearestFallback) return knownNearest ?? [];
    return knownRoutes ? [...knownRoutes].sort((a, b) => b.createdAt - a.createdAt) : [];
  }, [useNearestFallback, knownNearest, knownRoutes]);

  const title = selectedRoute ? selectedRoute.title : 'Explore';
  const subtitle = selectedRoute
    ? null
    : useNearestFallback && knownNearest !== null
    ? `${knownNearest.length} nearest route${knownNearest.length !== 1 ? 's' : ''} to this area`
    : knownRoutes !== null
    ? `${knownRoutes.length} route${knownRoutes.length !== 1 ? 's' : ''} in view`
    : isFetching
    ? 'Loading routes…'
    : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Frosted glass header */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 0}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.header, { borderBottomColor: colors.border }]}
      >
        {Platform.OS === 'android' && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: colors.background + 'D8' },
            ]}
          />
        )}

        {/* Back arrow when a route is selected */}
        {selectedRoute ? (
          <TouchableOpacity
            style={styles.headerBack}
            onPress={onClearRoute}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <IconSymbol name="arrow.left" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBack} />
        )}

        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.headerRight} />
      </BlurView>

      {/* Scrollable content */}
      <BottomSheetScrollView
        style={{ backgroundColor: colors.backgroundCard }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 60 + insets.bottom + Spacing.lg },
        ]}
      >
        {selectedRoute ? (
          <RouteSummary
            route={selectedRoute}
            colors={colors}
            onStartWalk={() => onStartWalk(selectedRoute)}
            onEditRoute={() => onEditRoute(selectedRoute)}
          />
        ) : !viewBounds ? (
          <EmptyState colors={colors} />
        ) : isInitialLoad ? (
          <View style={{ paddingTop: Spacing.sm }}>
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} colors={colors} />)}
          </View>
        ) : displayRoutes.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          <View style={{ paddingTop: Spacing.sm }}>
            {displayRoutes.map((route) => (
              <RouteListCard
                key={route._id}
                route={route}
                colors={colors}
                onPress={() => onSelectRoute(route)}
              />
            ))}
          </View>
        )}
      </BottomSheetScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 60,
  },
  headerBack: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Typography.fontBold,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: Typography.fontRegular,
    marginTop: 1,
  },
  headerRight: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: Spacing.base,
  },

  // Route list card
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    paddingRight: Spacing.sm,
  },
  listCardSwatch: {
    width: 5,
    alignSelf: 'stretch',
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
  listCardBody: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
  },
  listCardTitle: {
    fontSize: 15,
    fontFamily: Typography.fontMedium,
    marginBottom: 4,
  },
  listCardStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  listCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  listCardStatText: {
    fontSize: 12,
    fontFamily: Typography.fontRegular,
  },
  listCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listCardMetaText: {
    fontSize: 11,
    fontFamily: Typography.fontRegular,
  },

  // Stats strip (route detail)
  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.base,
    marginBottom: Spacing.base,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  statValue: {
    fontSize: 16,
    fontFamily: Typography.fontBold,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Typography.fontRegular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  difficultyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Sections
  section: {
    paddingBottom: Spacing.base,
    marginBottom: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Typography.fontBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  sectionText: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    lineHeight: 20,
  },

  // Route info
  routeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  routeInfoLabel: {
    fontSize: 13,
    fontFamily: Typography.fontRegular,
  },
  routeInfoValue: {
    fontSize: 13,
    fontFamily: Typography.fontMedium,
  },

  // Leg list
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: Spacing.sm,
  },
  legSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legName: {
    flex: 1,
    fontSize: 13,
    fontFamily: Typography.fontRegular,
  },
  legDist: {
    fontSize: 12,
    fontFamily: Typography.fontRegular,
  },

  // Difficulty badge
  difficultyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  difficultyBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Typography.fontMedium,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.base,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Typography.fontBold,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: Typography.fontMedium,
  },

  // Skeleton
  skeletonBar: {
    height: 12,
    borderRadius: 6,
  },

  // Empty / loading
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: Typography.fontBold,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: Typography.fontRegular,
    textAlign: 'center',
    lineHeight: 20,
  },

});
