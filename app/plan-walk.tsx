/**
 * PlanWalkScreen
 *
 * Full-screen route planning screen. Entered from the Plan tab.
 *
 * Features:
 *  - MapboxGL.MapView — tap to place waypoints (control points)
 *  - Snap-to-path toggle — calls Mapbox Directions API between last & new point
 *  - Undo / redo support via useUndoRedo
 *  - Bottom sheet — stats, waypoints list, snap toggle, action buttons
 *  - Save draft — writes to Convex and updates local SQLite explore cache
 */

import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import { useMutation } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanRouteLayer } from '@/components/planning/plan-route-layer';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { upsertExploreRoute } from '@/lib/explore/sync-engine';
import type { PlanLeg, PlanPoint } from '@/lib/planning/route-stats';
import {
  difficulty,
  estimatedTimeMins,
  formatDistKm,
  formatTimeMins,
  totalDistKm,
} from '@/lib/planning/route-stats';
import { fetchSnappedRoute } from '@/lib/planning/snap-to-path';

// Re-export types so plan-route-layer can import from here if needed
export type { PlanLeg, PlanPoint };

// Route line colour — ochre primary
const LEG_COLOUR = '#CD4700';

function newLeg(): PlanLeg {
  return {
    id: Date.now().toString(),
    name: 'Route',
    color: LEG_COLOUR,
    points: [],
  };
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function PlanWalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  // ── Inherit camera position from the main map ──────────────────────────────
  const { centerLng, centerLat, zoom } = useLocalSearchParams<{
    centerLng?: string;
    centerLat?: string;
    zoom?: string;
  }>();
  const initialCenter = useMemo<[number, number] | undefined>(() => {
    const lng = centerLng ? parseFloat(centerLng) : NaN;
    const lat = centerLat ? parseFloat(centerLat) : NaN;
    return !isNaN(lng) && !isNaN(lat) ? [lng, lat] : undefined;
  }, [centerLng, centerLat]);
  const initialZoom = zoom ? parseFloat(zoom) : 13;

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const sheetRef = useRef<BottomSheet>(null);

  // ── Route history ──────────────────────────────────────────────────────────
  const { present: legs, commit, undo, redo, canUndo, canRedo, reset } =
    useUndoRedo<PlanLeg[]>([newLeg()]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [snapToPath, setSnapToPath] = useState(true);
  const [isSnapping, setIsSnapping] = useState(false);
  const [routeName, setRouteName] = useState('My Route');
  const [editingName, setEditingName] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // ── Convex ─────────────────────────────────────────────────────────────────
  const saveRoute = useMutation(api.planned_routes.save);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const distKm = useMemo(() => totalDistKm(legs), [legs]);
  const estimatedMins = useMemo(() => estimatedTimeMins(distKm), [distKm]);
  const routeDifficulty = useMemo(() => difficulty(distKm), [distKm]);

  const controlPoints = useMemo<PlanPoint[]>(() => {
    const pts: PlanPoint[] = [];
    for (const leg of legs) {
      for (const pt of leg.points) {
        if (pt.isControlPoint) pts.push(pt);
      }
    }
    return pts;
  }, [legs]);

  // ── Map tap → add control point ────────────────────────────────────────────
  const handleMapPress = useCallback(
    (feature: GeoJSON.Feature<GeoJSON.Point>) => {
      if (isSnapping) return;

      const [lng, lat] = feature.geometry.coordinates;
      if (lng === undefined || lat === undefined) return;

      const newPoint: PlanPoint = { lat, lng, isControlPoint: true };
      const currentLeg = legs[0]!;
      const lastControlPoint = [...currentLeg.points]
        .reverse()
        .find((p) => p.isControlPoint);

      if (!snapToPath || !lastControlPoint) {
        // No snapping: append the control point directly
        commit((prev) => [{ ...prev[0]!, points: [...prev[0]!.points, newPoint] }]);
        return;
      }

      // Snap to path: fetch route between last control point and new point
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
      if (!token) {
        commit((prev) => [{ ...prev[0]!, points: [...prev[0]!.points, newPoint] }]);
        return;
      }

      setIsSnapping(true);
      fetchSnappedRoute(lastControlPoint, newPoint, token)
        .then((snappedPoints) => {
          // Mark the last snapped point as the user's control point
          if (snappedPoints.length > 0) {
            const last = snappedPoints[snappedPoints.length - 1]!;
            last.isControlPoint = true;
            last.isSnapped = false;
          }
          commit((prev) => [
            { ...prev[0]!, points: [...prev[0]!.points, ...snappedPoints] },
          ]);
        })
        .catch(() => {
          // Snap failed — fall back to straight line
          commit((prev) => [{ ...prev[0]!, points: [...prev[0]!.points, newPoint] }]);
        })
        .finally(() => {
          setIsSnapping(false);
        });
    },
    [legs, snapToPath, isSnapping, commit],
  );

  // ── Clear route ─────────────────────────────────────────────────────────────
  const handleClear = () => {
    if (controlPoints.length === 0) return;
    Alert.alert('Clear Route', 'Remove all waypoints and start over?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => reset([newLeg()]) },
    ]);
  };

  // ── Save draft ─────────────────────────────────────────────────────────────
  const openSaveDialog = () => {
    if (controlPoints.length < 2) {
      Alert.alert('Add more waypoints', 'Place at least 2 waypoints to save a route.');
      return;
    }
    setSaveTitle(routeName);
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    const title = saveTitle.trim();
    if (!title) return;

    setIsSaving(true);
    try {
      const stats = {
        distanceKm: Math.round(distKm * 100) / 100,
        elevationGainM: 0,
      };
      const savedId = await saveRoute({ title, legs, stats, visibility: 'private' });

      // Immediately update local SQLite cache
      upsertExploreRoute({
        _id: savedId as string,
        userId: '',
        title,
        legs,
        stats,
        createdAt: Date.now(),
        visibility: 'private',
      });

      setShowSaveDialog(false);
      router.back();
    } catch {
      Alert.alert('Save failed', 'Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (controlPoints.length === 0) {
      router.back();
      return;
    }
    Alert.alert('Discard route?', 'You have unsaved changes. Discard and exit?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const snapPoints = useMemo(() => ['28%', '60%', '90%'], []);

  return (
    <View style={styles.container}>
      {/* ── Map ── */}
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        onPress={handleMapPress}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={initialZoom}
          centerCoordinate={initialCenter}
          animationDuration={0}
        />
        <MapboxGL.UserLocation visible animated />
        <PlanRouteLayer legs={legs} />
      </MapboxGL.MapView>

      {/* ── Header overlay ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.xs,
            backgroundColor: colors.backgroundCard,
          },
        ]}
      >
        {/* Back / close */}
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {/* Route title — tap to edit */}
        {editingName ? (
          <TextInput
            style={[
              styles.titleInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
            ]}
            value={routeName}
            onChangeText={setRouteName}
            onBlur={() => setEditingName(false)}
            onSubmitEditing={() => setEditingName(false)}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            maxLength={60}
          />
        ) : (
          <TouchableOpacity
            style={styles.titlePill}
            onPress={() => setEditingName(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
              {routeName}
            </Text>
            <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* Undo / Redo */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, !canUndo && styles.disabledBtn]}
            onPress={undo}
            disabled={!canUndo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={20}
              color={canUndo ? colors.text : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, !canRedo && styles.disabledBtn]}
            onPress={redo}
            disabled={!canRedo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="arrow-redo-outline"
              size={20}
              color={canRedo ? colors.text : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Snapping indicator ── */}
      {isSnapping && (
        <View
          style={[
            styles.snappingBadge,
            { top: insets.top + 64, backgroundColor: colors.backgroundCard },
          ]}
        >
          <Text style={[styles.snappingText, { color: colors.textMuted }]}>Snapping…</Text>
        </View>
      )}

      {/* ── Bottom sheet ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: colors.backgroundCard }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatCell
              label="Distance"
              value={distKm > 0 ? formatDistKm(distKm) : '—'}
              color={colors.text}
              muted={colors.textMuted}
            />
            <StatCell
              label="Est. Time"
              value={distKm > 0 ? formatTimeMins(estimatedMins) : '—'}
              color={colors.text}
              muted={colors.textMuted}
            />
            <StatCell
              label="Waypoints"
              value={String(controlPoints.length)}
              color={colors.text}
              muted={colors.textMuted}
            />
            <StatCell
              label="Difficulty"
              value={distKm > 0 ? routeDifficulty : '—'}
              color={colors.text}
              muted={colors.textMuted}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Controls row */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                {
                  backgroundColor: snapToPath ? colors.primary : colors.backgroundMuted,
                  borderColor: snapToPath ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSnapToPath((v) => !v)}
            >
              <Ionicons
                name={snapToPath ? 'git-merge-outline' : 'remove-outline'}
                size={16}
                color={snapToPath ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.toggleBtnText,
                  { color: snapToPath ? '#fff' : colors.textMuted },
                ]}
              >
                {snapToPath ? 'Snap: On' : 'Snap: Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.border }]}
              onPress={handleClear}
              disabled={controlPoints.length === 0}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={controlPoints.length === 0 ? colors.textMuted : '#DC2626'}
              />
              <Text
                style={[
                  styles.outlineBtnText,
                  { color: controlPoints.length === 0 ? colors.textMuted : '#DC2626' },
                ]}
              >
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Waypoints section */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Waypoints</Text>

          {controlPoints.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Tap the map to place your first waypoint
              </Text>
            </View>
          ) : (
            controlPoints.map((pt, idx) => (
              <View
                key={`wp-${idx}`}
                style={[styles.waypointRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.waypointDot, { backgroundColor: colors.primary }]}>
                  <Text style={styles.waypointDotText}>{idx + 1}</Text>
                </View>
                <View style={styles.waypointInfo}>
                  <Text style={[styles.waypointLabel, { color: colors.text }]}>
                    {idx === 0
                      ? 'Start'
                      : idx === controlPoints.length - 1
                        ? 'Finish'
                        : `Point ${idx + 1}`}
                  </Text>
                  <Text style={[styles.waypointCoords, { color: colors.textMuted }]}>
                    {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View style={{ height: Spacing.lg }} />

          {/* Action buttons */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={openSaveDialog}
          >
            <Text style={styles.primaryBtnText}>Save Draft</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={handleClose}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Close</Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom + Spacing.base }} />
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── Save dialog ── */}
      <Modal
        visible={showSaveDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Save Route</Text>
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Route name</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              value={saveTitle}
              onChangeText={setSaveTitle}
              placeholder="e.g. Morning loop"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
              autoFocus
              returnKeyType="done"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowSaveDialog(false)}
                disabled={isSaving}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 },
                ]}
                onPress={() => void handleSave()}
                disabled={isSaving || !saveTitle.trim()}
              >
                <Text style={styles.modalSaveText}>
                  {isSaving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── StatCell ──────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  color,
  muted,
}: {
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.38 },
  titlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  titleText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  titleInput: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    height: 36,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },

  // ── Snapping badge ────────────────────────────────────────────────────────
  snappingBadge: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  snappingText: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontMedium,
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  sheetContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
  },
  statCell: { alignItems: 'center', flex: 1 },
  statValue: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontBold,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontRegular,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },

  // Controls
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  toggleBtnText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },

  // Waypoints
  sectionTitle: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontBold,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontRegular,
    textAlign: 'center',
    maxWidth: 220,
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  waypointDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waypointDotText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Typography.fontBold,
  },
  waypointInfo: { flex: 1 },
  waypointLabel: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  waypointCoords: {
    fontSize: Typography.sizes.xs,
    fontFamily: Typography.fontRegular,
    marginTop: 1,
  },

  // Action buttons
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontBold,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontMedium,
  },

  // Save modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.sizes.md,
    fontFamily: Typography.fontBold,
    marginBottom: Spacing.xs,
  },
  modalLabel: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  modalInput: {
    fontSize: Typography.sizes.base,
    fontFamily: Typography.fontRegular,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontMedium,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: Typography.sizes.sm,
    fontFamily: Typography.fontBold,
  },
});
