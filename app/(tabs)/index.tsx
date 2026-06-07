import { useAuth, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useConvex, useMutation } from 'convex/react';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  Dimensions,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DebugStatsPanel } from '@/components/debug/debug-stats-panel';
import { ExploreMapLayer, type ExploreViewBounds, type PlannedRoute } from '@/components/explore/explore-map-layer';
import { ExploreSheetContent } from '@/components/explore/explore-sheet-content';
import { FollowRouteLayer } from '@/components/follow/follow-route-layer';
import { LivePositionLayer } from '@/components/map/live-position-layer';
import { LocationInfoPanel } from '@/components/map/location-info-panel';
import { MapCompassButton } from '@/components/map/map-compass';
import { QueuedRouteLayer } from '@/components/map/queued-route-layer';
import { AltitudeDisplay } from '@/components/recording/altitude-display';
import { DistanceDisplay } from '@/components/recording/distance-display';
import { DraggableStatGrid, type StatPanel } from '@/components/recording/draggable-stat-grid';
import { ElapsedTimer } from '@/components/recording/elapsed-timer';
import { LiveElevationChart } from '@/components/recording/live-elevation-chart';
import { PaceDisplay } from '@/components/recording/pace-display';
import { PhotoFab } from '@/components/recording/photo-button';
import { RecordingControls } from '@/components/recording/recording-controls';
import { RecordingStatusBadge } from '@/components/recording/recording-status-badge';
import { RouteProximityBadge } from '@/components/recording/route-proximity-badge';
import { SavePointButton } from '@/components/recording/save-point-button';
import { EmptyWalkHistory } from '@/components/review/empty-walk-history';
import { HistoryWalkCard } from '@/components/review/history-walk-card';
import { PlanOverlay } from '@/components/planning/plan-overlay';
import { PlanRouteLayer } from '@/components/planning/plan-route-layer';
import { ReviewRouteLayer } from '@/components/review/review-route-layer';
import { usePlanWalk } from '@/hooks/use-plan-walk';
import { SessionsSheetContent } from '@/components/sessions/sessions-sheet-content';
import { PermissionGate } from '@/components/shared/permission-gate';
import { StatCard } from '@/components/shared/stat-card';
import { DevSlider } from '@/components/ui/dev-slider';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RouteColourPicker } from '@/components/ui/route-colour-picker';
import { METRIC_ICONS } from '@/constants/metric-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useQueuedWalk } from '@/contexts/queued-walk-context';
import { useReviewRoute } from '@/contexts/review-route-context';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFeatureFlags, type FeatureFlags, type HapticImpactLevel } from '@/hooks/use-feature-flags';
import { useLocationPermission } from '@/hooks/use-location-permission';
import { useMapFeatures, type MapFeatureFlags } from '@/hooks/use-map-features';
import { fireTestPulse } from '@/hooks/use-off-route-haptic';
import { useRouteColours } from '@/hooks/use-route-colours';
import { useStepCounter } from '@/hooks/use-step-counter';
import { DEFAULT_STAT_PANEL_ORDER, useUserPreferences } from '@/hooks/use-user-preferences';
import { findNearbyRoutes } from '@/lib/db/nearby-routes';
import { getPhotosForWalk, type WalkPhoto } from '@/lib/db/walk-photos';
import {
  checkHealthConnectPermissions,
  isHealthConnectAvailable,
  isHealthConnectUpdateRequired,
  openHealthConnectAppSettings,
  openHealthConnectMainSettings,
  requestHealthConnectPermissions,
} from '@/lib/health-connect';
import { sheetEvents } from '@/lib/ui/sheet-events';
import MapboxGL from '@rnmapbox/maps';
import { useCameraPermissions } from 'expo-camera';
import { Pedometer } from 'expo-sensors';

import { useLiveWalkSync } from '@/hooks/use-live-walk-sync';
import { ensurePendingSyncJob } from '@/lib/db/sync-jobs';
import { getPointsForWalk } from '@/lib/db/track-points';
import { listCompletedWalks, type Walk } from '@/lib/db/walks';
import { isWithinStartThreshold } from '@/lib/explore/proximity';
import { haversineMetres } from '@/lib/location/haversine';
import { processPendingJobs } from '@/lib/sync/sync-manager';
import { randomUUID } from 'expo-crypto';

// Enable LayoutAnimation on Android (required for accordion animation)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function useLiveStats(walkId: string | null) {
  const [distanceMetres, setDistanceMetres] = useState(0);
  const [paceSecsPerKm, setPaceSecsPerKm] = useState<number | undefined>();
  const [lastAltitude, setLastAltitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [coordinates, setCoordinates] = useState<[number, number][]>([]);
  const [elevationGainMetres, setElevationGainMetres] = useState(0);
  const [elevationLossMetres, setElevationLossMetres] = useState(0);
  const [lastSpeedMps, setLastSpeedMps] = useState<number | null>(null);
  const [trackPoints, setTrackPoints] = useState<import('@/lib/db/track-points').TrackPoint[]>([]);
  const [sessionPhotos, setSessionPhotos] = useState<WalkPhoto[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!walkId) {
      setDistanceMetres(0);
      setPaceSecsPerKm(undefined);
      setLastAltitude(null);
      setPointCount(0);
      setCoordinates([]);
      setElevationGainMetres(0);
      setElevationLossMetres(0);
      setLastSpeedMps(null);
      setTrackPoints([]);
      setSessionPhotos([]);
      return;
    }

    const refresh = () => {
      const points = getPointsForWalk(walkId);
      setPointCount(points.length);
      setTrackPoints(points);
      setCoordinates(points.map((p) => [p.longitude, p.latitude]));

      // Refresh photos for elevation chart markers
      setSessionPhotos(getPhotosForWalk(walkId));

      if (points.length === 0) return;

      const last = points[points.length - 1]!;
      setLastAltitude(last.altitudeMetres);
      setAccuracy(last.accuracyMetres);
      setLastSpeedMps(last.speedMps);

      if (points.length < 2) return;

      let dist = 0;
      for (let i = 1; i < points.length; i++) {
        dist += haversineMetres(
          points[i - 1]!.latitude,
          points[i - 1]!.longitude,
          points[i]!.latitude,
          points[i]!.longitude,
        );
      }
      setDistanceMetres(Math.round(dist));

      const first = points[0]!;
      const durationSec = (last.timestamp - first.timestamp) / 1000;
      if (dist > 100 && durationSec > 0) {
        setPaceSecsPerKm(durationSec / (dist / 1000));
      }

      // Elevation gain/loss from altitude-bearing points
      const altPoints = points.filter((p) => p.altitudeMetres !== null);
      let gain = 0;
      let loss = 0;
      for (let i = 1; i < altPoints.length; i++) {
        const diff = altPoints[i]!.altitudeMetres! - altPoints[i - 1]!.altitudeMetres!;
        if (diff > 0) gain += diff;
        else loss -= diff;
      }
      setElevationGainMetres(gain);
      setElevationLossMetres(loss);
    };

    refresh();
    intervalRef.current = setInterval(refresh, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [walkId]);

  return {
    distanceMetres,
    paceSecsPerKm,
    lastAltitude,
    accuracy,
    pointCount,
    coordinates,
    elevationGainMetres,
    elevationLossMetres,
    lastSpeedMps,
    trackPoints,
    sessionPhotos,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetTab = 'plan' | 'record' | 'explore' | 'sessions' | 'profile' | 'queued-walk';

// ---------------------------------------------------------------------------
// Sheet content components
// ---------------------------------------------------------------------------

type ColorPalette = typeof Colors.light | typeof Colors.dark;

// ---------------------------------------------------------------------------
// Idle welcome card (shown when no session is active)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Record sheet content
// ---------------------------------------------------------------------------

function formatWaypointTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function buildStatPanels({
  distanceMetres,
  paceSecsPerKm,
  stepCount,
  stepSource,
  elevationGainMetres,
  elevationLossMetres,
  displayAltitude,
  speedKmh,
  caloriesKcal,
  bodyWeightKg,
  trackPoints,
  sessionPhotos,
}: {
  distanceMetres: number;
  paceSecsPerKm: number | undefined;
  stepCount: number;
  stepSource: import('@/hooks/use-step-counter').StepSource;
  elevationGainMetres: number;
  elevationLossMetres: number;
  displayAltitude: number | null;
  speedKmh: string | null;
  caloriesKcal: number | null;
  bodyWeightKg: number | null;
  trackPoints: import('@/lib/db/track-points').TrackPoint[];
  sessionPhotos: WalkPhoto[];
}): StatPanel[] {
  return [
    {
      key: 'distance',
      node: <DistanceDisplay distanceMetres={distanceMetres} />,
    },
    {
      key: 'pace',
      node: <PaceDisplay paceSecsPerKm={paceSecsPerKm} />,
    },
    {
      key: 'steps',
      node: (
        <StatCard
          label="Steps"
          value={stepCount > 0 ? stepCount.toLocaleString() : '--'}
          {...(stepSource != null && { unit: stepSource === 'hc' ? 'HC' : 'D' })}
          size="md"
          align="center"
          icon={METRIC_ICONS.steps}
        />
      ),
    },
    {
      key: 'elevGain',
      node: (
        <StatCard
          label="Elev Gain"
          value={elevationGainMetres > 0 ? String(Math.round(elevationGainMetres)) : '--'}
          {...(elevationGainMetres > 0 && { unit: 'm' })}
          size="md"
          align="center"
          icon={METRIC_ICONS.elevationGain}
        />
      ),
    },
    {
      key: 'elevLoss',
      node: (
        <StatCard
          label="Elev Loss"
          value={elevationLossMetres > 0 ? String(Math.round(elevationLossMetres)) : '--'}
          {...(elevationLossMetres > 0 && { unit: 'm' })}
          size="md"
          align="center"
          icon={METRIC_ICONS.elevationLoss}
        />
      ),
    },
    {
      key: 'altitude',
      node: <AltitudeDisplay altitudeMetres={displayAltitude} />,
    },
    {
      key: 'speed',
      node: (
        <StatCard
          label="Speed"
          value={speedKmh ?? '--'}
          {...(speedKmh != null && { unit: 'km/h' })}
          size="md"
          align="center"
          icon={METRIC_ICONS.speed}
        />
      ),
    },
    {
      key: 'calories',
      node: (
        <StatCard
          label="Calories"
          value={caloriesKcal != null ? String(caloriesKcal) : '--'}
          {...(caloriesKcal != null && { unit: 'kcal' })}
          size="md"
          align="center"
          icon={METRIC_ICONS.calories}
        />
      ),
      onPress: () => {
        Alert.alert(
          'Active Calories',
          `Estimate based on MET 3.5 × body weight.${bodyWeightKg == null ? '\n\nSet your weight in Profile to enable.' : ''}`,
        );
      },
    },
    {
      key: 'elevation',
      fullWidth: true,
      node: (
        <View>
          <Text style={sheetStyles.sectionLabel}>ELEVATION PROFILE</Text>
          <LiveElevationChart points={trackPoints} photos={sessionPhotos} />
        </View>
      ),
    },
  ];
}

function RecordSheetContent({
  colors,
  insets,
  state,
  pausedDurationMs,
  distanceMetres,
  paceSecsPerKm,
  displayAltitude,
  pointCount,
  stepCount,
  stepSource,
  currentLocation,
  elevationGainMetres,
  elevationLossMetres,
  lastSpeedMps,
  trackPoints,
  sessionPhotos,
  bodyWeightKg,
  onSetBodyWeight,
  statPanelOrder,
  onStatPanelReorder,
  pause,
  resume,
  stop,
  reset,
}: {
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  state: ReturnType<typeof useWalkSessionContext>['state'];
  pausedDurationMs: number;
  distanceMetres: number;
  paceSecsPerKm: number | undefined;
  displayAltitude: number | null;
  pointCount: number;
  stepCount: number;
  stepSource: import('@/hooks/use-step-counter').StepSource;
  currentLocation: { latitude: number; longitude: number } | null;
  elevationGainMetres: number;
  elevationLossMetres: number;
  lastSpeedMps: number | null;
  trackPoints: import('@/lib/db/track-points').TrackPoint[];
  sessionPhotos: WalkPhoto[];
  bodyWeightKg: number | null;
  onSetBodyWeight: (kg: number) => void;
  statPanelOrder: string[];
  onStatPanelReorder: (keys: string[]) => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: (stepCount?: number) => Promise<void>;
  reset: () => void;
}) {
  const stopCountRef = useRef(0);

  // Auto-reset to idle if we arrive here after a session completed
  useEffect(() => {
    if (state.phase === 'completed') {
      reset();
    }
  }, [state.phase, reset]);

  // Completing → full-screen overlay on the map handles the visual; sheet renders nothing.
  if (state.phase === 'completing') {
    return null;
  }

  // Compute live stats
  const startedAt =
    state.phase === 'recording' || state.phase === 'paused'
      ? (state as { startedAt: number }).startedAt
      : 0;
  const elapsedSecs = startedAt > 0 ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const movingTimeSecs = Math.max(0, elapsedSecs - pausedDurationMs / 1000);
  const caloriesKcal =
    bodyWeightKg != null && movingTimeSecs > 0
      ? Math.round(3.5 * bodyWeightKg * (movingTimeSecs / 3600))
      : null;
  const speedKmh = lastSpeedMps != null ? (lastSpeedMps * 3.6).toFixed(1) : null;
  const walkId =
    state.phase === 'recording' || state.phase === 'paused' ? state.walkId : null;

  // Idle or active → show stat grid (zeros when idle)
  return (
    <View style={{ flex: 1 }}>
      {/* Frosted glass header — elapsed timer + controls */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 0}
        tint={colors.background === '#0d1f14' ? 'dark' : 'light'}
        style={[sheetStyles.recordFixedHeader, { borderBottomColor: colors.border }]}
      >
        {Platform.OS === 'android' && (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + 'D8' }]}
          />
        )}
        {/* Full-width elapsed timer */}
        <ElapsedTimer
          startedAt={startedAt}
          pausedDurationMs={pausedDurationMs}
          running={state.phase === 'recording'}
          size="lg"
          style={{ minHeight: 100, flex: 0 }}
        />

        {/* Pause / Stop / Resume buttons */}
        <RecordingControls
          phase={state.phase}
          onPause={() => { void pause(); }}
          onResume={() => { void resume(); }}
          onStop={() => { void stop(stopCountRef.current); }}
        />
      </BlurView>

      {/* Scrollable stats area — solid background */}
      <BottomSheetScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[
          sheetStyles.content,
          { paddingBottom: insets.bottom + Spacing.base },
        ]}
      >
        <View style={sheetStyles.section}>
          {/* 2-col draggable stat grid */}
          <DraggableStatGrid
            panels={buildStatPanels({
              distanceMetres,
              paceSecsPerKm,
              stepCount,
              stepSource,
              elevationGainMetres,
              elevationLossMetres,
              displayAltitude,
              speedKmh,
              caloriesKcal,
              bodyWeightKg,
              trackPoints,
              sessionPhotos,
            })}
            order={statPanelOrder}
            onReorder={onStatPanelReorder}
          />

          {/* Debug row */}
          <View style={sheetStyles.debugRow}>
            <Text style={[sheetStyles.debugText, { color: colors.textMuted }]}>
              pts: {pointCount}
            </Text>
            <Text style={[sheetStyles.debugText, { color: colors.textMuted }]}>
              {currentLocation
                ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                : 'no fix'}
            </Text>
          </View>
        </View>
      </BottomSheetScrollView>
    </View>
  );
}

function HistorySheetContent({
  colors,
  insets,
  onClose,
  allowDuringRecording,
}: {
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onClose: () => void;
  allowDuringRecording: boolean;
}) {
  const router = useRouter();
  const convex = useConvex();
  const { state } = useWalkSessionContext();
  const [walks, setWalks] = useState<Walk[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Load walks on mount (component only mounts while the sheet is open)
  useEffect(() => {
    setWalks(listCompletedWalks());
  }, []);

  const unsynced = walks.filter((w) => w.convexId === null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      for (const walk of unsynced) {
        ensurePendingSyncJob(walk.id, walk.deviceId, randomUUID());
      }
      await processPendingJobs(convex);
    } finally {
      setWalks(listCompletedWalks());
      setSyncing(false);
    }
  };

  const handleWalkPress = (walkId: string) => {
    if (!allowDuringRecording && (state.phase === 'recording' || state.phase === 'paused')) {
      Alert.alert('Recording in progress', 'Stop your current walk before opening a saved route.', [{ text: 'OK' }]);
      return;
    }
    onClose();
    router.push({ pathname: '/walk-summary', params: { walkId } });
  };

  const walkCount = walks.length;
  const walkLabel = `${walkCount} ${walkCount === 1 ? 'walk' : 'walks'}`;

  return (
    <BottomSheetFlatList
      data={walks}
      keyExtractor={(w: Walk) => w.id}
      contentContainerStyle={[
        sheetStyles.content,
        { paddingBottom: insets.bottom + Spacing.base },
      ]}
      ListHeaderComponent={
        <View style={sheetStyles.historyHeader}>
          <Text style={[sheetStyles.historyCount, { color: colors.textMuted }]}>{walkLabel}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.base, alignItems: 'center' }}>
            {unsynced.length > 0 && (
              <TouchableOpacity onPress={() => void handleSync()} disabled={syncing}>
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[sheetStyles.viewOnMap, { color: colors.primary }]}>Sync walks</Text>
                )}
              </TouchableOpacity>
            )}
            {walkCount > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
                <Text style={[sheetStyles.viewOnMap, { color: colors.primary }]}>View on map</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyWalkHistory />}
      renderItem={({ item }: { item: Walk }) => (
        <HistoryWalkCard
          walk={item}
          synced={item.convexId !== null}
          onPress={() => handleWalkPress(item.id)}
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Permissions section (profile sheet)
// ---------------------------------------------------------------------------

type PermRowStatus = 'checking' | 'granted' | 'not_granted' | 'denied' | 'unavailable' | 'update_required';

function PermissionRow({
  colors,
  name,
  description,
  status,
  onRequest,
  detail,
  secondaryLink,
  badge,
  showDivider = true,
}: {
  colors: ColorPalette;
  name: string;
  description: string;
  status: PermRowStatus;
  onRequest?: () => void;
  detail?: string;
  secondaryLink?: { label: string; onPress: () => void };
  badge?: ReactNode;
  showDivider?: boolean;
}) {
  const pill =
    status === 'granted'
      ? { bg: colors.successMuted,    text: colors.success,   label: 'Granted' }
      : status === 'not_granted'
      ? { bg: colors.primaryMuted,    text: colors.primary,   label: 'Required' }
      : status === 'denied'
      ? { bg: colors.primaryMuted,    text: colors.primary,   label: 'Denied' }
      : status === 'update_required'
      ? { bg: colors.primaryMuted,    text: colors.primary,   label: 'Update required' }
      : status === 'unavailable'
      ? { bg: colors.backgroundMuted, text: colors.textMuted, label: 'Unavailable' }
      : { bg: colors.backgroundMuted, text: colors.textMuted, label: 'Checking…' };

  const actionLabel =
    status === 'denied'          ? 'Open Settings' :
    status === 'update_required' ? 'Update in Play Store' :
    status === 'granted'         ? 'Manage access' :
    'Grant access';

  // Show the action link only when there is an onRequest handler — callers are
  // responsible for NOT passing onRequest when the permission is already granted
  // and there is nothing useful to request (e.g. location / camera when granted).
  const needsAction = onRequest != null;

  return (
    <>
      <View style={[sheetStyles.flagRow, { alignItems: 'flex-start' }]}>
        <View style={[sheetStyles.flagLabel, { flex: 1 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>{name}</Text>
            {badge}
          </View>
          <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>{description}</Text>
          {detail ? (
            <View style={{ marginTop: 4, paddingLeft: 8 }}>
              {detail.split('\n').map((line) => {
                const isGranted = line.startsWith('✓');
                return (
                  <Text
                    key={line}
                    style={[sheetStyles.flagDesc, { color: isGranted ? colors.success : colors.textMuted }]}
                  >
                    {line}
                  </Text>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={[permStyles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[permStyles.pillText, { color: pill.text }]}>{pill.label}</Text>
        </View>
      </View>
      {(needsAction || secondaryLink != null) && (
        <View style={[permStyles.grantRow, { justifyContent: needsAction && secondaryLink != null ? 'space-between' : 'flex-end' }]}>
          {needsAction && (
            <Pressable onPress={onRequest} hitSlop={8}>
              <Text style={[permStyles.grantText, { color: colors.primary }]}>{actionLabel}</Text>
            </Pressable>
          )}
          {secondaryLink != null && (
            <Pressable onPress={secondaryLink.onPress} hitSlop={8}>
              <Text style={[permStyles.grantText, { color: colors.textMuted }]}>{secondaryLink.label}</Text>
            </Pressable>
          )}
        </View>
      )}
      {showDivider && (
        <View style={[permStyles.divider, { backgroundColor: colors.border }]} />
      )}
    </>
  );
}

function PermissionsSection({ colors }: { colors: ColorPalette }) {
  const locPerms = useLocationPermission();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Pedometer — available on both platforms; foreground-only on Android
  const [pedometerAvailable, setPedometerAvailable] = useState<boolean | null>(null);
  const [pedometerPermission, setPedometerPermission] = useState<Awaited<ReturnType<typeof Pedometer.getPermissionsAsync>> | null>(null);

  const checkPedometer = async () => {
    const available = await Pedometer.isAvailableAsync();
    setPedometerAvailable(available);
    if (available) {
      const perm = await Pedometer.getPermissionsAsync();
      setPedometerPermission(perm);
    }
  };

  useEffect(() => {
    void checkPedometer();
  }, []);

  const pedometerStatus: PermRowStatus =
    pedometerAvailable === null                     ? 'checking'   :
    pedometerAvailable === false                    ? 'unavailable' :
    pedometerPermission === null                    ? 'checking'   :
    pedometerPermission.granted                     ? 'granted'    :
    !pedometerPermission.canAskAgain                ? 'denied'     : 'not_granted';

  const [hcStatus, setHcStatus] = useState<PermRowStatus>('checking');
  const [hcDetail, setHcDetail] = useState<string | undefined>();

  const checkHc = async () => {
    const available = await isHealthConnectAvailable();
    if (!available) {
      const needsUpdate = await isHealthConnectUpdateRequired();
      setHcStatus(needsUpdate ? 'update_required' : 'unavailable');
      return;
    }
    const granted = await checkHealthConnectPermissions();
    // "Core" only requires the read permissions — write permissions (ExerciseSession)
    // are a separate category in HC's UI and may not be offered in the same dialog.
    const hasCore = granted != null && granted.readSteps;
    if (granted != null) {
      // Always show individual breakdown so user can see what is/isn't granted.
      // Names match what Android Health Connect displays in its permissions screen.
      const parts: string[] = [
        `${granted.readSteps          ? '✓' : '✗'} Steps`,
        `${granted.readDistance       ? '✓' : '✗'} Distance`,
        `${granted.readCalories       ? '✓' : '✗'} Active Calories`,
        `${granted.readHeartRate      ? '✓' : '✗'} Heart Rate`,
        `${granted.writeExerciseRoute ? '✓' : '✗'} Exercise Route`,
      ];
      setHcDetail(parts.join('\n'));
    }
    setHcStatus(hasCore ? 'granted' : 'not_granted');
  };

  useEffect(() => {
    void checkHc();
    // Re-check whenever the app comes back to the foreground (e.g. after the
    // user grants permissions in the HC app or system settings).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkHc();
    });
    return () => sub.remove();
  }, []);

  const handleHcRequest = async () => {
    await requestHealthConnectPermissions();
    // Re-check via getGrantedPermissions (already done inside requestHealthConnectPermissions),
    // then refresh display state with the same check used on mount / foreground.
    await checkHc();
  };

  const fgStatus: PermRowStatus =
    !locPerms.loaded             ? 'checking' :
    locPerms.foreground === 'granted' ? 'granted' :
    locPerms.foreground === 'denied'  ? 'denied'  : 'not_granted';

  const bgStatus: PermRowStatus =
    !locPerms.loaded                       ? 'checking'    :
    locPerms.foreground !== 'granted'      ? 'not_granted' :
    locPerms.background === 'granted'      ? 'granted'     :
    locPerms.background === 'denied'       ? 'denied'      : 'not_granted';

  const cameraStatus: PermRowStatus =
    cameraPermission == null              ? 'checking'  :
    cameraPermission.granted              ? 'granted'   :
    cameraPermission.status === 'denied'  ? 'denied'    : 'not_granted';

  return (
    <View style={[sheetStyles.flagsSection, { borderColor: colors.border }]}>
      <Text style={[sheetStyles.flagsTitle, { color: colors.textMuted }]}>Permissions</Text>
      {/* Only pass onRequest when there is something to do — granted perms need no action */}
      <PermissionRow
        colors={colors}
        name="Location"
        description="Required to record your walk route"
        status={fgStatus}
        {...(fgStatus === 'not_granted' || fgStatus === 'denied' ? {
          onRequest: fgStatus === 'denied'
            ? () => { void Linking.openSettings(); }
            : () => { void locPerms.requestForeground(); },
        } : {})}
      />
      <PermissionRow
        colors={colors}
        name="Background Location"
        description="Keeps recording when the screen is off or the app is in the background"
        status={bgStatus}
        {...(bgStatus === 'not_granted' || bgStatus === 'denied' ? {
          onRequest: bgStatus === 'denied'
            ? () => { void Linking.openSettings(); }
            : () => {
                if (locPerms.foreground !== 'granted') {
                  void locPerms.requestForeground().then(() => locPerms.requestBackground());
                } else {
                  void locPerms.requestBackground();
                }
              },
        } : {})}
      />
      <PermissionRow
        colors={colors}
        name="Camera"
        description="Take photos during a walk"
        status={cameraStatus}
        {...(cameraStatus === 'not_granted' || cameraStatus === 'denied' ? {
          onRequest: cameraStatus === 'denied'
            ? () => { void Linking.openSettings(); }
            : () => { void requestCameraPermission(); },
        } : {})}
      />
      <PermissionRow
        colors={colors}
        name="Pedometer"
        description="Counts your steps in real time during a walk"
        status={pedometerStatus}
        {...(pedometerStatus === 'not_granted' ? {
          onRequest: () => {
            void Pedometer.requestPermissionsAsync().then((perm) => {
              setPedometerPermission(perm);
            });
          },
        } : pedometerStatus === 'denied' ? {
          onRequest: () => { void Linking.openSettings(); },
        } : {})}
      />
      <PermissionRow
        colors={colors}
        name="Health Connect"
        description="Step counting and syncing completed walks to Android Health Connect"
        status={hcStatus}
        {...(hcDetail != null ? { detail: hcDetail } : {})}
        badge={hcStatus === 'granted' || hcStatus === 'not_granted' ? (
          <View style={[permStyles.hcBadge, { backgroundColor: colors.successMuted }]}>
            <Text style={[permStyles.hcBadgeText, { color: colors.success }]}>Installed</Text>
          </View>
        ) : undefined}
        {...(hcStatus === 'checking' ? {} :
          hcStatus === 'unavailable' ? {
            // HC not installed — offer Play Store link (no onRequest, just a secondary link)
            secondaryLink: { label: 'Get Health Connect', onPress: () => { void Linking.openURL('market://details?id=com.google.android.apps.healthdata'); } },
          } :
          hcStatus === 'update_required' ? {
            onRequest: () => { void Linking.openURL('market://details?id=com.google.android.apps.healthdata'); },
          } :
          hcStatus === 'not_granted' ? {
            // First-time setup: show the requestPermission dialog.
            onRequest: () => { void handleHcRequest(); },
          } : {
            // HC granted — always show Manage access (opens HC main settings so the
            // user can toggle individual permissions) and View data.
            onRequest: () => { openHealthConnectMainSettings(); },
            secondaryLink: { label: 'View data', onPress: openHealthConnectAppSettings },
          }
        )}
        showDivider={false}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Accordion — used in Profile sheet
// ---------------------------------------------------------------------------
function SheetAccordion({
  title,
  icon,
  colors,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: string;
  colors: ColorPalette;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotation, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen((prev) => !prev);
  }, [open, rotation]);

  const chevronDeg = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={[accStyle.wrapper, { borderColor: colors.border }]}>
      <Pressable
        style={[accStyle.header, { backgroundColor: colors.backgroundCard }]}
        onPress={toggle}
        android_ripple={{ color: colors.border }}
      >
        <View style={accStyle.headerLeft}>
          <Ionicons name={icon as never} size={17} color={colors.primary} />
          <Text style={[accStyle.headerTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronDeg }] }}>
          <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={[accStyle.body, { borderTopColor: colors.border }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const accStyle = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.base,
    gap: Spacing.md,
  },
});

function ProfileSheetContent({
  colors,
  insets,
  allowHistoryDuringRecording,
  onToggleAllowHistoryDuringRecording,
  gpsAccuracyMultiplier,
  onGpsAccuracyMultiplierChange,
  forcePedometerSteps,
  onToggleForcePedometerSteps,
  startProximityThresholdM,
  onStartProximityThresholdMChange,
  hapticOffRouteEnabled,
  onToggleHapticOffRouteEnabled,
  hapticOffRouteStartM,
  onHapticOffRouteStartMChange,
  hapticOffRouteMaxM,
  onHapticOffRouteMaxMChange,
  hapticMinImpact,
  onHapticMinImpactChange,
  hapticMaxImpact,
  onHapticMaxImpactChange,
  hapticSlowIntervalMs,
  onHapticSlowIntervalMsChange,
  hapticFastIntervalMs,
  onHapticFastIntervalMsChange,
  hapticTestEnabled,
  onToggleHapticTestEnabled,
  hapticTestDistanceM,
  onHapticTestDistanceMChange,
  exploreDirectDetail,
  onToggleExploreDirectDetail,
  flags,
  mapFeatures,
  onSetMapFeature,
  cam3dMinZoom,
  onCam3dMinZoomChange,
  cam3dMaxZoom,
  onCam3dMaxZoomChange,
  cam3dMinPitch,
  onCam3dMinPitchChange,
  cam3dMaxPitch,
  onCam3dMaxPitchChange,
  terrainExaggeration,
  onTerrainExaggerationChange,
}: {
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  allowHistoryDuringRecording: boolean;
  onToggleAllowHistoryDuringRecording: (value: boolean) => void;
  gpsAccuracyMultiplier: number;
  onGpsAccuracyMultiplierChange: (value: number) => void;
  forcePedometerSteps: boolean;
  onToggleForcePedometerSteps: (value: boolean) => void;
  startProximityThresholdM: number;
  onStartProximityThresholdMChange: (value: number) => void;
  hapticOffRouteEnabled: boolean;
  onToggleHapticOffRouteEnabled: (value: boolean) => void;
  hapticOffRouteStartM: number;
  onHapticOffRouteStartMChange: (value: number) => void;
  hapticOffRouteMaxM: number;
  onHapticOffRouteMaxMChange: (value: number) => void;
  hapticMinImpact: HapticImpactLevel;
  onHapticMinImpactChange: (value: HapticImpactLevel) => void;
  hapticMaxImpact: HapticImpactLevel;
  onHapticMaxImpactChange: (value: HapticImpactLevel) => void;
  hapticSlowIntervalMs: number;
  onHapticSlowIntervalMsChange: (value: number) => void;
  hapticFastIntervalMs: number;
  onHapticFastIntervalMsChange: (value: number) => void;
  hapticTestEnabled: boolean;
  onToggleHapticTestEnabled: (value: boolean) => void;
  hapticTestDistanceM: number;
  onHapticTestDistanceMChange: (value: number) => void;
  exploreDirectDetail: boolean;
  onToggleExploreDirectDetail: (value: boolean) => void;
  flags: FeatureFlags;
  mapFeatures: MapFeatureFlags;
  onSetMapFeature: <K extends keyof MapFeatureFlags>(key: K, value: MapFeatureFlags[K]) => void;
  cam3dMinZoom: number;
  onCam3dMinZoomChange: (value: number) => void;
  cam3dMaxZoom: number;
  onCam3dMaxZoomChange: (value: number) => void;
  cam3dMinPitch: number;
  onCam3dMinPitchChange: (value: number) => void;
  cam3dMaxPitch: number;
  onCam3dMaxPitchChange: (value: number) => void;
  terrainExaggeration: number;
  onTerrainExaggerationChange: (value: number) => void;
}) {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { colours, setColour, resetColours } = useRouteColours();
  const { preferences, setPreference } = useUserPreferences();
  const [weightDraft, setWeightDraft] = useState<string>(
    preferences.bodyWeightKg !== null ? String(preferences.bodyWeightKg) : '',
  );
  useEffect(() => {
    setWeightDraft(preferences.bodyWeightKg !== null ? String(preferences.bodyWeightKg) : '');
  }, [preferences.bodyWeightKg]);
  const upsertCurrentUser = useMutation(api.users.upsertCurrentUser);

  useEffect(() => {
    if (!user) return;
    upsertCurrentUser({
      ...(user.fullName ? { name: user.fullName } : {}),
      ...(user.primaryEmailAddress?.emailAddress
        ? { email: user.primaryEmailAddress.emailAddress }
        : {}),
    }).catch(() => {});
  }, [user, upsertCurrentUser]);

  const displayName = user?.fullName ?? user?.firstName ?? 'Walker';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ── Frosted glass header: avatar + name + email + sign out ── */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 80 : 0}
        tint={colors.background === '#0d1f14' ? 'dark' : 'light'}
        style={[
          sheetStyles.profileFrostedHeader,
          { borderBottomColor: colors.border },
        ]}
      >
        {Platform.OS === 'android' && (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + 'D8' }]}
          />
        )}
        <View style={[sheetStyles.avatar, { backgroundColor: colors.primary + '22', borderColor: colors.border }]}>
          <Text style={[sheetStyles.avatarLetter, { color: colors.primary }]}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[sheetStyles.profileName, { color: colors.text }]}>{displayName}</Text>
        {email ? (
          <Text style={[sheetStyles.profileEmail, { color: colors.textMuted, marginBottom: Spacing.base }]}>{email}</Text>
        ) : null}
        <Pressable
          style={[sheetStyles.signOutButton, { borderColor: colors.border }]}
          onPress={handleSignOut}
        >
          <Text style={[sheetStyles.signOutText, { color: colors.textMuted }]}>Sign Out</Text>
        </Pressable>
      </BlurView>

      {/* ── Solid content: accordions ── */}
      <BottomSheetScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[
          sheetStyles.content,
          { paddingBottom: insets.bottom + Spacing.base },
        ]}
      >

      {/* ── Preferences ── */}
      <SheetAccordion title="Preferences" icon="options-outline" colors={colors} defaultOpen>
        {/* Distance unit */}
        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Distance unit</Text>
          </View>
          <View style={[profileStyles.segmentControl, { borderColor: colors.border }]}>
            <Pressable
              style={[profileStyles.segment, !preferences.preferMiles && { backgroundColor: colors.primary }]}
              onPress={() => setPreference('preferMiles', false)}
            >
              <Text style={{ color: preferences.preferMiles ? colors.textMuted : colors.textInverse, fontFamily: Typography.fontMedium, fontSize: Typography.sizes.xs }}>km</Text>
            </Pressable>
            <Pressable
              style={[profileStyles.segment, preferences.preferMiles && { backgroundColor: colors.primary }]}
              onPress={() => setPreference('preferMiles', true)}
            >
              <Text style={{ color: preferences.preferMiles ? colors.textInverse : colors.textMuted, fontFamily: Typography.fontMedium, fontSize: Typography.sizes.xs }}>mi</Text>
            </Pressable>
          </View>
        </View>
        {/* Body weight */}
        <View style={sheetStyles.flagRow}>
          <View style={[sheetStyles.flagLabel, { flex: 1 }]}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Body weight</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Used for calorie estimates</Text>
          </View>
          <View style={[profileStyles.weightInputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[profileStyles.weightInput, { color: colors.text }]}
              value={weightDraft}
              onChangeText={setWeightDraft}
              keyboardType="decimal-pad"
              placeholder="--"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onEndEditing={() => {
                const parsed = parseFloat(weightDraft);
                if (!weightDraft.trim()) {
                  setPreference('bodyWeightKg', null);
                } else if (!isNaN(parsed) && parsed > 0 && parsed < 500) {
                  setPreference('bodyWeightKg', parsed);
                } else {
                  setWeightDraft(preferences.bodyWeightKg !== null ? String(preferences.bodyWeightKg) : '');
                }
              }}
            />
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>kg</Text>
          </View>
        </View>
      </SheetAccordion>

      {/* ── Permissions ── */}
      <SheetAccordion title="Permissions" icon="shield-checkmark-outline" colors={colors}>
        <PermissionsSection colors={colors} />
      </SheetAccordion>

      {/* ── Developer Settings ── */}
      <SheetAccordion title="Developer Settings" icon="code-slash-outline" colors={colors}>
        {/* Stats & State — first option */}
        <SheetAccordion title="Stats & State" icon="pulse-outline" colors={colors}>
          <DebugStatsPanel flags={flags} colors={colors} />
        </SheetAccordion>

        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>History during recording</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Allow viewing walk history while a walk is being recorded</Text>
          </View>
          <Switch
            value={allowHistoryDuringRecording}
            onValueChange={onToggleAllowHistoryDuringRecording}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Force pedometer steps</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Use device pedometer even when Health Connect is available</Text>
          </View>
          <Switch
            value={forcePedometerSteps}
            onValueChange={onToggleForcePedometerSteps}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>GPS jitter filter</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Multiplier applied to GPS accuracy radius — higher values filter more noise</Text>
            </View>
            <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 32, textAlign: 'right' }]}>
              {gpsAccuracyMultiplier.toFixed(1)}×
            </Text>
          </View>
          <DevSlider
            minimumValue={1}
            maximumValue={4}
            step={0.1}
            value={gpsAccuracyMultiplier}
            onValueChange={(v) => onGpsAccuracyMultiplierChange(v)}
            trackFillColor={colors.primary}
            trackEmptyColor={colors.border}
            accentColor={colors.primary}
            labelColor={colors.text}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>1.0× (strict)</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>4.0× (loose)</Text>
          </View>
        </View>

        {/* Start walk proximity threshold */}
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Start walk threshold</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Distance within which "Start Walk" is shown instead of "Walk When Near"</Text>
            </View>
            <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 48, textAlign: 'right' }]}>
              {startProximityThresholdM} m
            </Text>
          </View>
          <DevSlider
            minimumValue={10}
            maximumValue={500}
            step={10}
            value={startProximityThresholdM}
            onValueChange={(v) => onStartProximityThresholdMChange(v)}
            trackFillColor={colors.primary}
            trackEmptyColor={colors.border}
            accentColor={colors.primary}
            labelColor={colors.text}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>10 m (tight)</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>500 m (loose)</Text>
          </View>
        </View>

        {/* Explore — direct detail mode */}
        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Explore direct detail</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Single tap shows route info panel immediately (skips highlight step)</Text>
          </View>
          <Switch
            value={exploreDirectDetail}
            onValueChange={onToggleExploreDirectDetail}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {/* Off-route haptic feedback — master toggle */}
        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Off-route haptic feedback</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Pulse the device when straying from a planned route</Text>
          </View>
          <Switch
            value={hapticOffRouteEnabled}
            onValueChange={onToggleHapticOffRouteEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {/* Off-route haptic — start distance */}
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Haptic start distance</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Distance from path at which haptic pulsing begins</Text>
            </View>
            <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 48, textAlign: 'right' }]}>
              {hapticOffRouteStartM} m
            </Text>
          </View>
          <DevSlider
            minimumValue={5}
            maximumValue={100}
            step={5}
            value={hapticOffRouteStartM}
            onValueChange={(v) => onHapticOffRouteStartMChange(v)}
            trackFillColor={colors.primary}
            trackEmptyColor={colors.border}
            accentColor={colors.primary}
            labelColor={colors.text}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>5 m</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>100 m</Text>
          </View>
        </View>

        {/* Off-route haptic — min impact */}
        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Min impact</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Impact style at the start-distance threshold</Text>
          </View>
          <View style={[profileStyles.segmentControl, { borderColor: colors.border }]}>
            {(['light', 'medium', 'heavy'] as HapticImpactLevel[]).map((level) => (
              <Pressable
                key={level}
                style={[profileStyles.segment, hapticMinImpact === level && { backgroundColor: colors.primary }]}
                onPress={() => onHapticMinImpactChange(level)}
              >
                <Text style={[{ color: hapticMinImpact === level ? '#fff' : colors.textMuted, fontFamily: Typography.fontMedium, fontSize: Typography.sizes.xs }]}>
                  {level[0]!.toUpperCase() + level.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Off-route haptic — max impact */}
        <View style={sheetStyles.flagRow}>
          <View style={sheetStyles.flagLabel}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Max impact</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Impact style at the max-urgency threshold</Text>
          </View>
          <View style={[profileStyles.segmentControl, { borderColor: colors.border }]}>
            {(['light', 'medium', 'heavy'] as HapticImpactLevel[]).map((level) => (
              <Pressable
                key={level}
                style={[profileStyles.segment, hapticMaxImpact === level && { backgroundColor: colors.primary }]}
                onPress={() => onHapticMaxImpactChange(level)}
              >
                <Text style={[{ color: hapticMaxImpact === level ? '#fff' : colors.textMuted, fontFamily: Typography.fontMedium, fontSize: Typography.sizes.xs }]}>
                  {level[0]!.toUpperCase() + level.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Off-route haptic — max urgency distance */}
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Haptic max-urgency distance</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Distance at which haptic reaches fastest pulse and heaviest impact</Text>
            </View>
            <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 48, textAlign: 'right' }]}>
              {hapticOffRouteMaxM} m
            </Text>
          </View>
          <DevSlider
            minimumValue={20}
            maximumValue={200}
            step={5}
            value={hapticOffRouteMaxM}
            onValueChange={(v) => onHapticOffRouteMaxMChange(v)}
            trackFillColor={colors.primary}
            trackEmptyColor={colors.border}
            accentColor={colors.primary}
            labelColor={colors.text}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>20 m</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>200 m</Text>
          </View>
        </View>

        {/* Off-route haptic — slow interval */}
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Slow interval</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Pulse every N ms when barely off route (at start distance)</Text>
            </View>
            <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 56, textAlign: 'right' }]}>
              {hapticSlowIntervalMs} ms
            </Text>
          </View>
          <DevSlider
            minimumValue={500}
            maximumValue={5000}
            step={100}
            value={hapticSlowIntervalMs}
            onValueChange={(v) => onHapticSlowIntervalMsChange(v)}
            trackFillColor={colors.primary}
            trackEmptyColor={colors.border}
            accentColor={colors.primary}
            labelColor={colors.text}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>500 ms</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>5000 ms</Text>
          </View>
        </View>

        {/* Off-route haptic — fast interval */}
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Fast interval</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Pulse every N ms at max urgency (at max-urgency distance)</Text>
            </View>
            <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 56, textAlign: 'right' }]}>
              {hapticFastIntervalMs} ms
            </Text>
          </View>
          <DevSlider
            minimumValue={100}
            maximumValue={1500}
            step={50}
            value={hapticFastIntervalMs}
            onValueChange={(v) => onHapticFastIntervalMsChange(v)}
            trackFillColor={colors.primary}
            trackEmptyColor={colors.border}
            accentColor={colors.primary}
            labelColor={colors.text}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>100 ms</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>1500 ms</Text>
          </View>
        </View>

        {/* Haptic test panel */}
        <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.sm, backgroundColor: colors.backgroundMuted, borderRadius: Radius.sm, padding: Spacing.sm }]}>
          <Text style={[sheetStyles.flagName, { color: colors.text }]}>Haptic test panel</Text>

          {/* Test mode master switch */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagDesc, { color: colors.text }]}>Test mode</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Use mock distance on the follow screen instead of GPS</Text>
            </View>
            <Switch
              value={hapticTestEnabled}
              onValueChange={onToggleHapticTestEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* Mock distance slider — only visible when test mode is on */}
          {hapticTestEnabled && (
            <View style={{ gap: Spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[sheetStyles.flagDesc, { color: colors.text }]}>Mock distance</Text>
                <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 48, textAlign: 'right' }]}>
                  {hapticTestDistanceM} m
                </Text>
              </View>
              <DevSlider
                minimumValue={0}
                maximumValue={200}
                step={1}
                value={hapticTestDistanceM}
                onValueChange={(v) => onHapticTestDistanceMChange(v)}
                trackFillColor={colors.primary}
                trackEmptyColor={colors.border}
                accentColor={colors.primary}
                labelColor={colors.text}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>0 m</Text>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>200 m</Text>
              </View>
            </View>
          )}

          {/* One-shot test pulse button */}
          <Pressable
            onPress={() => fireTestPulse({
              distanceM: hapticTestDistanceM,
              startM: flags.hapticOffRouteStartM,
              maxM: flags.hapticOffRouteMaxM,
              minImpact: hapticMinImpact,
              maxImpact: hapticMaxImpact,
              slowIntervalMs: hapticSlowIntervalMs,
              fastIntervalMs: hapticFastIntervalMs,
            })}
            style={({ pressed }) => [{
              backgroundColor: pressed ? colors.primary + 'cc' : colors.primary,
              borderRadius: Radius.sm,
              paddingVertical: Spacing.xs,
              alignItems: 'center',
            }]}
          >
            <Text style={[sheetStyles.flagName, { color: '#fff' }]}>▶ Fire test pulse</Text>
          </Pressable>
        </View>

        {/* ── Map Features (Convex-backed) ── */}
        <SheetAccordion title="Map Features" icon="map-outline" colors={colors}>
          {/* 3D mode */}
          <View style={sheetStyles.flagRow}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>3D mode</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>
                Shows the map in a 45° isometric perspective.
              </Text>
            </View>
            <Switch
              value={mapFeatures.map3d}
              onValueChange={(v) => void onSetMapFeature('map3d', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* Compass overlay */}
          <View style={sheetStyles.flagRow}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Compass overlay</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>
                Shows a compass needle in the button strip. Tap to reset to north-up.
              </Text>
            </View>
            <Switch
              value={mapFeatures.mapCompass}
              onValueChange={(v) => void onSetMapFeature('mapCompass', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          {/* Location info panel */}
          <View style={sheetStyles.flagRow}>
            <View style={sheetStyles.flagLabel}>
              <Text style={[sheetStyles.flagName, { color: colors.text }]}>Location info panel</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>
                Floating overlay showing lat/lng, OS grid ref, and nearest postcode.
              </Text>
            </View>
            <Switch
              value={mapFeatures.mapLocationInfo}
              onValueChange={(v) => void onSetMapFeature('mapLocationInfo', v)}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </SheetAccordion>

        {/* ── 3D Camera (dynamic pitch) ── */}
        <SheetAccordion title="3D Camera" icon="videocam-outline" colors={colors}>
          <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={sheetStyles.flagLabel}>
                <Text style={[sheetStyles.flagName, { color: colors.text }]}>Pitch start zoom</Text>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Zoom level at which pitch starts increasing from the minimum</Text>
              </View>
              <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 32, textAlign: 'right' }]}>
                {cam3dMinZoom.toFixed(1)}
              </Text>
            </View>
            <DevSlider
              minimumValue={10}
              maximumValue={17}
              step={0.5}
              value={cam3dMinZoom}
              onValueChange={(v) => onCam3dMinZoomChange(Math.min(v, cam3dMaxZoom - 0.5))}
              trackFillColor={colors.primary}
              trackEmptyColor={colors.border}
              accentColor={colors.primary}
              labelColor={colors.text}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>10 (wide)</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>17 (close)</Text>
            </View>
          </View>

          <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={sheetStyles.flagLabel}>
                <Text style={[sheetStyles.flagName, { color: colors.text }]}>Pitch end zoom</Text>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Zoom level at which pitch reaches the maximum (first-person)</Text>
              </View>
              <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 32, textAlign: 'right' }]}>
                {cam3dMaxZoom.toFixed(1)}
              </Text>
            </View>
            <DevSlider
              minimumValue={11}
              maximumValue={21}
              step={0.5}
              value={cam3dMaxZoom}
              onValueChange={(v) => onCam3dMaxZoomChange(Math.max(v, cam3dMinZoom + 0.5))}
              trackFillColor={colors.primary}
              trackEmptyColor={colors.border}
              accentColor={colors.primary}
              labelColor={colors.text}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>11 (wide)</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>21 (street)</Text>
            </View>
          </View>

          <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={sheetStyles.flagLabel}>
                <Text style={[sheetStyles.flagName, { color: colors.text }]}>Min pitch</Text>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Camera angle when zoomed out (isometric end)</Text>
              </View>
              <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 40, textAlign: 'right' }]}>
                {cam3dMinPitch}°
              </Text>
            </View>
            <DevSlider
              minimumValue={10}
              maximumValue={60}
              step={5}
              value={cam3dMinPitch}
              onValueChange={(v) => onCam3dMinPitchChange(Math.min(v, cam3dMaxPitch - 5))}
              trackFillColor={colors.primary}
              trackEmptyColor={colors.border}
              accentColor={colors.primary}
              labelColor={colors.text}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>10° (flat)</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>60°</Text>
            </View>
          </View>

          <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={sheetStyles.flagLabel}>
                <Text style={[sheetStyles.flagName, { color: colors.text }]}>Max pitch</Text>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>Camera angle when zoomed in (first-person end)</Text>
              </View>
              <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 40, textAlign: 'right' }]}>
                {cam3dMaxPitch}°
              </Text>
            </View>
            <DevSlider
              minimumValue={30}
              maximumValue={85}
              step={5}
              value={cam3dMaxPitch}
              onValueChange={(v) => onCam3dMaxPitchChange(Math.max(v, cam3dMinPitch + 5))}
              trackFillColor={colors.primary}
              trackEmptyColor={colors.border}
              accentColor={colors.primary}
              labelColor={colors.text}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>30°</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>85° (FP)</Text>
            </View>
          </View>

          {/* Terrain exaggeration */}
          <View style={[sheetStyles.flagRow, { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.xs }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={sheetStyles.flagLabel}>
                <Text style={[sheetStyles.flagName, { color: colors.text }]}>Terrain exaggeration</Text>
                <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>How much elevation relief is amplified in 3D mode</Text>
              </View>
              <Text style={[sheetStyles.flagName, { color: colors.primary, minWidth: 40, textAlign: 'right' }]}>
                {terrainExaggeration.toFixed(1)}×
              </Text>
            </View>
            <DevSlider
              minimumValue={1}
              maximumValue={5}
              step={0.1}
              value={terrainExaggeration}
              onValueChange={onTerrainExaggerationChange}
              trackFillColor={colors.primary}
              trackEmptyColor={colors.border}
              accentColor={colors.primary}
              labelColor={colors.text}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>1.0× (real)</Text>
              <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>5.0× (dramatic)</Text>
            </View>
          </View>
        </SheetAccordion>

        {/* Route Colours — nested inside Dev Settings */}
        <View style={{ gap: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagName, { color: colors.text }]}>Route colours</Text>
            <Pressable onPress={resetColours} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: Typography.sizes.xs }}>Reset</Text>
            </Pressable>
          </View>
          <RouteColourPicker label="Positive (fast / descent)" colour={colours.positive} onChange={(hex) => setColour('positive', hex)} />
          <RouteColourPicker label="Neutral (flat / indeterminate)" colour={colours.neutral} onChange={(hex) => setColour('neutral', hex)} />
          <RouteColourPicker label="Negative (slow / ascent)" colour={colours.negative} onChange={(hex) => setColour('negative', hex)} />
        </View>
      </SheetAccordion>

      <Text style={[sheetStyles.version, { color: colors.textMuted }]}>v{appVersion}</Text>
      </BottomSheetScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Custom tab bar
// ---------------------------------------------------------------------------

function RecordTabButton({
  active,
  isRecording,
  isPaused,
  isWalkQueued,
  colors,
  onPress,
  onLongPress,
}: {
  active: boolean;
  isRecording: boolean;
  isPaused: boolean;
  isWalkQueued: boolean;
  colors: ColorPalette;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Start pulsing when recording, paused, or walk is queued.
  useEffect(() => {
    if ((isRecording && !isPaused) || isWalkQueued) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
    return undefined;
  }, [isRecording, isPaused, isWalkQueued, pulseAnim]);

  const active_ = active || isRecording || isPaused || isWalkQueued;
  const bgColor = (isRecording || isPaused)
    ? '#b91c1c'
    : isWalkQueued
    ? '#16a34a18'
    : active_
    ? colors.primary + '18'
    : 'transparent';
  const labelColor = (isRecording || isPaused)
    ? '#fff'
    : isWalkQueued
    ? '#16a34a'
    : active_
    ? colors.primary
    : colors.tabIconDefault;
  const label = isPaused
    ? 'Paused'
    : isRecording
    ? 'Recording'
    : isWalkQueued
    ? 'Walk Ready'
    : 'Record';

  return (
    <TouchableOpacity
      style={tabBarStyles.button}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      activeOpacity={0.7}
    >
      <View style={[tabBarStyles.pill, { backgroundColor: bgColor }]}>
        <Animated.View
          style={[
            tabBarStyles.recordDot,
            (isRecording || isPaused)
              ? { backgroundColor: '#fff', opacity: pulseAnim }
              : isWalkQueued
              ? { backgroundColor: '#16a34a', opacity: pulseAnim }
              : { backgroundColor: '#b91c1c' },
          ]}
        />
        <Text style={[tabBarStyles.label, { color: labelColor, fontFamily: Typography.fontMedium }]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TabBar({
  active,
  onPress,
  onRecordLongPress,
  colors,
  insets,
  isRecording,
  isPaused,
  isWalkQueued,
}: {
  active: SheetTab | null;
  onPress: (tab: SheetTab) => void;
  onRecordLongPress: () => void;
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  isRecording: boolean;
  isPaused: boolean;
  isWalkQueued: boolean;
}) {
  const sideTabs: { id: SheetTab; icon: string; label: string }[] = [
    { id: 'explore',  icon: 'safari',        label: 'Explore' },
    { id: 'plan',     icon: 'map',           label: 'Plan' },
  ];
  const rightTabs: { id: SheetTab; icon: string; label: string }[] = [
    { id: 'sessions', icon: 'list.bullet',   label: 'Sessions' },
    { id: 'profile',  icon: 'person.circle', label: 'Profile' },
  ];

  const renderTab = (tab: { id: SheetTab; icon: string; label: string }) => {
    const isActive = active === tab.id;
    const color = isActive ? colors.primary : colors.tabIconDefault;
    return (
      <TouchableOpacity
        key={tab.id}
        style={tabBarStyles.button}
        onPress={() => onPress(tab.id)}
        activeOpacity={0.7}
      >
        <View style={[
          tabBarStyles.pill,
          isActive && { backgroundColor: colors.primary + '18' },
        ]}>
          <IconSymbol size={22} name={tab.icon as any} color={color} />
          <Text style={[tabBarStyles.label, { color, fontFamily: Typography.fontMedium }]}>
            {tab.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        tabBarStyles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={tabBarStyles.buttons}>
        {sideTabs.map(renderTab)}
        <RecordTabButton
          active={active === 'record'}
          isRecording={isRecording}
          isPaused={isPaused}
          isWalkQueued={isWalkQueued}
          colors={colors}
          onPress={() => onPress('record')}
          onLongPress={onRecordLongPress}
        />
        {rightTabs.map(renderTab)}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3D dynamic-pitch helper
// ---------------------------------------------------------------------------

/**
 * Linearly interpolates a camera pitch from minPitch → maxPitch as the zoom
 * level moves from minZoom → maxZoom.  Values outside the range are clamped.
 */
function computePitch3d(
  zoom: number,
  minZoom: number,
  maxZoom: number,
  minPitch: number,
  maxPitch: number,
): number {
  if (zoom <= minZoom) return minPitch;
  if (zoom >= maxZoom) return maxPitch;
  const t = (zoom - minZoom) / (maxZoom - minZoom);
  return minPitch + t * (maxPitch - minPitch);
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const perms = useLocationPermission();
  const { state, pausedDurationMs, start, pause, resume, stop, reset } = useWalkSessionContext();
  const router = useRouter();

  // Live Broadcast toggle — kept in state for potential future use
  const [isLiveWalk] = useState(false);

  // Body weight from preferences (for live calorie estimate)
  const { preferences, setPreference } = useUserPreferences();

  // Mount the live-sync hook; it self-gates on isLive and phase.
  useLiveWalkSync();
  const { isReviewActive, reviewRoute, reviewPhotos, onPhotoTap, reviewOverlayOptions } = useReviewRoute();
  const { flags, setFlag } = useFeatureFlags();
  const { mapFeatures, setMapFeature } = useMapFeatures();
  const { queuedWalk, setQueuedWalk, clearQueuedWalk } = useQueuedWalk();
  // Prevents the auto-start from firing multiple times for the same GPS update burst.
  const autoStartFiredRef = useRef(false);

  const activeWalkId =
    state.phase === 'recording' || state.phase === 'paused' ? state.walkId : null;

  const { distanceMetres, paceSecsPerKm, lastAltitude, accuracy, pointCount, coordinates, elevationGainMetres, elevationLossMetres, lastSpeedMps, trackPoints, sessionPhotos } =
    useLiveStats(activeWalkId);

  const [currentLocation, setCurrentLocation] =
    useState<{ latitude: number; longitude: number } | null>(null);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [liveAltitude, setLiveAltitude] = useState<number | null>(null);

  // Planned route currently being followed (set when a walk starts from a queued route).
  const [followingRoute, setFollowingRoute] = useState<PlannedRoute | null>(null);
  const [followWalkedIdx, setFollowWalkedIdx] = useState(0);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [distToRouteM, setDistToRouteM] = useState<number | null>(null);
  // Haptic pulse engine — config is written by render, read by a stable interval.
  const hapticConfigRef = useRef<{ distM: number | null; startM: number; maxM: number; active: boolean }>({
    distM: null, startM: 20, maxM: 75, active: false,
  });
  const lastHapticTimeRef = useRef(0);

  // Follow-location toggle: when on, the camera re-centres on every position update.
  const [followLocation, setFollowLocation] = useState(true);
  const followLocationRef = useRef(true);
  followLocationRef.current = followLocation;
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const mapViewRef = useRef<MapboxGL.MapView>(null);

  // ── Map feature-flag derived state ───────────────────────────────────────
  // Current camera bearing, updated via onRegionDidChange for the compass overlay.
  const [mapBearing, setMapBearing] = useState(0);
  // Local active state for the two toggle buttons unlocked by their feature flags.
  // map3d flag enables the button; map3dActive tracks whether it's currently on.
  const [map3dActive, setMap3dActive] = useState(false);
  const map3dActiveRef = useRef(false);
  map3dActiveRef.current = map3dActive;
  // Current map zoom level — tracked from onRegionDidChange and used for dynamic 3D pitch.
  const [mapZoomLevel, setMapZoomLevel] = useState(15);
  const mapZoomLevelRef = useRef(15);
  mapZoomLevelRef.current = mapZoomLevel;
  // Current map center — updated on every camera frame so plan-walk can inherit the position.
  const mapCenterCoordRef = useRef<[number, number]>([0, 0]);
  // ── Planning overlay state ──────────────────────────────────────────────
  const [planningActive, setPlanningActive] = useState(false);
  const planningActiveRef = useRef(false);
  planningActiveRef.current = planningActive;
  const planWalk = usePlanWalk();
  const addWaypointRef = useRef(planWalk.addWaypoint);
  addWaypointRef.current = planWalk.addWaypoint;
  // Dynamic pitch parameters: pitch scales linearly from minPitch→maxPitch as zoom goes minZoom→maxZoom.
  const [cam3dMinZoom, setCam3dMinZoom] = useState(14);
  const [cam3dMaxZoom, setCam3dMaxZoom] = useState(18);
  const [cam3dMinPitch, setCam3dMinPitch] = useState(30);
  const [cam3dMaxPitch, setCam3dMaxPitch] = useState(75);
  const cam3dParamsRef = useRef({ minZoom: 14, maxZoom: 18, minPitch: 30, maxPitch: 75 });
  cam3dParamsRef.current = { minZoom: cam3dMinZoom, maxZoom: cam3dMaxZoom, minPitch: cam3dMinPitch, maxPitch: cam3dMaxPitch };
  // Terrain exaggeration — how much elevation is amplified when 3D is active.
  const [terrainExaggeration, setTerrainExaggeration] = useState(1.5);
  // mapLocationInfo flag enables the button; locationInfoVisible tracks whether the panel is open.
  const [locationInfoVisible, setLocationInfoVisible] = useState(false);
  // Screen-space position of the GPS dot — used to position the tooltip above it.
  const [tooltipScreenPos, setTooltipScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(90);
  // Reset active states when their feature flag is turned off.
  useEffect(() => { if (!mapFeatures.map3d) setMap3dActive(false); }, [mapFeatures.map3d]);
  useEffect(() => {
    if (!mapFeatures.mapLocationInfo) {
      setLocationInfoVisible(false);
      setTooltipScreenPos(null);
    }
  }, [mapFeatures.mapLocationInfo]);
  useEffect(() => { if (!locationInfoVisible) setTooltipScreenPos(null); }, [locationInfoVisible]);
  // Refresh tooltip screen position whenever the location or visibility changes.
  const refreshTooltipPos = useCallback(() => {
    if (!locationInfoVisible || !currentLocation || !mapViewRef.current) return;
    mapViewRef.current
      .getPointInView([currentLocation.longitude, currentLocation.latitude])
      .then(([x, y]) => setTooltipScreenPos({ x, y }))
      .catch(() => {});
  }, [locationInfoVisible, currentLocation]);
  // Store in a ref so onRegionDidChange (a stable closure) can always call the latest version.
  const refreshTooltipPosRef = useRef(refreshTooltipPos);
  refreshTooltipPosRef.current = refreshTooltipPos;
  useEffect(() => { refreshTooltipPos(); }, [refreshTooltipPos]);
  // Adjust camera pitch when the 3D button is toggled.
  // Uses the current zoom level to set an appropriate initial pitch.
  useEffect(() => {
    if (map3dActive) {
      const { minZoom, maxZoom, minPitch, maxPitch } = cam3dParamsRef.current;
      const pitch = computePitch3d(mapZoomLevelRef.current, minZoom, maxZoom, minPitch, maxPitch);
      cameraRef.current?.setCamera({ pitch, animationDuration: 500 });
    } else {
      cameraRef.current?.setCamera({ pitch: 0, animationDuration: 500 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map3dActive]);

  // Sheet state
  const [activeSheet, setActiveSheet] = useState<SheetTab | null>(null);
  // Ref so the location-watcher closure (which only re-runs when perms change)
  // can always read the latest value without going stale.
  const activeSheetRef = useRef<SheetTab | null>(null);
  activeSheetRef.current = activeSheet;

  // ── Explore tab state ────────────────────────────────────────────────────
  const [exploreViewBounds, setExploreViewBounds] = useState<ExploreViewBounds | null>(null);
  const [exploreZoom, setExploreZoom] = useState(12);
  /** Route highlighted in the list and on the map (first tap). */
  const [exploreHighlightedRoute, setExploreHighlightedRoute] = useState<PlannedRoute | null>(null);
  /** Route whose detail panel is shown (second tap). */
  const [exploreDetailRoute, setExploreDetailRoute] = useState<PlannedRoute | null>(null);
  /** Routes in a tapped proximity group (≤ 50 m apart). */
  const [exploreGroupedRoutes, setExploreGroupedRoutes] = useState<PlannedRoute[] | null>(null);
  /**
   * Resolved routes from ExploreSheetContent — shared with ExploreMapLayer so
   * both components use a single Convex subscription instead of two.
   */
  const [exploreRoutes, setExploreRoutes] = useState<PlannedRoute[]>([]);
  // Debounce timer: bounds (and therefore Convex queries) only update after
  // the camera has been still for 700 ms.  Zoom updates immediately because
  // it drives JS-only clustering (no server request).
  const exploreBoundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<BottomSheet>(null);

  // Tracks which sheet was open before navigating to a walk review so we can
  // restore it when the transparentModal is dismissed.
  const reviewEntrySheetRef = useRef<SheetTab | null>(null);

  // When isReviewActive drops back to false the walk-summary modal has closed
  // — reopen whichever sheet was showing before we navigated in.
  const prevIsReviewActive = useRef(false);
  useEffect(() => {
    if (!isReviewActive && prevIsReviewActive.current && reviewEntrySheetRef.current !== null) {
      const tabToRestore = reviewEntrySheetRef.current;
      reviewEntrySheetRef.current = null;
      // Brief delay lets the modal dismiss animation finish first.
      setTimeout(() => {
        setActiveSheet(tabToRestore);
        scheduleSnap(0);
      }, 350);
    }
    prevIsReviewActive.current = isReviewActive;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewActive]);

  // Cancel-then-schedule pattern: always clear any pending snap before
  // scheduling a new one so rapid taps can never stack concurrent
  // snapToIndex calls. 150 ms is well beyond the time React needs to commit
  // the new snapPoints prop and Reanimated needs to dispatch it to the UI
  // thread, so the index is always in-bounds when the call fires.
  const pendingSnapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When opening the record sheet while it is currently closed, we must snap
  // to index 0 first (safe regardless of snap-point array length) and then,
  // once onChange confirms the sheet has settled, snap to the true target.
  // This prevents the "index out of range" crash that occurs when snapToIndex(3)
  // fires before Gorhom's UI-thread worklet has processed the new 4-element
  // snapPoints array.
  const pendingFinalSnapRef = useRef<number | null>(null);

  const scheduleSnap = (idx: number) => {
    if (pendingSnapRef.current !== null) clearTimeout(pendingSnapRef.current);
    pendingSnapRef.current = setTimeout(() => {
      pendingSnapRef.current = null;
      sheetRef.current?.snapToIndex(idx);
    }, 150);
  };

  // When we close the sheet programmatically we must suppress the resulting
  // onChange(-1) so it doesn't overwrite a subsequent setActiveSheet call
  // that was queued at the same time (e.g. close then immediately reopen).
  const ignoreNextCloseRef = useRef(false);

  useEffect(() => {
    if (perms.foreground !== 'granted') return;
    const sub = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (loc.coords.accuracy != null) setLiveAccuracy(loc.coords.accuracy);
        if (loc.coords.altitude != null) setLiveAltitude(loc.coords.altitude);

        // Move camera if follow mode is active, no review is open,
        // and the user is not browsing the explore tab (they may have
        // panned to a different area deliberately).
        if (followLocationRef.current && !isReviewActive && activeSheetRef.current !== 'explore' && activeSheetRef.current !== 'queued-walk') {
          cameraRef.current?.setCamera({
            centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
            animationDuration: 500,
          });
        }
      },
    );
    return () => { void sub.then((s) => s.remove()); };
  }, [perms.foreground]);

  // When following a planned route, update the walked index and off-route state
  // on every position fix.
  const OFF_ROUTE_THRESHOLD_M = 75;
  useEffect(() => {
    if (!followingRoute || !currentLocation) return;
    const allPts = followingRoute.legs.flatMap((l) => l.points);
    const flatCoords = allPts.map((p): [number, number] => [p.lng, p.lat]);
    if (flatCoords.length < 2) return;
    const { latitude: lat, longitude: lng } = currentLocation;
    // Find the nearest segment (not just nearest point) for accurate distance.
    // Project the user position onto each AB segment in lat/lng space, clamp to
    // [0,1], then haversine to that closest point on the segment.
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < flatCoords.length - 1; i++) {
      const [lng1, lat1] = flatCoords[i]!;
      const [lng2, lat2] = flatCoords[i + 1]!;
      const dx = lat2 - lat1;
      const dy = lng2 - lng1;
      const lenSq = dx * dx + dy * dy;
      let cLat: number, cLng: number;
      if (lenSq === 0) {
        cLat = lat1; cLng = lng1;
      } else {
        const t = Math.max(0, Math.min(1, ((lat - lat1) * dx + (lng - lng1) * dy) / lenSq));
        cLat = lat1 + t * dx;
        cLng = lng1 + t * dy;
      }
      const d = haversineMetres(lat, lng, cLat, cLng);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    setFollowWalkedIdx(nearestIdx);
    const offRoute = minDist > OFF_ROUTE_THRESHOLD_M;
    setDistToRouteM(minDist === Infinity ? null : minDist);
    setIsOffRoute(offRoute);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, followingRoute]);

  // Clear follow state when the walk finishes.
  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'completed' || state.phase === 'completing') {
      setFollowingRoute(null);
      setFollowWalkedIdx(0);
      setIsOffRoute(false);
      setDistToRouteM(null);
    }
  }, [state.phase]);

  // Auto-open record sheet when recording starts
  const isActive = state.phase === 'recording' || state.phase === 'paused';

  // ── Off-route haptic pulse engine ────────────────────────────────────────
  // Keep the config ref in sync on every render so the stable interval always
  // reads fresh values without being recreated (avoids restarting the timer
  // on every GPS fix which would prevent slow pulses from ever firing).
  hapticConfigRef.current = {
    distM: distToRouteM,
    startM: flags.hapticOffRouteStartM,
    maxM: flags.hapticOffRouteMaxM,
    active: !!(followingRoute && isActive && flags.hapticOffRouteEnabled),
  };

  // Stable 300 ms tick — set up once on mount, reads config via ref each tick.
  useEffect(() => {
    const id = setInterval(() => {
      const { distM, startM, maxM, active } = hapticConfigRef.current;
      if (!active || distM === null || distM <= startM) return;
      // t = 0 at the start threshold, 1 at the max-urgency threshold
      const t = Math.min(1, (distM - startM) / Math.max(1, maxM - startM));
      // Pulse interval: 3 000 ms (gentle) → 500 ms (urgent)
      const intervalMs = Math.round(3000 - t * 2500);
      const now = Date.now();
      if (now - lastHapticTimeRef.current < intervalMs) return;
      lastHapticTimeRef.current = now;
      const style =
        t < 1 / 3 ? Haptics.ImpactFeedbackStyle.Light
        : t < 2 / 3 ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
      void Haptics.impactAsync(style);
    }, 300);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Queued walk auto-start ──────────────────────────────────────────────
  // useEffect approach: all deps are listed explicitly so there is no
  // stale-closure risk (unlike the watchPositionAsync callback pattern).
  useEffect(() => {
    // Block only while a walk is actively recording or paused — allow when
    // idle OR completed (a previous walk may have been completed without reset).
    if (!queuedWalk || isActive || !currentLocation || autoStartFiredRef.current) return;
    if (
      isWithinStartThreshold(
        currentLocation.latitude,
        currentLocation.longitude,
        queuedWalk,
        flags.startProximityThresholdM,
      )
    ) {
      autoStartFiredRef.current = true;
      const routeToFollow = queuedWalk;
      clearQueuedWalk();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // If a previous walk was completed but not yet reset, clear it first so
      // start() begins from a clean idle state.
      if (state.phase === 'completed') reset();
      void start().then(() => {
        setFollowingRoute(routeToFollow);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation, queuedWalk, isActive, flags.startProximityThresholdM]);

  // Reset the one-shot guard whenever the queued walk is cleared.
  useEffect(() => {
    if (!queuedWalk) autoStartFiredRef.current = false;
  }, [queuedWalk]);

  const walkStartedAt =
    state.phase === 'recording' || state.phase === 'paused' ? state.startedAt : null;
  const { steps: stepCount, source: stepSource } = useStepCounter(isActive, walkStartedAt, flags.forcePedometerSteps);
  const stepCountRef = useRef(0);
  stepCountRef.current = stepCount;

  // Detect software navigation bar height so snap points account for the
  // space it steals. Two cases:
  //   1. Older Android (non-edge-to-edge): window.height < screen.height because
  //      the nav bar sits below the app window; insets.bottom is typically 0.
  //   2. Edge-to-edge Android: window covers the full screen; insets.bottom > 0
  //      reports how much the nav bar overlaps app content.
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const statusBarHeight = Constants.statusBarHeight ?? 0;
  const nonEdgeNavBar = Math.max(0, screenHeight - windowHeight - statusBarHeight);
  const bottomNavHeight = nonEdgeNavBar > 0 ? nonEdgeNavBar : insets.bottom;
  // Convert to percentage of window height (rounded up to avoid cutting off by 1px).
  // Add an extra 2% padding when software nav buttons are present so the sheet
  // content clears the button bar with a comfortable margin.
  const navAdjPctRaw = windowHeight > 0 ? Math.ceil((bottomNavHeight / windowHeight) * 100) -2 : 0;
  const navAdjPct = navAdjPctRaw > 0 ? navAdjPctRaw +2 : 0;

  // Snap points per sheet.
  // Record idle: single point (prevents unwanted drag-snapping on the welcome card)
  // Record active: multiple latches for peeking vs full stats
  // Profile: single point
  const snapPoints = useMemo(() => {
    const adj = (n: number) => `${n + navAdjPct}%`;
    if (activeSheet === 'profile') return [adj(92)];
    if (activeSheet === 'sessions') return [adj(92)];
    if (activeSheet === 'queued-walk') return [adj(50)];
    if (activeSheet === 'explore') {
      // Two snap points: a map-peek height and a full-list height.
      // Opening at the top snap means BottomSheetScrollView scrolls freely;
      // the user drags the handle down to expose more map.
      return [adj(45), adj(92)];
    }
    if (activeSheet === 'record' && isActive) return [adj(23), adj(33), adj(50), adj(70), adj(92)];
    return [adj(62)]; // record idle at same height as active index 3 — no jump on recording start
  }, [activeSheet, isActive, navAdjPct]);

  // Gorhom v5: the first snapToIndex call is silently dropped unless close() has
  // been called at least once (it initialises the internal Reanimated state).
  // Pre-warm on mount so the very first tab tap works.
  useEffect(() => {
    sheetRef.current?.close();
  }, []);

  // Close the sheet as soon as the walk starts completing so the review screen
  // is fully visible when it navigates in.
  useEffect(() => {
    if (state.phase === 'completing' || state.phase === 'completed') {
      if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
      ignoreNextCloseRef.current = true;
      sheetRef.current?.close();
      setActiveSheet(null);
    }
  }, [state.phase]);

  const prevIsActive = useRef(false);
  useEffect(() => {
    if (isActive && !prevIsActive.current) {
      // Cancel any pending snap timer so it can't collapse the sheet
      // after we've already snapped to the correct expanded position.
      if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
      setActiveSheet('record');
      // When snap points grow from 1 item to 4 items, Gorhom remaps the current
      // index (0 → 23%) causing the sheet to collapse. Calling snapToPosition
      // with the absolute percentage is index-immune and fires immediately with
      // no animation blip.
      sheetRef.current?.snapToPosition(`${70 + navAdjPct}%`);
    }
    prevIsActive.current = isActive;
  }, [isActive, navAdjPct]);

  // Listen for external open requests (e.g. recording indicator bar tap)
  useEffect(() => {
    return sheetEvents.subscribe((sheet) => {
      const targetIdx = sheet === 'record' && isActive ? 3 : 0;
      setActiveSheet(sheet);
      if (targetIdx > 0) {
        // Sheet is closed — open to 0 first (always safe), then once settled
        // fire the real target via pendingFinalSnapRef in onChange.
        pendingFinalSnapRef.current = targetIdx;
        scheduleSnap(0);
      } else {
        scheduleSnap(0);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleTabPress = (tab: SheetTab) => {
    if (tab === 'explore') {
      if (activeSheet === 'explore') {
        if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
        pendingFinalSnapRef.current = null;
        ignoreNextCloseRef.current = true;
        setActiveSheet(null);
        sheetRef.current?.close();
      } else {
        setActiveSheet('explore');
        setExploreHighlightedRoute(null);
        setExploreDetailRoute(null);
        setExploreGroupedRoutes(null);
        // Clear any camera edge-inset padding set by a previous sheet (e.g. Sessions
        // at 92%). Mapbox persists edge insets between commands, so without this reset
        // a subsequent fitBounds call compounds the old inset with its own padding,
        // pushing the route bounds off-screen.
        cameraRef.current?.setCamera({
          padding: { paddingBottom: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
          animationDuration: 0,
        });
        // Seed initial bounds from current location so Convex query fires immediately
        if (currentLocation) {
          setExploreViewBounds({
            minLat: currentLocation.latitude - 0.05,
            maxLat: currentLocation.latitude + 0.05,
            minLng: currentLocation.longitude - 0.05,
            maxLng: currentLocation.longitude + 0.05,
          });
        }
        scheduleSnap(0); // open at 45% peek — user can drag handle up for more
      }
      return;
    }

    // Plan tab — activate the in-place planning overlay (no navigation = no map reload).
    if (tab === 'plan') {
      // Close any other open sheet first.
      setActiveSheet(null);
      sheetRef.current?.close();
      setPlanningActive(true);
      return;
    }

    // Sessions tab — open as bottom sheet overlay
    if (tab === 'sessions') {
      if (activeSheet === 'sessions') {
        if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
        pendingFinalSnapRef.current = null;
        ignoreNextCloseRef.current = true;
        setActiveSheet(null);
        sheetRef.current?.close();
      } else {
        setActiveSheet('sessions');
        scheduleSnap(0);
      }
      return;
    }

    if (tab === 'record') {
      // When a walk is queued but not yet recording: tapping "Walk Ready" opens
      // the Explore sheet showing that route's detail so the user can cancel.
      if (queuedWalk !== null && !isActive) {
        // Toggle: if the queued-walk sheet is already open, close it.
        if (activeSheet === 'queued-walk') {
          if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
          pendingFinalSnapRef.current = null;
          ignoreNextCloseRef.current = true;
          setActiveSheet(null);
          sheetRef.current?.close();
          return;
        }
        // Open the queued-walk detail sheet and fit the camera to the route.
        setActiveSheet('queued-walk');
        cameraRef.current?.setCamera({
          padding: { paddingBottom: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
          animationDuration: 0,
        });
        const allPts = queuedWalk.legs.flatMap((l) => l.points);
        if (allPts.length > 0) {
          const lats = allPts.map((p) => p.lat);
          const lngs = allPts.map((p) => p.lng);
          const sheetPx = windowHeight * 0.5;
          cameraRef.current?.fitBounds(
            [Math.max(...lngs), Math.max(...lats)],
            [Math.min(...lngs), Math.min(...lats)],
            [insets.top + 80, 40, sheetPx + 20, 40],
            600,
          );
        }
        scheduleSnap(0);
        return;
      }

      if ((state.phase === 'idle' || state.phase === 'completed') && perms.foreground === 'granted') {
        // Ensure we're fully reset before prompting to start again
        if (state.phase === 'completed') reset();

        const startRecording = () => {
          void start({ isLive: isLiveWalk });
          // Open the sheet at snap 0; the isActive useEffect will expand
          // snap points and snap to the correct position once recording begins.
          setActiveSheet('record');
          scheduleSnap(0);
        };

        // Scan local cache for routes whose start point is within 50 m.
        const nearby = currentLocation
          ? findNearbyRoutes(currentLocation.latitude, currentLocation.longitude, 50)
          : [];

        if (nearby.length === 1) {
          // Exactly one nearby route — offer to follow it directly.
          const nearbyRoute = nearby[0]!;
          Alert.alert(
            'Nearby route detected',
            `"${nearbyRoute.title}" starts near your location.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Record my route', onPress: startRecording },
              {
                text: 'Follow route',
                onPress: () => {
                  // Open the explore sheet directly on this route's detail panel.
                  setExploreHighlightedRoute(nearbyRoute);
                  setExploreDetailRoute(nearbyRoute);
                  setActiveSheet('explore');
                  scheduleSnap(0);
                },
              },
            ],
          );
        } else if (nearby.length > 1) {
          // Multiple nearby routes — let the user pick from the explore sheet.
          Alert.alert(
            'Nearby routes detected',
            `${nearby.length} saved routes start near your location.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Record my route', onPress: startRecording },
              {
                text: 'Pick route',
                onPress: () => {
                  // Open the explore sheet centred on the user so nearby routes
                  // appear naturally in the list.
                  setActiveSheet('explore');
                  scheduleSnap(0);
                  if (currentLocation) {
                    cameraRef.current?.setCamera({
                      centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
                      zoomLevel: 15.5,
                      animationDuration: 400,
                    });
                  }
                },
              },
            ],
          );
        } else {
          // No nearby routes — standard confirmation.
          Alert.alert(
            'Start recording?',
            'Your walk will be tracked and saved.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Start', onPress: startRecording },
            ],
          );
        }
        return;
      }
      // Already recording/paused — just toggle the sheet as normal.
    }

    const targetIdx = tab === 'record' && isActive ? 3 : 0;
    if (activeSheet === tab) {
      if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
      pendingFinalSnapRef.current = null;
      ignoreNextCloseRef.current = true;
      setActiveSheet(null);
      sheetRef.current?.close();
    } else {
      setActiveSheet(tab);
      if (targetIdx > 0) {
        pendingFinalSnapRef.current = targetIdx;
        scheduleSnap(0);
      } else {
        scheduleSnap(0);
      }
    }
  };


  const isRecording = state.phase === 'recording' || state.phase === 'paused';
  const displayAccuracy = accuracy ?? liveAccuracy;
  const displayAltitude = lastAltitude ?? liveAltitude;
  const needsForeground = perms.loaded && perms.foreground !== 'granted';
  const needsBackground =
    perms.loaded && perms.foreground === 'granted' && perms.background !== 'granted';

  // Track the sheet's settled snap index so we can compute camera bottom padding.
  const [sheetSnapIndex, setSheetSnapIndex] = useState<number>(-1);

  // Re-centre camera on current location whenever the sheet snap changes,
  // offsetting the map centre upward by half the sheet height so the position
  // dot sits in the middle of the visible map strip above the sheet.
  //
  // Exception — explore mode: never snap back to the user's GPS position.
  //   • Route selected → re-fit its bounds with the updated sheet padding so
  //     the route stays centred in the visible area above the sheet.
  //   • No route selected → do nothing (preserve the user's browsed viewport).
  useEffect(() => {
    if (!currentLocation || isReviewActive) return;

    if (activeSheetRef.current === 'explore') {
      if (exploreHighlightedRoute) {
        const allPts = exploreHighlightedRoute.legs.flatMap((l) => l.points);
        if (allPts.length > 0) {
          const lats = allPts.map((p) => p.lat);
          const lngs = allPts.map((p) => p.lng);
          const sheetHeightPct = sheetSnapIndex >= 0 && snapPoints[sheetSnapIndex]
            ? parseFloat(String(snapPoints[sheetSnapIndex])) / 100
            : 0;
          const sheetPx = windowHeight * sheetHeightPct;
          // Clear persisted edge insets before fitting so they don't compound.
          cameraRef.current?.setCamera({
            padding: { paddingBottom: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
            animationDuration: 0,
          });
          cameraRef.current?.fitBounds(
            [Math.max(...lngs), Math.max(...lats)],
            [Math.min(...lngs), Math.min(...lats)],
            [insets.top + 80, 40, sheetPx + 20, 40],
            300,
          );
        }
      }
      return;
    }

    // Queued-walk sheet: re-fit to the queued route whenever the snap settles.
    if (activeSheetRef.current === 'queued-walk' && queuedWalk) {
      const allPts = queuedWalk.legs.flatMap((l) => l.points);
      if (allPts.length > 0) {
        const lats = allPts.map((p) => p.lat);
        const lngs = allPts.map((p) => p.lng);
        const sheetHeightPct = sheetSnapIndex >= 0 && snapPoints[sheetSnapIndex]
          ? parseFloat(String(snapPoints[sheetSnapIndex])) / 100
          : 0;
        const sheetPx = windowHeight * sheetHeightPct;
        cameraRef.current?.setCamera({
          padding: { paddingBottom: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
          animationDuration: 0,
        });
        cameraRef.current?.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          [insets.top + 80, 40, sheetPx + 20, 40],
          300,
        );
      }
      return;
    }

    const sheetHeightPct = sheetSnapIndex >= 0 && snapPoints[sheetSnapIndex]
      ? parseFloat(String(snapPoints[sheetSnapIndex])) / 100
      : 0;
    const sheetPx = windowHeight * sheetHeightPct;
    cameraRef.current?.setCamera({
      centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
      zoomLevel: 15,
      padding: { paddingBottom: sheetPx, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
      animationDuration: 300,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetSnapIndex]);

  // ── Smart back-button handler ────────────────────────────────────────────
  // Registered here (later than _layout.tsx) so it fires first.
  const { signOut: signOutMain } = useAuth();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // 1. Panel open → close it (same as tapping the active tab again)
      if (activeSheet !== null) {
        if (pendingSnapRef.current !== null) {
          clearTimeout(pendingSnapRef.current);
          pendingSnapRef.current = null;
        }
        pendingFinalSnapRef.current = null;
        ignoreNextCloseRef.current = true;
        setActiveSheet(null);
        sheetRef.current?.close();
        return true;
      }

      // 2. Recording active, no panel → offer to stop
      if (state.phase === 'recording' || state.phase === 'paused') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
          'Recording in progress',
          'Do you want to stop and save your current walk?',
          [
            { text: 'Keep Going', style: 'cancel' },
            {
              text: 'Stop & Save',
              style: 'destructive',
              onPress: () => { void stop(stepCountRef.current); },
            },
          ],
        );
        return true;
      }

      // 3. Map visible, idle → offer sign-out
      Alert.alert(
        'Sign Out',
        'Do you want to sign out?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', style: 'destructive', onPress: () => { void signOutMain(); } },
        ],
      );
      return true;
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheet, state.phase, signOutMain]);
  // ────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapboxGL.MapView
        ref={mapViewRef}
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        onTouchStart={() => setFollowLocation(false)}
        onPress={(feature: any) => {
          if (!planningActiveRef.current) return;
          const coords = feature?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            addWaypointRef.current(coords[1] as number, coords[0] as number);
          }
        }}
        onCameraChanged={(state: any) => {
          // Update bearing on every camera frame so the compass needle tracks rotation in real time.
          const heading = state?.properties?.heading;
          if (heading !== undefined) setMapBearing(heading as number);
          // Track center so plan-walk can open at the same position.
          const center = state?.properties?.center as [number, number] | undefined;
          if (center) mapCenterCoordRef.current = center;
        }}
        onRegionDidChange={(event: any) => {
          const props = event?.properties;
          // Reposition the location info tooltip after the camera settles.
          void refreshTooltipPosRef.current();
          // Track zoom and update 3D pitch dynamically (works regardless of which sheet is open).
          if (props?.zoomLevel !== undefined) {
            const zoom = props.zoomLevel as number;
            setMapZoomLevel(zoom);
            if (map3dActiveRef.current) {
              const { minZoom, maxZoom, minPitch, maxPitch } = cam3dParamsRef.current;
              cameraRef.current?.setCamera({
                pitch: computePitch3d(zoom, minZoom, maxZoom, minPitch, maxPitch),
                animationDuration: 300,
              });
            }
          }
          // Only update explore bounds while the explore sheet is open.
          if (activeSheetRef.current !== 'explore') return;
          if (!props?.visibleBounds || props?.zoomLevel === undefined) return;
          const [[neLng, neLat], [swLng, swLat]] = props.visibleBounds as [[number, number], [number, number]];
          // Zoom drives JS clustering — only update when it crosses a cluster
          // threshold (9 / 10 / 11 / 12) so that Mapbox floating-point drift
          // (e.g. 12.0001 → 11.9999) never triggers a re-render, which would
          // cause the native bridge to fire onRegionDidChange again in a loop.
          const newZoom = props.zoomLevel as number;
          setExploreZoom(prev => {
            const bucket = (z: number) => z < 9 ? 0 : z < 10 ? 1 : z < 11 ? 2 : z < 12 ? 3 : 4;
            return bucket(newZoom) !== bucket(prev) ? newZoom : prev;
          });
          // Bounds drive Convex queries — debounce AND guard against micro-drift
          // so we only re-subscribe when the viewport meaningfully changed.
          if (exploreBoundsDebounceRef.current) clearTimeout(exploreBoundsDebounceRef.current);
          exploreBoundsDebounceRef.current = setTimeout(() => {
            exploreBoundsDebounceRef.current = null;
            setExploreViewBounds(prev => {
              if (
                prev &&
                Math.abs(prev.minLat - swLat) < 0.0001 &&
                Math.abs(prev.maxLat - neLat) < 0.0001 &&
                Math.abs(prev.minLng - swLng) < 0.0001 &&
                Math.abs(prev.maxLng - neLng) < 0.0001
              ) {
                return prev;
              }
              return { minLat: swLat, maxLat: neLat, minLng: swLng, maxLng: neLng };
            });
          }, 700);
        }}
      >
        {/* Camera: managed imperatively via cameraRef when follow mode is on.
            defaultSettings is only applied on mount (not reactive), so updates
            to currentLocation do NOT move the camera — all movement is driven
            by explicit setCamera() calls in the watchPositionAsync callback,
            which respect the followLocation toggle. */}
        {!isReviewActive && (
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: currentLocation
                ? [currentLocation.longitude, currentLocation.latitude]
                : [-0.1276, 51.5074],
              zoomLevel: currentLocation ? 15 : 10,
            }}
            animationMode="none"
          />
        )}
        <LivePositionLayer
          coordinates={isReviewActive ? [] : coordinates}
          showUserLocation={perms.foreground === 'granted'}
        />
        {/* Queued walk — dashed line overlay */}
        {queuedWalk !== null && !isReviewActive && (
          <QueuedRouteLayer route={queuedWalk} />
        )}

        {/* Follow-route overlay — planned route + walked portion */}
        {followingRoute !== null && isActive && !isReviewActive && (
          <FollowRouteLayer
            route={followingRoute}
            walkedPointIndex={followWalkedIdx}
            showCamera={false}
          />
        )}

        {/* Explore route pins + selected route line */}
        {activeSheet === 'explore' && (
          <ExploreMapLayer
            routes={exploreRoutes}
            viewBounds={exploreViewBounds}
            zoom={exploreZoom}
            highlightedRoute={exploreHighlightedRoute}
            onSelectRoute={(route) => {
              if (exploreHighlightedRoute?._id === route._id) {
                // Tap highlighted pin → show detail
                setExploreDetailRoute(route);
              } else {
                // Tap new pin → highlight + fly
                setExploreHighlightedRoute(route);
                setExploreDetailRoute(null);
                const allPts = route.legs.flatMap((l) => l.points);
                if (allPts.length > 0) {
                  const lats = allPts.map((p) => p.lat);
                  const lngs = allPts.map((p) => p.lng);
                  const sheetPx = windowHeight * 0.45;
                  cameraRef.current?.setCamera({
                    padding: { paddingBottom: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
                    animationDuration: 0,
                  });
                  cameraRef.current?.fitBounds(
                    [Math.max(...lngs), Math.max(...lats)],
                    [Math.min(...lngs), Math.min(...lats)],
                    [insets.top + 80, 40, sheetPx + 20, 40],
                    600,
                  );
                }
              }
            }}
            onClusterZoom={(lat, lng, newZoom) => {
              cameraRef.current?.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: newZoom,
                animationDuration: 400,
              });
            }}
            onGroupSelect={(routes) => {
              setExploreGroupedRoutes(routes);
              setExploreHighlightedRoute(null);
              setExploreDetailRoute(null);
            }}
          />
        )}

        {/* Review route — shown while walk-summary transparentModal is open on top */}
        {isReviewActive && (
          <ReviewRouteLayer
            points={reviewRoute}
            photos={reviewPhotos}
            {...(onPhotoTap ? { onPhotoTap } : {})}
            cameraPaddingBottom={reviewOverlayOptions.cameraPaddingBottom}
            cameraPaddingTop={reviewOverlayOptions.cameraPaddingTop}
            showPhotoMarkers={reviewOverlayOptions.showPhotoMarkers}
            focusCoordinate={reviewOverlayOptions.focusCoordinate}
            {...(reviewOverlayOptions.onPhotoLongPress ? { onPhotoLongPress: reviewOverlayOptions.onPhotoLongPress } : {})}
            mode={reviewOverlayOptions.mode}
            {...(reviewOverlayOptions.colours ? { colours: reviewOverlayOptions.colours } : {})}
          />
        )}
        {/* Planning route layer — rendered when planning mode is active */}
        {planningActive && <PlanRouteLayer legs={planWalk.legs} />}
        {/* Terrain DEM — active only when 3D mode is on */}
        {map3dActive && (
          <>
            <MapboxGL.RasterDemSource
              id="mapbox-dem"
              url="mapbox://mapbox.mapbox-terrain-dem-v1"
              tileSize={512}
              maxZoomLevel={14}
            />
            <MapboxGL.Terrain
              sourceID="mapbox-dem"
              style={{ exaggeration: terrainExaggeration }}
            />
          </>
        )}
      </MapboxGL.MapView>

      {/* Planning overlay — header + bottom sheet, no separate MapView so no tile reload */}
      {planningActive && (
        <PlanOverlay
          planning={planWalk}
          onClose={() => {
            planWalk.resetToEmpty();
            setPlanningActive(false);
          }}
        />
      )}

      {/* Recording status badge (with inline GPS signal) — top-centre map overlay */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <RecordingStatusBadge
            status={state.phase}
            accuracyMetres={displayAccuracy}
            {...(followingRoute ? { routeTitle: followingRoute.title } : {})}
            onPress={() => sheetEvents.open('record')}
          />
          {followingRoute !== null && distToRouteM !== null && (
            <View style={{ marginTop: Spacing.xs }}>
              <RouteProximityBadge distanceM={distToRouteM} />
            </View>
          )}
        </View>
      )}

      {/* Completing overlay */}
      {state.phase === 'completing' && (
        <View style={styles.overlay}>
          <View style={[styles.completingCard, { backgroundColor: colors.backgroundCard }]}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.completingText, { color: colors.text }]}>
              Processing your walk...
            </Text>
          </View>
        </View>
      )}

      {/* Permission gates */}
      {needsForeground && (
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <View style={[styles.permissionCard, { paddingTop: insets.top + Spacing.lg }]}>
            <PermissionGate type="foreground" onGranted={() => perms.requestForeground()} />
          </View>
        </View>
      )}
      {needsBackground && !needsForeground && (
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <View style={[styles.permissionCard, { paddingTop: insets.top + Spacing.lg }]}>
            <PermissionGate type="background" onGranted={() => perms.requestBackground()} />
          </View>
        </View>
      )}

      {/* Bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        index={-1}
        enableDynamicSizing={false}
        enablePanDownToClose
        enableContentPanningGesture={activeSheet !== 'explore' && activeSheet !== 'queued-walk'}
        backgroundStyle={{ backgroundColor: 'transparent' }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        onChange={(index) => {
          setSheetSnapIndex(index);
          if (index === -1) {
            // Always cancel pending snap timers on close to prevent out-of-range crashes.
            if (pendingSnapRef.current !== null) { clearTimeout(pendingSnapRef.current); pendingSnapRef.current = null; }
            pendingFinalSnapRef.current = null;
            if (ignoreNextCloseRef.current) {
              ignoreNextCloseRef.current = false;
            } else {
              // User dragged the sheet closed.
              setActiveSheet(null);
            }
          } else if (pendingFinalSnapRef.current !== null) {
            const finalIdx = pendingFinalSnapRef.current;
            pendingFinalSnapRef.current = null;
            // Cancel any pending fallback timer — we're handling it now.
            if (pendingSnapRef.current !== null) {
              clearTimeout(pendingSnapRef.current);
              pendingSnapRef.current = null;
            }
            if (index !== finalIdx) {
              // Sheet settled somewhere other than the target — correct it.
              sheetRef.current?.snapToIndex(finalIdx);
            }
            // If index === finalIdx, sheet is already where we want it — done.
          }
        }}
      >
        {activeSheet === 'sessions' && (
          <SessionsSheetContent
            isOpen={activeSheet === 'sessions'}
            onOpenWalk={(walkId) => {
              reviewEntrySheetRef.current = 'sessions';
              ignoreNextCloseRef.current = true;
              sheetRef.current?.close();
              setActiveSheet(null);
              router.push({ pathname: '/walk-summary', params: { walkId } });
            }}
          />
        )}
        {activeSheet === 'record' && (
          <RecordSheetContent
            colors={colors}
            insets={insets}
            state={state}
            pausedDurationMs={pausedDurationMs}
            distanceMetres={distanceMetres}
            paceSecsPerKm={paceSecsPerKm}
            displayAltitude={displayAltitude}
            pointCount={pointCount}
            stepCount={stepCount}
            stepSource={stepSource}
            currentLocation={currentLocation}
            elevationGainMetres={elevationGainMetres}
            elevationLossMetres={elevationLossMetres}
            lastSpeedMps={lastSpeedMps}
            trackPoints={trackPoints}
            sessionPhotos={sessionPhotos}
            bodyWeightKg={preferences.bodyWeightKg}
            onSetBodyWeight={(kg) => setPreference('bodyWeightKg', kg)}
            statPanelOrder={(() => {
              const saved = preferences.statPanelOrder ?? [...DEFAULT_STAT_PANEL_ORDER];
              // Migrate: ensure 'elevation' panel is present in stored orders
              return saved.includes('elevation') ? saved : [...saved, 'elevation'];
            })()}
            onStatPanelReorder={(keys) => setPreference('statPanelOrder', keys)}
            pause={pause}
            resume={resume}
            stop={() => stop(stepCountRef.current)}
            reset={reset}
          />
        )}
        {activeSheet === 'queued-walk' && queuedWalk !== null && (
          <ExploreSheetContent
            viewBounds={null}
            highlightedRoute={queuedWalk}
            selectedRoute={queuedWalk}
            isQueued
            onHighlightRoute={() => {}}
            onSelectRoute={() => {}}
            onRoutesChange={() => {}}
            onClearRoute={() => {
              ignoreNextCloseRef.current = true;
              sheetRef.current?.close();
              setActiveSheet(null);
            }}
            onStartWalk={(route) => {
              void start({ plannedRouteId: route._id });
              setFollowingRoute(route);
              ignoreNextCloseRef.current = true;
              sheetRef.current?.close();
              setActiveSheet(null);
            }}
            onQueueWalk={() => {/* already queued — no-op */}}
            onCancelWalk={() => {
              clearQueuedWalk();
              ignoreNextCloseRef.current = true;
              sheetRef.current?.close();
              setActiveSheet(null);
            }}
            onEditRoute={() => {
              Alert.alert(
                'Edit Route',
                'Route editing is available on the web app at ramble.io.',
                [{ text: 'OK' }],
              );
            }}
            userLocation={currentLocation}
            proximityThresholdM={flags.startProximityThresholdM}
          />
        )}
        {activeSheet === 'explore' && (
          <ExploreSheetContent
            viewBounds={exploreViewBounds}
            highlightedRoute={exploreHighlightedRoute}
            selectedRoute={exploreDetailRoute}
            onRoutesChange={setExploreRoutes}
            onHighlightRoute={(route) => {
              setExploreHighlightedRoute(route);
              setExploreDetailRoute(null);
              const allPts = route.legs.flatMap((l) => l.points);
              if (allPts.length > 0) {
                const lats = allPts.map((p) => p.lat);
                const lngs = allPts.map((p) => p.lng);
                const sheetPx = windowHeight * 0.45;
                cameraRef.current?.setCamera({
                  padding: { paddingBottom: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0 },
                  animationDuration: 0,
                });
                cameraRef.current?.fitBounds(
                  [Math.max(...lngs), Math.max(...lats)],
                  [Math.min(...lngs), Math.min(...lats)],
                  [insets.top + 80, 40, sheetPx + 20, 40],
                  600,
                );
              }
            }}
            onSelectRoute={(route) => {
              setExploreDetailRoute(route);
            }}
            onClearRoute={() => setExploreDetailRoute(null)}
            onStartWalk={(route) => {
              void start({ plannedRouteId: route._id });
              setFollowingRoute(route);
              ignoreNextCloseRef.current = true;
              sheetRef.current?.close();
              setActiveSheet(null);
            }}
            onQueueWalk={(route) => {
              setQueuedWalk(route);
              setExploreDetailRoute(null);
              ignoreNextCloseRef.current = true;
              sheetRef.current?.close();
              setActiveSheet(null);
              Alert.alert(
                'Walk queued',
                `Recording will start automatically when you reach "${route.title}".`,
                [{ text: 'OK' }],
              );
            }}
            onEditRoute={(route) => {
              Alert.alert(
                'Edit Route',
                'Route editing is available on the web app at ramble.io.',
                [{ text: 'OK' }],
              );
            }}
            userLocation={currentLocation}
            proximityThresholdM={flags.startProximityThresholdM}
            directDetail={flags.exploreDirectDetail}
            groupedRoutes={exploreGroupedRoutes}
            onClearGroup={() => setExploreGroupedRoutes(null)}
          />
        )}
        {activeSheet === 'profile' && (
          <ProfileSheetContent
            colors={colors}
            insets={insets}
            allowHistoryDuringRecording={flags.allowHistoryDuringRecording}
            onToggleAllowHistoryDuringRecording={(v) => setFlag('allowHistoryDuringRecording', v)}
            gpsAccuracyMultiplier={flags.gpsAccuracyMultiplier}
            onGpsAccuracyMultiplierChange={(v) => setFlag('gpsAccuracyMultiplier', v)}
            forcePedometerSteps={flags.forcePedometerSteps}
            onToggleForcePedometerSteps={(v) => setFlag('forcePedometerSteps', v)}
            startProximityThresholdM={flags.startProximityThresholdM}
            onStartProximityThresholdMChange={(v) => setFlag('startProximityThresholdM', v)}
            hapticOffRouteEnabled={flags.hapticOffRouteEnabled}
            onToggleHapticOffRouteEnabled={(v) => setFlag('hapticOffRouteEnabled', v)}
            hapticOffRouteStartM={flags.hapticOffRouteStartM}
            onHapticOffRouteStartMChange={(v) => setFlag('hapticOffRouteStartM', v)}
            hapticOffRouteMaxM={flags.hapticOffRouteMaxM}
            onHapticOffRouteMaxMChange={(v) => setFlag('hapticOffRouteMaxM', v)}
            hapticMinImpact={flags.hapticMinImpact}
            onHapticMinImpactChange={(v) => setFlag('hapticMinImpact', v)}
            hapticMaxImpact={flags.hapticMaxImpact}
            onHapticMaxImpactChange={(v) => setFlag('hapticMaxImpact', v)}
            hapticSlowIntervalMs={flags.hapticSlowIntervalMs}
            onHapticSlowIntervalMsChange={(v) => setFlag('hapticSlowIntervalMs', v)}
            hapticFastIntervalMs={flags.hapticFastIntervalMs}
            onHapticFastIntervalMsChange={(v) => setFlag('hapticFastIntervalMs', v)}
            hapticTestEnabled={flags.hapticTestEnabled}
            onToggleHapticTestEnabled={(v) => setFlag('hapticTestEnabled', v)}
            hapticTestDistanceM={flags.hapticTestDistanceM}
            onHapticTestDistanceMChange={(v) => setFlag('hapticTestDistanceM', v)}
            exploreDirectDetail={flags.exploreDirectDetail}
            onToggleExploreDirectDetail={(v) => setFlag('exploreDirectDetail', v)}
            flags={flags}
            mapFeatures={mapFeatures}
            onSetMapFeature={(key, value) => void setMapFeature(key, value)}
            cam3dMinZoom={cam3dMinZoom}
            onCam3dMinZoomChange={setCam3dMinZoom}
            cam3dMaxZoom={cam3dMaxZoom}
            onCam3dMaxZoomChange={setCam3dMaxZoom}
            cam3dMinPitch={cam3dMinPitch}
            onCam3dMinPitchChange={setCam3dMinPitch}
            cam3dMaxPitch={cam3dMaxPitch}
            onCam3dMaxPitchChange={setCam3dMaxPitch}
            terrainExaggeration={terrainExaggeration}
            onTerrainExaggerationChange={setTerrainExaggeration}
          />
        )}
      </BottomSheet>

      {/* Map button strip — top-right, rendered after BottomSheet so zIndex
          places these above the sheet and touches always reach the buttons. */}
      {!isReviewActive && perms.foreground === 'granted' && (activeSheet === null || activeSheet === 'record' || activeSheet === 'explore') && (
        <View style={[styles.mapButtonStrip, { top: insets.top + Spacing.sm }]}>
          {/* Follow-location toggle — always snaps to current position on press */}
          <TouchableOpacity
            style={[
              styles.mapButton,
              followLocation
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.backgroundCard, borderWidth: 1.5, borderColor: colors.border },
            ]}
            onPress={() => {
              setFollowLocation(true);
              if (currentLocation) {
                cameraRef.current?.setCamera({
                  centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
                  animationDuration: 400,
                });
              }
            }}
            activeOpacity={0.8}
          >
            <IconSymbol
              name="scope"
              size={20}
              color={followLocation ? '#fff' : colors.textMuted}
            />
          </TouchableOpacity>

          {/* Compass button — visible when mapCompass is on.
               Selected (primary) when north-up; deselected when rotated. */}
          {mapFeatures.mapCompass && (
            <MapCompassButton
              bearing={mapBearing}
              onResetNorth={() => {
                cameraRef.current?.setCamera({ heading: 0, animationDuration: 300 });
              }}
              backgroundColor={
                mapBearing < 0.5 || mapBearing > 359.5 ? colors.primary : colors.backgroundCard
              }
              borderColor={
                mapBearing < 0.5 || mapBearing > 359.5 ? 'transparent' : colors.border
              }
            />
          )}

          {/* 3D toggle — visible when map3d feature flag is on */}
          {mapFeatures.map3d && (
            <TouchableOpacity
              style={[
                styles.mapButton,
                map3dActive
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.backgroundCard, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setMap3dActive((v) => !v)}
              activeOpacity={0.8}
              accessibilityLabel={map3dActive ? 'Switch to flat view' : 'Switch to 3D view'}
            >
              <IconSymbol name="cube" size={20} color={map3dActive ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Location info toggle — visible when mapLocationInfo feature flag is on */}
          {mapFeatures.mapLocationInfo && (
            <TouchableOpacity
              style={[
                styles.mapButton,
                locationInfoVisible
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.backgroundCard, borderWidth: 1.5, borderColor: colors.border },
              ]}
              onPress={() => setLocationInfoVisible((v) => !v)}
              activeOpacity={0.8}
              accessibilityLabel={locationInfoVisible ? 'Hide location info' : 'Show location info'}
            >
              <IconSymbol name="info.circle" size={20} color={locationInfoVisible ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Photo button — only while actively recording */}
          {isActive && state.phase === 'recording' && (
            <PhotoFab
              walkId={state.walkId}
              currentLocation={currentLocation}
              style={styles.mapButton}
            />
          )}
          {/* Save Point button — only while actively recording or paused */}
          {isActive && (
            <SavePointButton
              walkId={state.walkId}
              currentLocation={currentLocation}
              style={styles.mapButton}
            />
          )}
        </View>
      )}

      {/* Location info tooltip — absolutely positioned above the GPS dot, no MapboxGL layer involved */}
      {locationInfoVisible && currentLocation && tooltipScreenPos && (
        <View
          pointerEvents="none"
          onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
          style={{
            position: 'absolute',
            left: tooltipScreenPos.x,
            top: tooltipScreenPos.y,
            transform: [{ translateX: -110 }, { translateY: -tooltipHeight }],
          }}
        >
          <LocationInfoPanel
            latitude={currentLocation.latitude}
            longitude={currentLocation.longitude}
            backgroundColor={colors.backgroundCard}
            textColor={colors.text}
            mutedColor={colors.textMuted}
            borderColor={colors.border}
          />
        </View>
      )}

      {/* Restore FAB — shown when recording is active but the sheet is closed */}
      {isRecording && activeSheet === null && (
        <TouchableOpacity
          style={[
            styles.restoreFab,
            { bottom: insets.bottom + 70, backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
          onPress={() => sheetEvents.open('record')}
          activeOpacity={0.85}
        >
          {/* 2×2 grid — spreadsheet cells icon */}
          <View style={styles.restoreFabGrid}>
            <View style={[styles.restoreFabCell, { borderColor: colors.border }]} />
            <View style={[styles.restoreFabCell, { borderColor: colors.border }]} />
            <View style={[styles.restoreFabCell, { borderColor: colors.border }]} />
            <View style={[styles.restoreFabCell, { borderColor: colors.border }]} />
          </View>
        </TouchableOpacity>
      )}

      {/* Custom tab bar — rendered last so it sits on top of the sheet handle */}
      <TabBar
        active={activeSheet}
        onPress={handleTabPress}
        onRecordLongPress={() => {
          if (state.phase !== 'recording' && state.phase !== 'paused') return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          Alert.alert(
            'Finished your walk?',
            'This will stop and save your current recording.',
            [
              { text: 'Keep Going', style: 'cancel' },
              {
                text: 'Stop & Save',
                style: 'destructive',
                onPress: () => { void stop(stepCountRef.current); },
              },
            ],
          );
        }}
        colors={colors}
        insets={insets}
        isRecording={state.phase === 'recording'}
        isPaused={state.phase === 'paused'}
        isWalkQueued={queuedWalk !== null && !isActive}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  recordingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: Spacing.lg,
    zIndex: 10,
  },
  mapButtonStrip: {
    position: 'absolute',
    right: Spacing.base,
    flexDirection: 'column',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 15,
    elevation: 15,
  },
  mapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completingCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    width: 260,
  },
  completingText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
  },
  permissionCard: { flex: 1, width: '100%', paddingHorizontal: Spacing.base },
  restoreFab: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 20,
  },
  restoreFabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 24,
    height: 24,
    gap: 3,
  },
  restoreFabCell: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderRadius: 2,
  },
});

const sheetStyles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: Spacing.md },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  section: { gap: Spacing.md },
  recordFixedHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  debugRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.xs },
  debugText: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.xs },
  sheetTitle: { fontFamily: Typography.fontBold, fontSize: Typography.sizes.lg },
  sheetBody: { fontFamily: Typography.fontRegular, fontSize: Typography.sizes.base },
  sheetCaption: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.sm, opacity: 0.5 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  historyCount: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.sm },
  viewOnMap: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.sm },
  flagsSection: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: Spacing.base,
    marginTop: Spacing.base,
    gap: Spacing.sm,
  },
  flagsTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  flagLabel: { flex: 1, gap: 2 },
  flagName: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.sm },
  flagDesc: { fontFamily: Typography.fontRegular, fontSize: Typography.sizes.xs },
  profileFrostedHeader: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  profileContent: { alignItems: 'center', flexGrow: 1 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
    marginTop: Spacing.sm,
  },
  avatarLetter: { fontFamily: Typography.fontBold, fontSize: 32 },
  profileName: { fontFamily: Typography.fontBold, fontSize: Typography.sizes.lg, marginBottom: Spacing.xs },
  profileEmail: { fontFamily: Typography.fontRegular, fontSize: Typography.sizes.sm, marginBottom: Spacing.lg },
  signOutButton: {
    width: '100%',
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  signOutText: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.base },
  version: { fontFamily: Typography.fontMedium, fontSize: Typography.sizes.xs, opacity: 0.5, marginBottom: Spacing.sm },
});

const permStyles = StyleSheet.create({
  pill: {
    borderRadius: 10,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  pillText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
  grantRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  grantText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  hcBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hcBadgeText: {
    fontFamily: Typography.fontMedium,
    fontSize: 10,
  },
});

const profileStyles = StyleSheet.create({
  segmentControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    minWidth: 80,
  },
  weightInput: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    minWidth: 44,
    textAlign: 'right',
  },
});

const tabBarStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 30,
  },
  buttons: {
    flexDirection: 'row',
    height: 56,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm * 3,
    minWidth: 72,
  },
  label: {
    fontSize: Typography.sizes.xs,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

const weightModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: Spacing.xs,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.lg,
  },
  subtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  saveBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center' as const,
    marginTop: Spacing.xs,
  },
  saveBtnText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
});

const _welcomeStylesUnused = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  headline: {
    fontFamily: Typography.fontHeadline,
    fontSize: Typography.sizes.xl,
    textAlign: 'center',
  },
  body: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
    textAlign: 'center',
    lineHeight: 24,
  },
  startButton: {
    width: '100%',
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  startButtonText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.md,
    letterSpacing: 0.3,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Spacing.xs,
  },
  liveTextGroup: {
    flex: 1,
    marginRight: Spacing.md,
  },
  liveLabel: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  liveSubLabel: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    marginTop: 2,
  },
});
