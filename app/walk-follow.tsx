/**
 * WalkFollowScreen
 *
 * Full-screen follow-route recording screen. Entered after:
 *  - Tapping "Start Walk" on the route detail panel (user is near start), or
 *  - Auto-start when a queued walk's proximity threshold is crossed.
 *
 * Recording is already running when this screen opens.
 * Provides:
 *  - Planned route polyline overlay (planned=slate, walked=ochre)
 *  - Live GPS breadcrumb
 *  - Off-route badge (fires when > 75 m from any route point)
 *  - Bottom sheet with elapsed timer, off-route card, Stop button
 */

import MapboxGL from '@rnmapbox/maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PlannedRoute } from '@/components/explore/explore-map-layer';
import { FollowRouteLayer } from '@/components/follow/follow-route-layer';
import { LivePositionLayer } from '@/components/map/live-position-layer';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useOffRouteHaptic } from '@/hooks/use-off-route-haptic';
import { db } from '@/lib/db/client';

// ── SQLite helpers ─────────────────────────────────────────────────────────────

type ExploreRouteRow = {
  id: string;
  title: string;
  description: string | null;
  author_id: string;
  visibility: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  centroid_lat: number;
  centroid_lng: number;
  legs_json: string;
  created_at: number;
};

function rowToRoute(row: ExploreRouteRow): PlannedRoute {
  return {
    _id: row.id as PlannedRoute['_id'],
    _creationTime: row.created_at,
    userId: row.author_id as PlannedRoute['userId'],
    authorId: row.author_id as PlannedRoute['authorId'],
    visibility: row.visibility as PlannedRoute['visibility'],
    title: row.title,
    description: row.description ?? undefined,
    legs: JSON.parse(row.legs_json),
    createdAt: row.created_at,
    stats:
      row.distance_km != null
        ? { distanceKm: row.distance_km, elevationGainM: row.elevation_gain_m ?? 0 }
        : undefined,
  };
}

function getRouteById(id: string): PlannedRoute | null {
  try {
    const row = db.getFirstSync<ExploreRouteRow>(
      `SELECT id, title, description, author_id, visibility,
              distance_km, elevation_gain_m, centroid_lat, centroid_lng,
              legs_json, created_at
       FROM explore_routes WHERE id = ?`,
      id,
    );
    return row ? rowToRoute(row) : null;
  } catch {
    return null;
  }
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

const OFF_ROUTE_THRESHOLD_M = 75;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns the index of the nearest point in flatCoords to the given position. */
function nearestPointIndex(
  lat: number,
  lng: number,
  flatCoords: [number, number][],
): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < flatCoords.length; i++) {
    const [cLng, cLat] = flatCoords[i]!;
    const d = haversineM(lat, lng, cLat, cLng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

/** Minimum distance in metres from a position to any point on the flat coords list. */
function minDistToRoute(lat: number, lng: number, flatCoords: [number, number][]): number {
  let minDist = Infinity;
  for (const [cLng, cLat] of flatCoords) {
    const d = haversineM(lat, lng, cLat, cLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function flattenRoute(route: PlannedRoute): [number, number][] {
  const coords: [number, number][] = [];
  for (const leg of route.legs) {
    for (const pt of leg.points) {
      coords.push([pt.lng, pt.lat]);
    }
  }
  return coords;
}

// ── Duration formatter ─────────────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function WalkFollowScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { state, pausedDurationMs, stop } = useWalkSessionContext();
  const { flags } = useFeatureFlags();

  // ── Route ──────────────────────────────────────────────────────────────────
  const route = useMemo<PlannedRoute | null>(
    () => (routeId ? getRouteById(routeId) : null),
    [routeId],
  );

  const flatCoords = useMemo(() => (route ? flattenRoute(route) : []), [route]);

  // ── Live GPS ───────────────────────────────────────────────────────────────
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const mapRef = useRef<MapboxGL.MapView>(null);
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // ── Walk breadcrumb (from context live stats — use coordinates from useLiveStats
  //    if available; otherwise empty). For now we show user location dot only.
  //    The breadcrumb from the main screen won't be passed here, so we start fresh.
  const [breadcrumb, setBreadcrumb] = useState<[number, number][]>([]);

  // ── Off-route detection ────────────────────────────────────────────────────
  const [isOffRoute, setIsOffRoute] = useState(false);
  // Real-time distance from the nearest route point; null before first GPS fix.
  const [distanceFromRouteM, setDistanceFromRouteM] = useState<number | null>(null);

  // Effective distance fed to the haptic engine: real GPS or mocked (test mode).
  const hapticDistanceM = flags.hapticTestEnabled
    ? flags.hapticTestDistanceM
    : distanceFromRouteM;

  useOffRouteHaptic({
    distanceM:      hapticDistanceM,
    enabled:        flags.hapticOffRouteEnabled,
    startM:         flags.hapticOffRouteStartM,
    maxM:           flags.hapticOffRouteMaxM,
    minImpact:      flags.hapticMinImpact,
    maxImpact:      flags.hapticMaxImpact,
    slowIntervalMs: flags.hapticSlowIntervalMs,
    fastIntervalMs: flags.hapticFastIntervalMs,
  });

  // ── Nearest route point index (for walked-portion rendering) ──────────────
  const [walkedIdx, setWalkedIdx] = useState(0);

  // ── Elapsed timer ──────────────────────────────────────────────────────────
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (state.phase !== 'recording' && state.phase !== 'paused') return;
      const now = Date.now();
      const rawMs = now - state.startedAt;
      const pauseOffset =
        state.phase === 'recording'
          ? pausedDurationMs
          : pausedDurationMs + (now - state.pausedAt);
      setElapsedSec(Math.max(0, Math.floor((rawMs - pauseOffset) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [state, pausedDurationMs]);

  // ── Mapbox location updates for walk-follow (separate from main screen) ───
  useEffect(() => {
    // MapboxGL.UserLocation provides the puck; we hook into it via
    // onUserLocationUpdate to update off-route state and walked index.
  }, []);

  // ── Handle state transitions ───────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'completed') {
      router.replace({ pathname: '/walk-summary', params: { walkId: state.walkId } });
    }
  }, [state.phase, router]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleUserLocationUpdate = (location: MapboxGL.Location) => {
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    setUserLat(lat);
    setUserLng(lng);

    // Append to breadcrumb
    setBreadcrumb((prev) => [...prev, [lng, lat] as [number, number]]);

    if (flatCoords.length === 0) return;

    // Nearest point index for walked-portion highlight
    const idx = nearestPointIndex(lat, lng, flatCoords);
    setWalkedIdx(idx);

    // Off-route check
    const dist = minDistToRoute(lat, lng, flatCoords);
    setDistanceFromRouteM(dist);
    const offRoute = dist > OFF_ROUTE_THRESHOLD_M;
    setIsOffRoute(offRoute);

    // Keep camera centred on user (follow mode)
    cameraRef.current?.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: 15,
      animationDuration: 500,
    });
  };

  const handleStop = () => {
    if (state.phase !== 'recording' && state.phase !== 'paused') {
      router.back();
      return;
    }
    Alert.alert('Stop Walk', 'Stop recording this walk?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: () => {
          void stop();
          // Navigation to walk-summary is handled by the state.phase === 'completed' effect.
        },
      },
    ]);
  };

  const handleBack = () => {
    if (state.phase === 'recording' || state.phase === 'paused') {
      Alert.alert('Recording in progress', 'Stop recording before going back.', [
        { text: 'Keep walking', style: 'cancel' },
        {
          text: 'Stop & exit',
          style: 'destructive',
          onPress: () => void stop(),
        },
      ]);
    } else {
      router.back();
    }
  };

  const isActive = state.phase === 'recording' || state.phase === 'paused';

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled
        compassPosition={{ top: insets.top + 60, right: 12 }}
        rotateEnabled
      >
        <MapboxGL.Camera ref={cameraRef} />

        {/* Live user location puck — handles GPS updates internally */}
        <MapboxGL.UserLocation
          visible
          animated
          showsUserHeadingIndicator
          onUpdate={handleUserLocationUpdate}
        />

        {/* Planned route + walked portion */}
        {route ? (
          <FollowRouteLayer
            route={route}
            walkedPointIndex={walkedIdx}
            cameraPaddingBottom={240}
            cameraPaddingTop={insets.top + 60}
          />
        ) : null}

        {/* Breadcrumb polyline */}
        <LivePositionLayer coordinates={breadcrumb} showUserLocation={false} />
      </MapboxGL.MapView>

      {/* ── Header bar ── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.backgroundCard }]}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.headerBtnText, { color: colors.text }]}>✕</Text>
        </TouchableOpacity>

        <View style={[styles.routeTitlePill, { backgroundColor: colors.backgroundCard }]}>
          <Text style={[styles.routeTitle, { color: colors.text }]} numberOfLines={1}>
            {route?.title ?? 'Follow Walk'}
          </Text>
        </View>

        {/* Spacer to balance header */}
        <View style={styles.headerBtn} />
      </View>

      {/* ── Bottom sheet ── */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.backgroundCard,
            paddingBottom: insets.bottom + Spacing.base,
            borderTopColor: colors.border,
          },
        ]}
      >
        {/* Status row */}
        <View style={styles.statusRow}>
          {/* Recording indicator */}
          <View style={styles.statusItem}>
            <View style={[styles.recDot, isActive && { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
              {state.phase === 'paused' ? 'Paused' : isActive ? 'Recording' : 'Stopped'}
            </Text>
          </View>

          {/* Elapsed time */}
          <View style={styles.statusItem}>
            <Text style={[styles.elapsedTime, { color: colors.text }]}>
              {formatDuration(elapsedSec)}
            </Text>
          </View>

          {/* On/Off route badge */}
          <View
            style={[
              styles.routeBadge,
              { backgroundColor: isOffRoute ? '#F59E0B18' : '#22C55E18' },
            ]}
          >
            <View
              style={[
                styles.routeBadgeDot,
                { backgroundColor: isOffRoute ? '#F59E0B' : '#22C55E' },
              ]}
            />
            <Text
              style={[
                styles.routeBadgeText,
                { color: isOffRoute ? '#92400E' : '#14532D' },
              ]}
            >
              {isOffRoute ? 'OFF ROUTE' : 'ON ROUTE'}
            </Text>
          </View>
        </View>

        {/* Off-route warning */}
        {isOffRoute && (
          <View
            style={[
              styles.offRouteCard,
              { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
            ]}
          >
            <Text style={styles.offRouteText}>
              You appear to be more than {OFF_ROUTE_THRESHOLD_M} m from the planned route.
            </Text>
          </View>
        )}

        {/* Stop button */}
        <TouchableOpacity
          style={[styles.stopBtn, { backgroundColor: '#DC2626' }]}
          onPress={handleStop}
          activeOpacity={0.82}
        >
          <Text style={styles.stopBtnText}>Stop Walk</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 16,
    fontFamily: Typography.fontMedium,
  },
  routeTitlePill: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  routeTitle: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderTopWidth: 1,
    gap: Spacing.sm,
    ...Platform.select({
      android: { elevation: 8 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  statusLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontRegular,
  },
  elapsedTime: {
    fontSize: 20,
    fontFamily: Typography.fontBold,
    letterSpacing: 1,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  routeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  routeBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontBold,
    letterSpacing: 0.5,
  },
  offRouteCard: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  offRouteText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontRegular,
    color: '#92400E',
  },
  stopBtn: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Typography.fontBold,
  },
});
