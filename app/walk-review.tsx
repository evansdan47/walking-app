import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shared/app-header';

import { PhotoViewerModal } from '@/components/review/photo-viewer-modal';
import { WalkActionBar } from '@/components/review/walk-action-bar';
import { WalkHeaderCard } from '@/components/review/walk-header-card';
import { WalkStatSummary } from '@/components/review/walk-stat-summary';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useReviewRoute } from '@/contexts/review-route-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import { getPhotosForWalk } from '@/lib/db/walk-photos';
import { deleteWalk, getWalk, updateWalkTitle } from '@/lib/db/walks';
import { buildRoute } from '@/lib/review/build-route';

export default function WalkReviewScreen() {
  const { walkId } = useLocalSearchParams<{ walkId: string }>();
  const router = useRouter();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);

  // Load all data synchronously from SQLite
  const walk = useMemo(() => (walkId ? getWalk(walkId) : null), [walkId]);
  const route = useMemo(() => (walkId ? buildRoute(walkId) : []), [walkId]);
  const photos = useMemo(() => (walkId ? getPhotosForWalk(walkId) : []), [walkId]);

  const [title, setTitle] = useState<string | null>(walk?.title ?? null);
  const [selectedPhoto, setSelectedPhoto] = useState<WalkPhoto | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState<string>('');

  // Push route data into the shared map context so the underlying screen can
  // render ReviewRouteLayer without needing its own MapboxGL.MapView.
  const { setReviewData, clearReviewData } = useReviewRoute();
  useEffect(() => {
    if (route.length > 0) setReviewData(route, photos, setSelectedPhoto);
    return () => clearReviewData();
  }, [route, photos, setReviewData, clearReviewData, setSelectedPhoto]);
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
      {/* No MapboxGL.MapView here — the route is rendered via ReviewRouteContext
          onto whichever screen's map is currently mounted underneath this
          transparentModal overlay (recording screen or library screen). */}

      {/* Photo viewer — renders over everything */}
      <PhotoViewerModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />

      {/* App header — absolute overlay at top */}
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <AppHeader
          title={displayTitle}
          onBack={editingTitle ? handleCancelTitle : () => router.back()}
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

      {/* Bottom sheet — index 0 = handle-only (collapsed), index 1 = 50% latched */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['12%', '50%']}
        index={1}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.backgroundCard }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: insets.bottom + Spacing.base },
          ]}
        >
          {/* Full detail */}
          <WalkHeaderCard
            title={title}
            startedAt={walk.startedAt}
          />

          {/* Elevation chart placeholder — Phase 4 */}

          {stats && <WalkStatSummary stats={stats} />}

          <WalkActionBar onDelete={handleDelete} />

          {/* Close sheet button */}
          <TouchableOpacity
            style={[styles.closeButton, { borderColor: colors.border }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeButtonText, { color: colors.textMuted }]}>Close Review</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
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
  sheetContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  closeButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  closeButtonText: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
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
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.base,
  },
  headerAction: {
    padding: Spacing.xs,
  },
});
