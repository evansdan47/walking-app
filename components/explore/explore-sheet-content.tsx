/**
 * ExploreSheetContent
 *
 * BottomSheet content for the Explore tab.
 *
 * States:
 *  • No route selected  → frosted header + scrollable route list
 *  • Route selected     → frosted header (with back) + route summary card
 */

import { useBottomSheet } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    ScrollView,
    type ScrollView as ScrollViewType,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import ReAnimated, {
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useExploreData } from '@/hooks/use-explore-data';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import {
    distanceToNearestRoutePointM,
    distanceToRouteStartM,
    isCircularRoute,
} from '@/lib/explore/proximity';

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

function fmtDist(km: number, preferMiles = false): string {
  if (km <= 0) return '—';
  if (preferMiles) return `${(km / 1.60934).toFixed(1)} mi`;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/**
 * Formats a distance-to-route-start for the list card.
 * Returns 'Nearby' when within 50 m, otherwise a formatted distance string.
 */
function fmtDistToStart(distM: number, preferMiles: boolean): string {
  if (distM < 50) return 'Nearby';
  if (preferMiles) {
    const miles = distM / 1609.34;
    if (miles < 0.1) return `${Math.round(distM)} m`;
    return `${miles.toFixed(1)} mi`;
  }
  if (distM < 1000) return `${Math.round(distM)} m`;
  return `${(distM / 1000).toFixed(1)} km`;
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
  isHighlighted: boolean;
  colors: (typeof Colors)['light'];
  userLocation: { latitude: number; longitude: number } | null;
}

const HIGHLIGHT_COLOR = '#007AFF';

function RouteListCard({ route, onPress, isHighlighted, colors, userLocation }: RouteListCardProps) {
  const { preferences } = useUserPreferences();
  const preferMiles = preferences.preferMiles;
  const distKm = routeDistKm(route);
  const elevGainM = route.stats?.elevationGainM ?? 0;
  const diff = difficulty(distKm, elevGainM);
  const timeMins = estimatedTimeMins(distKm, elevGainM);
  const legColor = route.legs[0]?.color ?? '#E65100';

  const isCircular = isCircularRoute(route);
  const distToStartM = userLocation
    ? isCircular
      ? distanceToNearestRoutePointM(userLocation.latitude, userLocation.longitude, route)
      : distanceToRouteStartM(userLocation.latitude, userLocation.longitude, route)
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.listCard,
        {
          backgroundColor: isHighlighted ? HIGHLIGHT_COLOR + '12' : colors.backgroundCard,
          borderColor: isHighlighted ? HIGHLIGHT_COLOR : colors.border,
          borderWidth: isHighlighted ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
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
              {fmtDist(distKm, preferMiles)}
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

        {distToStartM !== null && (
          <View style={[styles.listCardStat, { marginTop: 3 }]}>
            <IconSymbol name="mappin" size={11} color={colors.textMuted} />
            <Text style={[styles.listCardStatText, { color: colors.textMuted }]}>
              {(() => {
                const s = fmtDistToStart(distToStartM, preferMiles);
                return s === 'Nearby' ? 'Nearby' : `${s} away`;
              })()}
            </Text>
          </View>
        )}

        <View style={styles.listCardMeta}>
          <View style={[styles.difficultyBadge, { backgroundColor: diff.color }]}>
            <Text style={styles.difficultyBadgeText}>{diff.label}</Text>
          </View>
        </View>
      </View>

      {isHighlighted && (
        <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

// ── Route summary (detail) card ───────────────────────────────────────────────

interface RouteSummaryProps {
  route: PlannedRoute;
  colors: (typeof Colors)['light'];
  userLocation: { latitude: number; longitude: number } | null;
  proximityThresholdM: number;
  onStartWalk: () => void;
  onQueueWalk: () => void;
  onCancelWalk?: () => void;
  onEditRoute: () => void;
  /** True when this route is already queued for auto-start. */
  isQueued?: boolean;
}

function RouteSummary({ route, colors, userLocation, proximityThresholdM, onStartWalk, onQueueWalk, onCancelWalk, onEditRoute, isQueued = false }: RouteSummaryProps) {
  const { preferences } = useUserPreferences();
  const preferMiles = preferences.preferMiles;
  const distKm = routeDistKm(route);
  const elevGainM = route.stats?.elevationGainM ?? 0;
  const diff = difficulty(distKm, elevGainM);
  const timeMins = estimatedTimeMins(distKm, elevGainM);

  // Proximity check — whether the user is close enough to start immediately.
  const isCircular = isCircularRoute(route);
  const distToStartM = userLocation
    ? isCircular
      ? distanceToNearestRoutePointM(userLocation.latitude, userLocation.longitude, route)
      : distanceToRouteStartM(userLocation.latitude, userLocation.longitude, route)
    : null;
  const withinThreshold = distToStartM !== null && distToStartM <= proximityThresholdM;

  // Count unique control points across all legs as waypoints
  const waypointCount = route.legs.reduce(
    (sum, leg) => sum + leg.points.filter((p) => p.isControlPoint).length,
    0,
  );

  return (
    <View style={{ paddingBottom: Spacing.xl }}>
      {/* Action buttons — placed at the top so they're immediately accessible */}
      <View style={[styles.actionsRow, { paddingHorizontal: Spacing.base, paddingTop: Spacing.base }]}>
        {userLocation === null || withinThreshold ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={onStartWalk}
            activeOpacity={0.82}
          >
            <IconSymbol name="figure.walk" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Start Walk</Text>
          </TouchableOpacity>
        ) : isQueued ? (
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#EF4444' }]}
              onPress={onCancelWalk}
              activeOpacity={0.82}
            >
              <IconSymbol name="xmark.circle" size={18} color="#EF4444" />
              <Text style={[styles.primaryBtnText, { color: '#EF4444' }]}>Cancel Walk</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }]}
              onPress={onQueueWalk}
              activeOpacity={0.82}
            >
              <IconSymbol name="location" size={18} color={colors.primary} />
              <Text style={[styles.primaryBtnText, { color: colors.primary }]}>Walk When Near</Text>
            </TouchableOpacity>
            {distToStartM !== null && (
              <Text style={[styles.distanceLabel, { color: colors.textMuted }]}>
                {(() => {
                  const s = fmtDistToStart(distToStartM, preferMiles);
                  const label = isCircular ? 'nearest point' : 'start';
                  return s === 'Nearby' ? `You're at the ${label}` : `${s} from ${label}`;
                })()}
              </Text>
            )}
          </View>
        )}

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
            {fmtDist(distKm, preferMiles)}
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
                  {fmtDist(legDistKm, preferMiles)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

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
  /** Route highlighted in the list + on the map (first tap). */
  highlightedRoute: PlannedRoute | null;
  /** Route whose detail panel is shown (second tap). */
  selectedRoute: PlannedRoute | null;
  /** First tap: highlight the route and fly the camera to it. */
  onHighlightRoute: (route: PlannedRoute) => void;
  /** Second tap on the already-highlighted route: show detail panel. */
  onSelectRoute: (route: PlannedRoute) => void;
  onClearRoute: () => void;
  onStartWalk: (route: PlannedRoute) => void;
  /** Called when the user is outside the proximity threshold and wants to queue the walk. */
  onQueueWalk: (route: PlannedRoute) => void;
  /** Called when the user wants to cancel the queued walk. */
  onCancelWalk?: () => void;
  onEditRoute: (route: PlannedRoute) => void;
  /** Current GPS position used for proximity-gated start button. */
  userLocation: { latitude: number; longitude: number } | null;
  /** Radius in metres for the proximity check. */
  proximityThresholdM: number;
  /** True when the currently selected route is already queued for auto-start. */
  isQueued?: boolean;
  /**
   * Called whenever the resolved route list changes. The parent uses this to
   * pass the same data to ExploreMapLayer so both share a single subscription.
   */
  onRoutesChange?: (routes: PlannedRoute[]) => void;
  /**
   * When set, the sheet shows only these routes under a "Grouped walks" header.
   * Cleared by calling onClearGroup (back button).
   */
  groupedRoutes?: PlannedRoute[] | null;
  onClearGroup?: () => void;
  /**
   * When true, a single tap on any route card jumps straight to the detail
   * panel (no two-tap highlight-first flow). Map panning while a route is
   * selected does not trigger a re-sync of the route list.
   */
  directDetail?: boolean;
}

export function ExploreSheetContent({
  viewBounds,
  highlightedRoute,
  selectedRoute,
  onHighlightRoute,
  onSelectRoute,
  onClearRoute,
  onStartWalk,
  onQueueWalk,
  onCancelWalk,
  onEditRoute,
  userLocation,
  proximityThresholdM,
  isQueued = false,
  onRoutesChange,
  directDetail = false,
  groupedRoutes,
  onClearGroup,
}: ExploreSheetContentProps) {
  const { preferences: explorePrefs } = useUserPreferences();
  const explorePrefMiles = explorePrefs.preferMiles;
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { animatedPosition } = useBottomSheet();
  const { height: screenHeight } = useWindowDimensions();
  // Track header height so the scroll area fills the exact remaining space.
  const headerHeightSV = useSharedValue(60);
  const scrollRef = useRef<ScrollViewType>(null);

  // In directDetail mode, freeze the viewBounds when a route is selected so
  // that map panning doesn't cause the route list to resync/refetch.
  const frozenBoundsRef = useRef<ExploreViewBounds | null>(null);
  useEffect(() => {
    if (!selectedRoute) {
      frozenBoundsRef.current = null;
    }
  }, [selectedRoute]);
  const effectiveBounds = (directDetail && selectedRoute && frozenBoundsRef.current)
    ? frozenBoundsRef.current
    : viewBounds;

  // ── Immediate skeleton feedback when a route is highlighted ─────────────────
  // restLoadingPendingId is set synchronously (during render) the moment
  // highlightedRoute changes, so the rest of the list turns to skeletons
  // immediately — before the 700 ms viewport-debounce fires.  It is cleared
  // when routes updates from SQLite (instant after the bounds debounce fires)
  // or after a 1500 ms timeout as a safety net.
  const [restLoadingPendingId, setRestLoadingPendingId] = useState<string | null>(null);
  const restLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the highlight ID we last REACTED to, so the sync-during-render block
  // only fires when the highlight actually changes — not on every render where
  // restLoadingPendingId happens to differ (e.g. after the timeout clears it).
  const prevHighlightIdRef = useRef<string | null>(null);

  const currentHighlightId = highlightedRoute?._id ?? null;
  if (currentHighlightId !== prevHighlightIdRef.current) {
    prevHighlightIdRef.current = currentHighlightId;
    if (currentHighlightId !== null) {
      setRestLoadingPendingId(currentHighlightId);
    } else {
      setRestLoadingPendingId(null);
    }
  }
  const scrollAreaStyle = useAnimatedStyle(() => {
    // animatedPosition: Y position of sheet top from screen top (0 = full screen, screenHeight = closed)
    const HANDLE_HEIGHT = 24; // @gorhom default handle container height
    const scrollH = Math.max(0, screenHeight - animatedPosition.value - HANDLE_HEIGHT - headerHeightSV.value);
    return { height: scrollH };
  });

  // Scroll to top whenever the highlighted route changes so the pinned card is visible.
  useEffect(() => {
    if (highlightedRoute) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [highlightedRoute]);

  // ── Route data from local SQLite cache (populated by background sync) ────────
  // In directDetail mode effectiveBounds is frozen while a route is selected,
  // preventing map panning from triggering a list resync.
  const { routes, isSyncing } = useExploreData(effectiveBounds);

  // Safety-net: clear skeleton after 1500ms if SQLite update hasn't done it.
  useEffect(() => {
    if (restLoadingPendingId === null) {
      if (restLoadingTimerRef.current) {
        clearTimeout(restLoadingTimerRef.current);
        restLoadingTimerRef.current = null;
      }
      return;
    }
    restLoadingTimerRef.current = setTimeout(() => {
      restLoadingTimerRef.current = null;
      setRestLoadingPendingId(null);
    }, 1500);
    return () => {
      if (restLoadingTimerRef.current) {
        clearTimeout(restLoadingTimerRef.current);
        restLoadingTimerRef.current = null;
      }
    };
  }, [restLoadingPendingId]);

  // Clear rest-loading skeleton once SQLite returns updated routes for the new bounds.
  useEffect(() => {
    setRestLoadingPendingId(prev => (prev !== null ? null : prev));
  }, [routes]);

  // Full skeleton only on first open when cache is empty and sync is in flight.
  const isInitialLoad = isSyncing && routes.length === 0 && !highlightedRoute;

  // Sort newest-first for consistent display order.
  const displayRoutes: PlannedRoute[] = useMemo(
    () => [...routes].sort((a, b) => b.createdAt - a.createdAt),
    [routes],
  );

  // Propagate resolved routes to parent so ExploreMapLayer can share the data
  // without running its own independent Convex subscription.
  useEffect(() => {
    onRoutesChange?.(displayRoutes);
  }, [displayRoutes, onRoutesChange]);

  // Full route list — highlighted card always sorted first so Reanimated can
  // animate it from its original position to the top when tapped.
  const sortedRoutes = useMemo(
    () =>
      highlightedRoute
        ? [highlightedRoute, ...displayRoutes.filter(r => r._id !== highlightedRoute._id)]
        : displayRoutes,
    [displayRoutes, highlightedRoute],
  );

  const isGroupView = !!groupedRoutes && !selectedRoute;

  const title = selectedRoute ? selectedRoute.title : isGroupView ? 'Grouped walks' : 'Explore';

  // Show distance to start beneath the route title whenever a route is selected.
  const routeDistanceSubtitle = useMemo(() => {
    if (!selectedRoute || !userLocation) return null;
    const circular = isCircularRoute(selectedRoute);
    const distM = circular
      ? distanceToNearestRoutePointM(userLocation.latitude, userLocation.longitude, selectedRoute)
      : distanceToRouteStartM(userLocation.latitude, userLocation.longitude, selectedRoute);
    const label = circular ? 'nearest point' : 'start';
    const dist = fmtDistToStart(distM, explorePrefMiles);
    return dist === 'Nearby' ? `At the ${label}` : `${dist} from ${label}`;
  }, [selectedRoute, userLocation, explorePrefMiles]);

  const subtitle = selectedRoute
    ? routeDistanceSubtitle
    : isGroupView
    ? `${groupedRoutes!.length} route${groupedRoutes!.length !== 1 ? 's' : ''} in group`
    : routes.length > 0
    ? `${routes.length} route${routes.length !== 1 ? 's' : ''} in view`
    : isSyncing
    ? 'Loading routes…'
    : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Frosted glass header */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 0}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={[styles.header, { borderBottomColor: colors.border }]}
        onLayout={(e) => { headerHeightSV.value = e.nativeEvent.layout.height; }}
      >
        {Platform.OS === 'android' && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: colors.background + 'D8' },
            ]}
          />
        )}

        {/* Back arrow when a route is selected or viewing a proximity group */}
        {selectedRoute || isGroupView ? (
          <TouchableOpacity
            style={styles.headerBack}
            onPress={selectedRoute ? onClearRoute : onClearGroup}
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

      {/* Scrollable content — height driven by animatedPosition so the ScrollView
          is always bounded to the visible sheet area regardless of snap position. */}
      <ReAnimated.View style={[scrollAreaStyle, { overflow: 'hidden' }]}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: colors.backgroundCard }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 60 + insets.bottom + Spacing.lg },
          ]}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          {selectedRoute ? (
            <RouteSummary
              route={selectedRoute}
              colors={colors}
              userLocation={userLocation}
              proximityThresholdM={proximityThresholdM}
              isQueued={isQueued}
              onStartWalk={() => onStartWalk(selectedRoute)}
              onQueueWalk={() => onQueueWalk(selectedRoute)}
              onCancelWalk={onCancelWalk}
              onEditRoute={() => onEditRoute(selectedRoute)}
            />
          ) : isGroupView ? (
            // Proximity group view — same card list but filtered to the group only
            <View style={{ paddingTop: Spacing.sm }}>
              {groupedRoutes!.map((route) => (
                <RouteListCard
                  key={route._id}
                  route={route}
                  colors={colors}
                  isHighlighted={false}
                  userLocation={userLocation}
                  onPress={() => {
                    onHighlightRoute(route);
                    onSelectRoute(route);
                  }}
                />
              ))}
            </View>
          ) : !viewBounds ? (
            <EmptyState colors={colors} />
          ) : isInitialLoad && !highlightedRoute ? (
            // Very first open with no selection yet — full skeleton list
            <View style={{ paddingTop: Spacing.sm }}>
              {[0, 1, 2, 3].map(i => <SkeletonCard key={i} colors={colors} />)}
            </View>
          ) : (
            // List view — highlighted route is always pinned at the top.
            // While the viewport query re-runs (camera flew to the route),
            // show skeleton cards in the "rest" slot so the list doesn’t
            // jump or reorder under the user’s finger.
            <View style={{ paddingTop: Spacing.sm }}>
              {sortedRoutes.map((route) => {
                // While re-querying the viewport, only keep the highlighted card
                // alive — non-highlighted cards unmount with a fade-out exit.
                if (restLoadingPendingId !== null && route._id !== highlightedRoute?._id) {
                  return null;
                }
                return (
                  <ReAnimated.View
                    key={route._id}
                    layout={LinearTransition.springify().damping(20).stiffness(200)}
                    exiting={FadeOut.duration(150)}
                  >
                    <RouteListCard
                      route={route}
                      colors={colors}
                      isHighlighted={route._id === highlightedRoute?._id}
                      userLocation={userLocation}
                      onPress={() => {
                        if (directDetail) {
                          // Snapshot bounds before selection so map panning
                          // doesn't trigger a list resync while detail is open.
                          frozenBoundsRef.current = viewBounds;
                          onHighlightRoute(route);
                          onSelectRoute(route);
                        } else if (route._id === highlightedRoute?._id) {
                          onSelectRoute(route);
                        } else {
                          onHighlightRoute(route);
                        }
                      }}
                    />
                  </ReAnimated.View>
                );
              })}
              {/* Skeleton cards fade in below the highlighted card while the
                  viewport debounce re-queries for the new camera position. */}
              {restLoadingPendingId !== null && (
                <ReAnimated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                >
                  {[0, 1, 2].map(i => <SkeletonCard key={i} colors={colors} />)}
                </ReAnimated.View>
              )}
              {sortedRoutes.length === 0 && restLoadingPendingId === null && (
                <EmptyState colors={colors} />
              )}
            </View>
          )}
        </ScrollView>
      </ReAnimated.View>
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
    alignItems: 'flex-start',
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
  distanceLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontRegular,
    textAlign: 'center',
    marginTop: -4,
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
