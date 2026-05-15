import { useAuth, useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useConvex, useMutation } from 'convex/react';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { LivePositionLayer } from '@/components/map/live-position-layer';
import { AltitudeDisplay } from '@/components/recording/altitude-display';
import { DistanceDisplay } from '@/components/recording/distance-display';
import { DraggableStatGrid, type StatPanel } from '@/components/recording/draggable-stat-grid';
import { ElapsedTimer } from '@/components/recording/elapsed-timer';
import { LiveElevationChart } from '@/components/recording/live-elevation-chart';
import { PaceDisplay } from '@/components/recording/pace-display';
import { PhotoFab } from '@/components/recording/photo-button';
import { RecordingControls } from '@/components/recording/recording-controls';
import { RecordingStatusBadge } from '@/components/recording/recording-status-badge';
import { SavePointButton } from '@/components/recording/save-point-button';
import { EmptyWalkHistory } from '@/components/review/empty-walk-history';
import { HistoryWalkCard } from '@/components/review/history-walk-card';
import { ReviewRouteLayer } from '@/components/review/review-route-layer';
import { ExploreMapLayer, type ExploreViewBounds, type PlannedRoute } from '@/components/explore/explore-map-layer';
import { ExploreSheetContent } from '@/components/explore/explore-sheet-content';
import { SessionsSheetContent } from '@/components/sessions/sessions-sheet-content';
import { PermissionGate } from '@/components/shared/permission-gate';
import { StatCard } from '@/components/shared/stat-card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { RouteColourPicker } from '@/components/ui/route-colour-picker';
import { METRIC_ICONS } from '@/constants/metric-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useReviewRoute } from '@/contexts/review-route-context';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useLocationPermission } from '@/hooks/use-location-permission';
import { useRouteColours } from '@/hooks/use-route-colours';
import { useStepCounter } from '@/hooks/use-step-counter';
import { DEFAULT_STAT_PANEL_ORDER, useUserPreferences } from '@/hooks/use-user-preferences';
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
import Slider from '@react-native-community/slider';
import MapboxGL from '@rnmapbox/maps';
import { useCameraPermissions } from 'expo-camera';
import { Pedometer } from 'expo-sensors';

import { useLiveWalkSync } from '@/hooks/use-live-walk-sync';
import { ensurePendingSyncJob } from '@/lib/db/sync-jobs';
import { getPointsForWalk } from '@/lib/db/track-points';
import { listCompletedWalks, type Walk } from '@/lib/db/walks';
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

type SheetTab = 'plan' | 'record' | 'explore' | 'sessions' | 'profile';

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

  // Completing → brief spinner
  if (state.phase === 'completing') {
    return (
      <BottomSheetScrollView
        contentContainerStyle={[sheetStyles.content, { paddingBottom: Spacing.base, alignItems: 'center' as const }]}
      >
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
        <Text style={[sheetStyles.debugText, { color: colors.textMuted, marginTop: Spacing.sm }]}>
          Saving your walk…
        </Text>
      </BottomSheetScrollView>
    );
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
        tint={colors.background === '#1c1917' ? 'dark' : 'light'}
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
}: {
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  allowHistoryDuringRecording: boolean;
  onToggleAllowHistoryDuringRecording: (value: boolean) => void;
  gpsAccuracyMultiplier: number;
  onGpsAccuracyMultiplierChange: (value: number) => void;
  forcePedometerSteps: boolean;
  onToggleForcePedometerSteps: (value: boolean) => void;
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
        tint={colors.background === '#1c1917' ? 'dark' : 'light'}
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
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={1}
            maximumValue={4}
            step={0.1}
            value={gpsAccuracyMultiplier}
            onValueChange={(v) => onGpsAccuracyMultiplierChange(Math.round(v * 10) / 10)}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>1.0× (strict)</Text>
            <Text style={[sheetStyles.flagDesc, { color: colors.textMuted }]}>4.0× (loose)</Text>
          </View>
        </View>

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
  colors,
  onPress,
  onLongPress,
}: {
  active: boolean;
  isRecording: boolean;
  isPaused: boolean;
  colors: ColorPalette;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording && !isPaused) {
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
  }, [isRecording, isPaused, pulseAnim]);

  const active_ = active || isRecording || isPaused;
  const bgColor = (isRecording || isPaused) ? '#b91c1c' : active_ ? colors.primary + '18' : 'transparent';
  const labelColor = (isRecording || isPaused) ? '#fff' : active_ ? colors.primary : colors.tabIconDefault;
  const label = isPaused ? 'Paused' : isRecording ? 'Recording' : 'Record';

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
}: {
  active: SheetTab | null;
  onPress: (tab: SheetTab) => void;
  onRecordLongPress: () => void;
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  isRecording: boolean;
  isPaused: boolean;
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

  const activeWalkId =
    state.phase === 'recording' || state.phase === 'paused' ? state.walkId : null;

  const { distanceMetres, paceSecsPerKm, lastAltitude, accuracy, pointCount, coordinates, elevationGainMetres, elevationLossMetres, lastSpeedMps, trackPoints, sessionPhotos } =
    useLiveStats(activeWalkId);

  const [currentLocation, setCurrentLocation] =
    useState<{ latitude: number; longitude: number } | null>(null);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [liveAltitude, setLiveAltitude] = useState<number | null>(null);

  // Follow-location toggle: when on, the camera re-centres on every position update.
  const [followLocation, setFollowLocation] = useState(true);
  const followLocationRef = useRef(true);
  followLocationRef.current = followLocation;
  const cameraRef = useRef<MapboxGL.Camera>(null);

  // Sheet state
  const [activeSheet, setActiveSheet] = useState<SheetTab | null>(null);
  // Ref so the location-watcher closure (which only re-runs when perms change)
  // can always read the latest value without going stale.
  const activeSheetRef = useRef<SheetTab | null>(null);
  activeSheetRef.current = activeSheet;

  // ── Explore tab state ────────────────────────────────────────────────────
  const [exploreViewBounds, setExploreViewBounds] = useState<ExploreViewBounds | null>(null);
  const [exploreZoom, setExploreZoom] = useState(12);
  const [exploreSelectedRoute, setExploreSelectedRoute] = useState<PlannedRoute | null>(null);
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
        if (followLocationRef.current && !isReviewActive && activeSheetRef.current !== 'explore') {
          cameraRef.current?.setCamera({
            centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
            zoomLevel: 15,
            animationDuration: 500,
          });
        }
      },
    );
    return () => { void sub.then((s) => s.remove()); };
  }, [perms.foreground]);

  // Auto-open record sheet when recording starts
  const isActive = state.phase === 'recording' || state.phase === 'paused';

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
    if (activeSheet === 'explore') {
      // 17 points every 3% (45 → 93) — close enough together to feel like
      // free-form resizing rather than snapping between two fixed positions.
      return Array.from({ length: 17 }, (_, i) => adj(45 + i * 3));
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
        setExploreSelectedRoute(null);
        // Seed initial bounds from current location so Convex query fires immediately
        if (currentLocation) {
          setExploreViewBounds({
            minLat: currentLocation.latitude - 0.05,
            maxLat: currentLocation.latitude + 0.05,
            minLng: currentLocation.longitude - 0.05,
            maxLng: currentLocation.longitude + 0.05,
          });
        }
        scheduleSnap(0);
      }
      return;
    }

    // Plan tab — placeholder (future feature)
    if (tab === 'plan') {
      Alert.alert('Coming Soon', 'Route planning will be available in a future update.');
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
      if ((state.phase === 'idle' || state.phase === 'completed') && perms.foreground === 'granted') {
        // Ensure we're fully reset before prompting to start again
        if (state.phase === 'completed') reset();
        // Not yet recording — ask first, then start + open sheet on confirm.
        Alert.alert(
          'Start recording?',
          'Your walk will be tracked and saved.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Start',
              onPress: () => {
                void start({ isLive: isLiveWalk });
                // Open the sheet at snap 0; the isActive useEffect will expand
                // snap points and snap to the correct position once recording begins.
                setActiveSheet('record');
                scheduleSnap(0);
              },
            },
          ],
        );
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
      if (exploreSelectedRoute) {
        const allPts = exploreSelectedRoute.legs.flatMap((l) => l.points);
        if (allPts.length > 0) {
          const lats = allPts.map((p) => p.lat);
          const lngs = allPts.map((p) => p.lng);
          const sheetHeightPct = sheetSnapIndex >= 0 && snapPoints[sheetSnapIndex]
            ? parseFloat(String(snapPoints[sheetSnapIndex])) / 100
            : 0;
          const sheetPx = windowHeight * sheetHeightPct;
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
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        onTouchStart={() => setFollowLocation(false)}
        onRegionDidChange={(event: any) => {
          // Only update explore bounds while the explore sheet is open.
          if (activeSheetRef.current !== 'explore') return;
          const props = event?.properties;
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
        {/* Explore route pins + selected route line */}
        {activeSheet === 'explore' && (
          <ExploreMapLayer
            viewBounds={exploreViewBounds}
            zoom={exploreZoom}
            selectedRoute={exploreSelectedRoute}
            onSelectRoute={(route) => {
              setExploreSelectedRoute(route);
              const allPts = route.legs.flatMap((l) => l.points);
              if (allPts.length > 0) {
                const lats = allPts.map((p) => p.lat);
                const lngs = allPts.map((p) => p.lng);
                const sheetPx = windowHeight * 0.45;
                cameraRef.current?.fitBounds(
                  [Math.max(...lngs), Math.max(...lats)],
                  [Math.min(...lngs), Math.min(...lats)],
                  [insets.top + 80, 40, sheetPx + 20, 40],
                  600,
                );
              }
            }}
            onClusterZoom={(lat, lng, newZoom) => {
              cameraRef.current?.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: newZoom,
                animationDuration: 400,
              });
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
            onPhotoLongPress={reviewOverlayOptions.onPhotoLongPress}
            mode={reviewOverlayOptions.mode}
            colours={reviewOverlayOptions.colours}
          />
        )}
      </MapboxGL.MapView>

      {/* Recording status badge (with inline GPS signal) — top-centre map overlay */}
      {isRecording && (
        <View style={styles.recordingOverlay}>
          <RecordingStatusBadge
            status={state.phase}
            accuracyMetres={displayAccuracy}
            onPress={() => sheetEvents.open('record')}
          />
        </View>
      )}

      {/* Completing overlay */}
      {state.phase === 'completing' && (
        <View style={styles.overlay}>
          <View style={[styles.completingCard, { backgroundColor: colors.backgroundCard }]}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.completingText, { color: colors.text }]}>
              Calculating your walk...
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
        {activeSheet === 'explore' && (
          <ExploreSheetContent
            viewBounds={exploreViewBounds}
            selectedRoute={exploreSelectedRoute}
            onSelectRoute={(route) => {
              setExploreSelectedRoute(route);
              const allPts = route.legs.flatMap((l) => l.points);
              if (allPts.length > 0) {
                const lats = allPts.map((p) => p.lat);
                const lngs = allPts.map((p) => p.lng);
                const sheetPx = windowHeight * 0.45;
                cameraRef.current?.fitBounds(
                  [Math.max(...lngs), Math.max(...lats)],
                  [Math.min(...lngs), Math.min(...lats)],
                  [insets.top + 80, 40, sheetPx + 20, 40],
                  600,
                );
              }
            }}
            onClearRoute={() => setExploreSelectedRoute(null)}
            onStartWalk={(route) => {
              Alert.alert(
                'Start Walk',
                `Follow "${route.title}"?\n\nRoute following will be available in a future update.`,
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
                  zoomLevel: 15,
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
    elevation: 2,
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
