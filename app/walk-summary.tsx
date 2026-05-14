import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoViewerCarousel } from '@/components/review/photo-viewer-carousel';
import { ReviewActionBar } from '@/components/review/review-action-bar';
import { ReviewTabBar, type TabDef } from '@/components/review/review-tab-bar';
import { TabElevation } from '@/components/review/tab-elevation';
import { TabHealthStats } from '@/components/review/tab-health-stats';
import { TabPhotos } from '@/components/review/tab-photos';
import { TabTraining } from '@/components/review/tab-training';
import { TabWalkStats } from '@/components/review/tab-walk-stats';
import { AppHeader } from '@/components/shared/app-header';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useReviewRoute } from '@/contexts/review-route-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouteColours } from '@/hooks/use-route-colours';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { getPhotosForWalk } from '@/lib/db/walk-photos';
import { deleteWalk, getWalk, updateWalkTitle } from '@/lib/db/walks';
import { buildRoute } from '@/lib/review/build-route';
import {
  ROUTE_DISPLAY_MODES,
  type RouteDisplayMode,
} from '@/lib/review/route-display-modes';

const TABS: TabDef[] = [
  { id: 'walk',      label: 'Walk Stats', icon: 'walk-outline' },
  { id: 'health',    label: 'Health',     icon: 'heart-outline' },
  { id: 'elevation', label: 'Elevation',  icon: 'trending-up-outline' },
  { id: 'training',  label: 'Training',   icon: 'stats-chart-outline' },
  { id: 'photos',    label: 'Photos',     icon: 'camera-outline' },
];

export default function WalkSummaryScreen() {
  const { walkId } = useLocalSearchParams<{ walkId: string }>();
  const router = useRouter();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { colours } = useRouteColours();
  const { preferences, setPreference } = useUserPreferences();
  const unit = preferences.preferMiles ? 'mi' : 'km';
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);

  // Load all data synchronously from SQLite
  const walk = useMemo(() => (walkId ? getWalk(walkId) : null), [walkId]);
  const route = useMemo(() => (walkId ? buildRoute(walkId) : []), [walkId]);
  const photos = useMemo(() => (walkId ? getPhotosForWalk(walkId) : []), [walkId]);

  const [title, setTitle] = useState<string | null>(walk?.title ?? null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<RouteDisplayMode>('route');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveRouteModalVisible, setSaveRouteModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('walk');
  const [sheetOpen, setSheetOpen] = useState(true);
  const [focusPhotoCoordinate, setFocusPhotoCoordinate] = useState<[number, number] | null>(null);

  // ── Shared map integration ─────────────────────────────────────────────
  // Push route + photos to the always-mounted map in index.tsx instead of
  // rendering our own MapboxGL.MapView (avoids the cold-start flash).
  const { setReviewData, setReviewOverlayOptions, clearReviewData } = useReviewRoute();

  // Mount: push route data; Unmount: clear so the main map returns to live view.
  const onPhotoTap = useCallback(
    (photo: { id: string; longitude: number; latitude: number }) => {
      const idx = photos.findIndex((p) => p.id === photo.id);
      setSelectedPhotoIndex(idx >= 0 ? idx : 0);
    },
    [photos],
  );
  useEffect(() => {
    if (route.length === 0) return;
    setReviewData(route, photos, onPhotoTap);
    return () => { clearReviewData(); };
    // intentionally omit setReviewData / clearReviewData (stable callbacks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, photos, onPhotoTap]);

  // Sync display options whenever camera padding, mode, or tab changes.
  useEffect(() => {
    setReviewOverlayOptions({
      cameraPaddingBottom: sheetOpen ? screenHeight * 0.75 + 20 : insets.bottom + 60,
      cameraPaddingTop: insets.top + 60,
      showPhotoMarkers: activeTab === 'photos',
      focusCoordinate: focusPhotoCoordinate,
      onPhotoLongPress: (photo: { longitude: number; latitude: number }) =>
        setFocusPhotoCoordinate([photo.longitude, photo.latitude]),
      mode: displayMode,
      colours,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, screenHeight, insets.bottom, insets.top, activeTab, focusPhotoCoordinate, displayMode, colours]);

  // Until Replaying Phase 1 adds followSessionId to the walks table,
  // all walks are treated as free walks and Save Route is always shown.
  const showSaveRoute = true;

  if (!walk) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Walk not found</Text>
        <Text
          style={[styles.errorBack, { color: colors.primary }]}
          onPress={() => router.back()}
        >
          Go back
        </Text>
      </View>
    );
  }

  const stats = walk.stats;

  const displayTitle =
    title ??
    new Date(walk.startedAt).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const handleDelete = () => {
    deleteWalk(walk.id);
    router.replace('/(tabs)');
  };

  const handleStartEditTitle = () => {
    setDraft(displayTitle);
    setEditingTitle(true);
  };

  const handleConfirmTitle = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      updateWalkTitle(walk.id, trimmed);
      setTitle(trimmed);
    }
    setEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setEditingTitle(false);
  };

  return (
    <View style={styles.container}>
      {/* Photo viewer carousel — renders over everything */}
      {selectedPhotoIndex !== null && (
        <PhotoViewerCarousel
          photos={photos}
          initialIndex={selectedPhotoIndex}
          walk={walk}
          route={route}
          unit={unit}
          onClose={() => setSelectedPhotoIndex(null)}
        />
      )}

      {/* Route mode picker button — top-right, below the app header.
          Long-press (or tap) to open the mode picker. */}
      {route.length >= 2 && (
        <TouchableOpacity
          style={[
            styles.modeButton,
            { top: insets.top + 60, backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
          onPress={() => setPickerOpen((v) => !v)}
          onLongPress={() => setPickerOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="layers-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Mode picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        {/* Full-screen backdrop — tap to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setPickerOpen(false)}
        />
        {/* Picker card — sibling of backdrop so tapping it doesn’t bubble to dismiss */}
        <View
          style={[
            styles.pickerCard,
            {
              top: insets.top + 60 + 44 + Spacing.sm,
              right: Spacing.base,
              backgroundColor: colors.backgroundCard,
              borderColor: colors.border,
            },
          ]}
        >
          {ROUTE_DISPLAY_MODES.map((m, idx) => (
            <Pressable
              key={m.id}
              style={[
                styles.pickerOption,
                idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                displayMode === m.id && { backgroundColor: colors.primary + '18' },
              ]}
              onPress={() => { setDisplayMode(m.id); setPickerOpen(false); }}
            >
              {/* Colour swatches */}
              <View style={styles.swatchRow}>
                {m.swatchColors.map((c) => (
                  <View key={c} style={[styles.swatchDot, { backgroundColor: c }]} />
                ))}
              </View>
              {/* Text */}
              <View style={styles.pickerTextBlock}>
                <Text style={[styles.pickerLabel, { color: colors.text }]}>{m.label}</Text>
                <Text style={[styles.pickerDesc, { color: colors.textMuted }]}>{m.description}</Text>
              </View>
              {/* Active tick */}
              {displayMode === m.id && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* App header — frosted glass absolute overlay at top */}
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <BlurView
          intensity={Platform.OS === 'ios' ? 80 : 0}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {Platform.OS === 'android' && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background + 'D8' }]} />
        )}
        <AppHeader
          title={displayTitle}
          onBack={editingTitle ? handleCancelTitle : undefined}
          containerStyle={{ backgroundColor: 'transparent', borderBottomWidth: 0 }}
          centerContent={
            editingTitle ? (
              <TextInput
                style={[styles.titleInput, { color: colors.text, borderColor: colors.border }]}
                value={draft}
                onChangeText={setDraft}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmTitle}
                selectTextOnFocus
              />
            ) : undefined
          }
          rightAction={
            editingTitle ? (
              <Pressable onPress={handleConfirmTitle} hitSlop={8} style={styles.headerAction}>
                <Ionicons name="checkmark" size={22} color={colors.success} />
              </Pressable>
            ) : (
              <Pressable onPress={handleStartEditTitle} hitSlop={8} style={styles.headerAction}>
                <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
              </Pressable>
            )
          }
        />
      </View>

      {/* Restore FAB — shown when sheet is closed */}
      {!sheetOpen && (
        <TouchableOpacity
          style={[
            styles.restoreFab,
            { bottom: insets.bottom + 80, backgroundColor: colors.backgroundCard, borderColor: colors.border },
          ]}
          onPress={() => {
            setSheetOpen(true);
            sheetRef.current?.snapToIndex(0);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="bar-chart-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Bottom sheet — single snap point so there is no mid-position sticking */}
      <BottomSheet
        ref={sheetRef}
        index={sheetOpen ? 0 : -1}
        snapPoints={['75%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: 'transparent' }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
        onChange={(index) => {
          if (index === -1) setSheetOpen(false);
          else if (!sheetOpen) setSheetOpen(true);
        }}
      >
        {/* Fixed tab bar — frosted glass, sits above the scroll view */}
        <View style={{ flex: 1 }}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 80 : 0}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={[styles.sheetHeader, { borderBottomColor: colors.border }]}
          >
            {Platform.OS === 'android' && (
              <View
                style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.backgroundCard + 'D8' }]}
              />
            )}
            <ReviewTabBar
              tabs={TABS}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                // Leaving the photos tab — clear any photo focus so the route re-fits
                if (tab !== 'photos') setFocusPhotoCoordinate(null);
              }}
            />
          </BlurView>

          <BottomSheetScrollView
            style={{ backgroundColor: colors.backgroundCard }}
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: 60 + insets.bottom + Spacing.lg },
            ]}
          >
          {/* Tab content */}
          {activeTab === 'walk' && (
            <TabWalkStats
              stats={stats}
              unit={unit}
              startedAt={walk.startedAt}
              onUnitToggle={() => setPreference('preferMiles', !preferences.preferMiles)}
              photoCount={photos.length}
            />
          )}
          {activeTab === 'health' && (
            <TabHealthStats
              stats={stats}
              bodyWeightKg={preferences.bodyWeightKg}
              onSetBodyWeight={(kg) => setPreference('bodyWeightKg', kg)}
            />
          )}
          {activeTab === 'elevation' && (
            <TabElevation
              points={route}
              stats={stats}
            />
          )}
          {activeTab === 'training' && (
            <TabTraining
              walk={walk}
              stats={stats}
              route={route}
            />
          )}
          {activeTab === 'photos' && (
            <TabPhotos
              photos={photos}
              route={route}
              walk={walk}
              unit={unit}
              onPhotoOpen={(photo, index) => setSelectedPhotoIndex(index)}
            />
          )}
          </BottomSheetScrollView>
        </View>
      </BottomSheet>

      {/* Fixed bottom action bar — outside the sheet so it stays pinned */}
      <ReviewActionBar
        onShare={() => {}}
        onExportGpx={() => {}}
        onSaveRoute={() => setSaveRouteModalVisible(true)}
        onDelete={handleDelete}
        onClose={() => router.back()}
        showSaveRoute={showSaveRoute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  sheetHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  restoreFab: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  errorBack: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  titleInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 0,
    textAlignVertical: 'center',
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
  },
  headerAction: {
    padding: Spacing.xs,
  },
  modeButton: {
    position: 'absolute',
    right: Spacing.base,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  pickerCard: {
    position: 'absolute',
    right: Spacing.base,
    width: 290,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 3,
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pickerTextBlock: {
    flex: 1,
    gap: 2,
  },
  pickerLabel: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  pickerDesc: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
    lineHeight: 16,
  },
});
