import { useAuth, useUser } from '@clerk/expo';
import BottomSheet, { BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMutation } from 'convex/react';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LivePositionLayer } from '@/components/map/live-position-layer';
import { AltitudeDisplay } from '@/components/recording/altitude-display';
import { DistanceDisplay } from '@/components/recording/distance-display';
import { ElapsedTimer } from '@/components/recording/elapsed-timer';
import { PaceDisplay } from '@/components/recording/pace-display';
import { PhotoFab } from '@/components/recording/photo-button';
import { RecordingControls } from '@/components/recording/recording-controls';
import { RecordingStatusBadge } from '@/components/recording/recording-status-badge';
import { EmptyWalkHistory } from '@/components/review/empty-walk-history';
import { HistoryWalkCard } from '@/components/review/history-walk-card';
import { ReviewRouteLayer } from '@/components/review/review-route-layer';
import { PermissionGate } from '@/components/shared/permission-gate';
import { RecordingIndicatorBar } from '@/components/shared/recording-indicator-bar';
import { StatCard } from '@/components/shared/stat-card';
import { StatGrid } from '@/components/shared/stat-grid';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useReviewRoute } from '@/contexts/review-route-context';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useLocationPermission } from '@/hooks/use-location-permission';
import { sheetEvents } from '@/lib/ui/sheet-events';
import MapboxGL from '@rnmapbox/maps';

import { getPointsForWalk, insertPoint } from '@/lib/db/track-points';
import { listCompletedWalks, type Walk } from '@/lib/db/walks';
import { haversineMetres } from '@/lib/location/haversine';

function useLiveStats(walkId: string | null) {
  const [distanceMetres, setDistanceMetres] = useState(0);
  const [paceSecsPerKm, setPaceSecsPerKm] = useState<number | undefined>();
  const [lastAltitude, setLastAltitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [coordinates, setCoordinates] = useState<[number, number][]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!walkId) {
      setDistanceMetres(0);
      setPaceSecsPerKm(undefined);
      setLastAltitude(null);
      setPointCount(0);
      setCoordinates([]);
      return;
    }

    const refresh = () => {
      const points = getPointsForWalk(walkId);
      setPointCount(points.length);
      setCoordinates(points.map((p) => [p.longitude, p.latitude]));
      if (points.length === 0) return;

      const last = points[points.length - 1]!;
      setLastAltitude(last.altitudeMetres);
      setAccuracy(last.accuracyMetres);

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
    };

    refresh();
    intervalRef.current = setInterval(refresh, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [walkId]);

  return { distanceMetres, paceSecsPerKm, lastAltitude, accuracy, pointCount, coordinates };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetTab = 'record' | 'library' | 'profile';

// ---------------------------------------------------------------------------
// Sheet content components
// ---------------------------------------------------------------------------

type ColorPalette = typeof Colors.light | typeof Colors.dark;

// ---------------------------------------------------------------------------
// Idle welcome card (shown when no session is active)
// ---------------------------------------------------------------------------

function WelcomeCard({
  colors,
  onStart,
}: {
  colors: ColorPalette;
  onStart: () => void;
}) {
  return (
    <View style={welcomeStyles.card}>
      <View style={[welcomeStyles.iconCircle, { backgroundColor: colors.successMuted }]}>
        <IconSymbol name="figure.walk" size={64} color={colors.success} />
      </View>
      <Text style={[welcomeStyles.headline, { color: colors.text }]}>
        Ready for a walk?
      </Text>
      <Text style={[welcomeStyles.body, { color: colors.textMuted }]}>
        {"Track your route, distance, pace and altitude in real time.\n\nPut on your walking shoes — your adventure is one tap away!"}
      </Text>
      <TouchableOpacity
        style={[welcomeStyles.startButton, { backgroundColor: colors.success }]}
        onPress={onStart}
        activeOpacity={0.85}
      >
        <Text style={welcomeStyles.startButtonText}>Start my walk</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Record sheet content
// ---------------------------------------------------------------------------

function RecordSheetContent({
  colors,
  insets,
  state,
  pausedDurationMs,
  distanceMetres,
  paceSecsPerKm,
  displayAltitude,
  displayAccuracy,
  pointCount,
  fgPointsWritten,
  currentLocation,
  start,
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
  displayAccuracy: number | null;
  pointCount: number;
  fgPointsWritten: number;
  currentLocation: { latitude: number; longitude: number } | null;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}) {
  // Auto-reset to idle if we arrive here after a session completed
  useEffect(() => {
    if (state.phase === 'completed') {
      reset();
    }
  }, [state.phase, reset]);

  const isActive = state.phase === 'recording' || state.phase === 'paused';

  // Idle / completed → show welcome card
  if (!isActive && state.phase !== 'completing') {
    return (
      <BottomSheetScrollView
        contentContainerStyle={[
          sheetStyles.content,
          { paddingBottom: insets.bottom + Spacing.base },
        ]}
      >
        <WelcomeCard colors={colors} onStart={() => { void start(); }} />
      </BottomSheetScrollView>
    );
  }

  // Completing → brief spinner (overlay covers most of it, but sheet may peek)
  if (state.phase === 'completing') {
    return (
      <BottomSheetScrollView contentContainerStyle={[sheetStyles.content, { paddingBottom: Spacing.base, alignItems: 'center' as const }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />
        <Text style={[sheetStyles.debugText, { color: colors.textMuted, marginTop: Spacing.sm }]}>
          Saving your walk…
        </Text>
      </BottomSheetScrollView>
    );
  }

  // Active (recording / paused) → full stats view
  return (
    <BottomSheetScrollView
      contentContainerStyle={[
        sheetStyles.content,
        { paddingBottom: insets.bottom + Spacing.base },
      ]}
    >
      <View style={sheetStyles.section}>
        <StatGrid>
          <ElapsedTimer
            startedAt={(state as { startedAt: number }).startedAt}
            pausedDurationMs={pausedDurationMs}
            running={state.phase === 'recording'}
            size="sm"
          />
          <StatCard
            label="Step Count"
            value="--"
            size="sm"
            align="center"
          />
          <DistanceDisplay distanceMetres={distanceMetres} />
          <PaceDisplay paceSecsPerKm={paceSecsPerKm} />
          <AltitudeDisplay altitudeMetres={displayAltitude} />
          <StatCard
            label="GPS Accuracy"
            value={displayAccuracy != null ? `±${Math.round(displayAccuracy)}` : '--'}
            {...(displayAccuracy != null ? { unit: 'm' } : {})}
            size="sm"
            align="center"
          />
        </StatGrid>
        <RecordingControls
          phase={state.phase}
          onStart={() => { void start(); }}
          onPause={() => { void pause(); }}
          onResume={() => { void resume(); }}
          onStop={() => { void stop(); }}
        />
        <View style={sheetStyles.debugRow}>
          <Text style={[sheetStyles.debugText, { color: colors.textMuted }]}>
            pts: {pointCount} · fg: {fgPointsWritten}
          </Text>
          <Text style={[sheetStyles.debugText, { color: colors.textMuted }]}>
            {currentLocation
              ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
              : 'no fix'}
          </Text>
        </View>
      </View>
    </BottomSheetScrollView>
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
  const { state } = useWalkSessionContext();
  const [walks, setWalks] = useState<Walk[]>([]);

  // Load walks on mount (component only mounts while the sheet is open)
  useEffect(() => {
    setWalks(listCompletedWalks());
  }, []);

  const handleWalkPress = (walkId: string) => {
    if (!allowDuringRecording && (state.phase === 'recording' || state.phase === 'paused')) {
      Alert.alert('Recording in progress', 'Stop your current walk before opening a saved walk.', [{ text: 'OK' }]);
      return;
    }
    onClose();
    router.push({ pathname: '/walk-review', params: { walkId } });
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
          <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
            <Text style={[sheetStyles.viewOnMap, { color: colors.primary }]}>View on map</Text>
          </TouchableOpacity>
        </View>
      }
      ListEmptyComponent={<EmptyWalkHistory />}
      renderItem={({ item }: { item: Walk }) => (
        <HistoryWalkCard walk={item} onPress={() => handleWalkPress(item.id)} />
      )}
    />
  );
}

function ProfileSheetContent({
  colors,
  insets,
  allowHistoryDuringRecording,
  onToggleAllowHistoryDuringRecording,
}: {
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  allowHistoryDuringRecording: boolean;
  onToggleAllowHistoryDuringRecording: (value: boolean) => void;
}) {
  const { signOut } = useAuth();
  const { user } = useUser();
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
    <BottomSheetScrollView
      contentContainerStyle={[
        sheetStyles.content,
        sheetStyles.profileContent,
        { paddingBottom: insets.bottom + Spacing.base },
      ]}
    >
      <View style={[sheetStyles.avatar, { backgroundColor: colors.primary + '22', borderColor: colors.border }]}>
        <Text style={[sheetStyles.avatarLetter, { color: colors.primary }]}>
          {displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={[sheetStyles.profileName, { color: colors.text }]}>{displayName}</Text>
      {email ? (
        <Text style={[sheetStyles.profileEmail, { color: colors.textMuted }]}>{email}</Text>
      ) : null}

      {/* Feature flags */}
      <View style={[sheetStyles.flagsSection, { borderColor: colors.border }]}>
        <Text style={[sheetStyles.flagsTitle, { color: colors.textMuted }]}>Developer Settings</Text>
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
      </View>
      <Pressable
        style={[sheetStyles.signOutButton, { borderColor: colors.border }]}
        onPress={handleSignOut}
      >
        <Text style={[sheetStyles.signOutText, { color: colors.textMuted }]}>Sign Out</Text>
      </Pressable>
      <Text style={[sheetStyles.version, { color: colors.textMuted }]}>v{appVersion}</Text>
    </BottomSheetScrollView>
  );
}

// ---------------------------------------------------------------------------
// Custom tab bar
// ---------------------------------------------------------------------------

function TabBar({
  active,
  onPress,
  colors,
  insets,
  isRecording,
}: {
  active: SheetTab | null;
  onPress: (tab: SheetTab) => void;
  colors: ColorPalette;
  insets: ReturnType<typeof useSafeAreaInsets>;
  isRecording: boolean;
}) {
  const tabs: { id: SheetTab; icon: string; label: string }[] = [
    { id: 'record', icon: 'figure.walk', label: 'Record' },
    { id: 'library', icon: 'list.bullet', label: 'History' },
    { id: 'profile', icon: 'person.circle', label: 'Profile' },
  ];

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
      {isRecording && active !== 'record' && <RecordingIndicatorBar />}
      <View style={tabBarStyles.buttons}>
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const color = isActive ? colors.primary : colors.tabIconDefault;
          return (
            <TouchableOpacity
              key={tab.id}
              style={tabBarStyles.button}
              onPress={() => onPress(tab.id)}
              activeOpacity={0.7}
            >
              <IconSymbol size={26} name={tab.icon as any} color={color} />
              <Text style={[tabBarStyles.label, { color, fontFamily: Typography.fontMedium }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
  const { isReviewActive, reviewRoute, reviewPhotos, onPhotoTap } = useReviewRoute();
  const { flags, setFlag } = useFeatureFlags();

  const activeWalkId =
    state.phase === 'recording' || state.phase === 'paused' ? state.walkId : null;

  const activeWalkIdRef = useRef<string | null>(activeWalkId);
  const phaseRef = useRef<typeof state.phase>(state.phase);
  activeWalkIdRef.current = activeWalkId;
  phaseRef.current = state.phase;

  const { distanceMetres, paceSecsPerKm, lastAltitude, accuracy, pointCount, coordinates } =
    useLiveStats(activeWalkId);

  const [currentLocation, setCurrentLocation] =
    useState<{ latitude: number; longitude: number } | null>(null);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [liveAltitude, setLiveAltitude] = useState<number | null>(null);
  const [fgPointsWritten, setFgPointsWritten] = useState(0);

  // Sheet state
  const [activeSheet, setActiveSheet] = useState<SheetTab | null>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const router = useRouter();

  useEffect(() => {
    if (activeWalkId) setFgPointsWritten(0);
  }, [activeWalkId]);

  useEffect(() => {
    if (perms.foreground !== 'granted') return;
    const sub = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (loc.coords.accuracy != null) setLiveAccuracy(loc.coords.accuracy);
        if (loc.coords.altitude != null) setLiveAltitude(loc.coords.altitude);

        const walkId = activeWalkIdRef.current;
        if (walkId && phaseRef.current === 'recording') {
          insertPoint({
            id: randomUUID(),
            walkId,
            timestamp: loc.timestamp,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            altitudeMetres: loc.coords.altitude ?? null,
            speedMps: loc.coords.speed ?? null,
            accuracyMetres: loc.coords.accuracy ?? 0,
          });
          setFgPointsWritten((n) => n + 1);
        }
      },
    );
    return () => { void sub.then((s) => s.remove()); };
  }, [perms.foreground]);

  // Auto-open record sheet when recording starts
  const isActive = state.phase === 'recording' || state.phase === 'paused';

  // Snap points per sheet.
  // Record idle: single point (prevents unwanted drag-snapping on the welcome card)
  // Record active: multiple latches for peeking vs full stats
  // Library / Profile: single point each
  const snapPoints = useMemo(() => {
    if (activeSheet === 'library') return ['92%'];
    if (activeSheet === 'profile') return ['60%'];
    if (activeSheet === 'record' && isActive) return ['23%', '33%', '43%', '58%'];
    return ['58%']; // record idle, or closed default
  }, [activeSheet, isActive]);

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
      sheetRef.current?.close();
      setActiveSheet(null);
    }
  }, [state.phase]);

  const prevIsActive = useRef(false);
  useEffect(() => {
    if (isActive && !prevIsActive.current) {
      setActiveSheet('record');
      setTimeout(() => { sheetRef.current?.snapToIndex(0); }, 0);
    }
    prevIsActive.current = isActive;
  }, [isActive]);

  // Listen for external open requests (e.g. recording indicator bar tap)
  useEffect(() => {
    return sheetEvents.subscribe((sheet) => {
      const idx = sheet === 'record' && isActive ? 3 : 0;
      setActiveSheet(sheet);
      setTimeout(() => { sheetRef.current?.snapToIndex(idx); }, 0);
    });
  }, [isActive]);

  const handleTabPress = (tab: SheetTab) => {
    const idx = tab === 'record' && isActive ? 3 : 0;
    console.log('[TabPress]', {
      tab,
      activeSheet,
      isActive,
      phase: state.phase,
      sheetRef: !!sheetRef.current,
      targetIdx: idx,
      action: activeSheet === tab ? 'CLOSE' : 'OPEN',
    });
    if (activeSheet === tab) {
      sheetRef.current?.close();
      setActiveSheet(null);
    } else {
      setActiveSheet(tab);
      setTimeout(() => {
        console.log('[TabPress] calling snapToIndex', idx, 'sheetRef:', !!sheetRef.current);
        sheetRef.current?.snapToIndex(idx);
      }, 0);
    }
  };


  const isRecording = state.phase === 'recording' || state.phase === 'paused';
  const displayAccuracy = accuracy ?? liveAccuracy;
  const displayAltitude = lastAltitude ?? liveAltitude;
  const needsForeground = perms.loaded && perms.foreground !== 'granted';
  const needsBackground =
    perms.loaded && perms.foreground === 'granted' && perms.background !== 'granted';

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        {/* Camera: yielded to ReviewRouteLayer when a walk review is open */}
        {!isReviewActive && (
          <MapboxGL.Camera
            followUserLocation={state.phase === 'recording'}
            followZoomLevel={15}
            {...(state.phase !== 'recording'
              ? {
                  centerCoordinate: currentLocation
                    ? [currentLocation.longitude, currentLocation.latitude]
                    : [-0.1276, 51.5074],
                  zoomLevel: currentLocation ? 15 : 10,
                  animationMode: 'none' as const,
                }
              : {})}
          />
        )}
        <LivePositionLayer
          coordinates={isReviewActive ? [] : coordinates}
          showUserLocation={perms.foreground === 'granted'}
        />
        {/* Review route — shown while walk-review transparentModal is open on top */}
        {isReviewActive && (
          <ReviewRouteLayer
            points={reviewRoute}
            photos={reviewPhotos}
            {...(onPhotoTap ? { onPhotoTap } : {})}
          />
        )}
      </MapboxGL.MapView>

      {/* Recording status badge — top-centre map overlay */}
      {isRecording && (
        <View style={styles.recordingOverlay} pointerEvents="none">
          <RecordingStatusBadge status={state.phase} />
        </View>
      )}

      {/* Photo FAB — pinned at ~25% from top of screen while recording */}
      {isActive && state.phase === 'recording' && (
        <View style={styles.fabContainer}>
          <PhotoFab walkId={state.walkId} currentLocation={currentLocation} />
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
        backgroundStyle={{ backgroundColor: colors.backgroundCard }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        onChange={(index) => {
          console.log('[BottomSheet onChange]', { index, activeSheet });
          if (index === -1) setActiveSheet(null);
        }}
      >
        {activeSheet === 'record' && (
          <RecordSheetContent
            colors={colors}
            insets={insets}
            state={state}
            pausedDurationMs={pausedDurationMs}
            distanceMetres={distanceMetres}
            paceSecsPerKm={paceSecsPerKm}
            displayAltitude={displayAltitude}
            displayAccuracy={displayAccuracy}
            pointCount={pointCount}
            fgPointsWritten={fgPointsWritten}
            currentLocation={currentLocation}
            start={start}
            pause={pause}
            resume={resume}
            stop={stop}
            reset={reset}
          />
        )}
        {activeSheet === 'library' && (
          <HistorySheetContent
            colors={colors}
            insets={insets}
            onClose={() => { sheetRef.current?.close(); setActiveSheet(null); }}
            allowDuringRecording={flags.allowHistoryDuringRecording}
          />
        )}
        {activeSheet === 'profile' && (
          <ProfileSheetContent
            colors={colors}
            insets={insets}
            allowHistoryDuringRecording={flags.allowHistoryDuringRecording}
            onToggleAllowHistoryDuringRecording={(v) => setFlag('allowHistoryDuringRecording', v)}
          />
        )}
      </BottomSheet>

      {/* Custom tab bar — rendered last so it sits on top of the sheet handle */}
      <TabBar
        active={activeSheet}
        onPress={handleTabPress}
        colors={colors}
        insets={insets}
        isRecording={isRecording}
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
  fabContainer: { position: 'absolute', top: '25%', right: Spacing.base, zIndex: 15 },
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
    gap: 2,
  },
  label: {
    fontSize: Typography.sizes.xs,
  },
});

const welcomeStyles = StyleSheet.create({
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
});
