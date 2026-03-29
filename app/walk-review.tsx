import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/shared/app-header';
import MapboxGL from '@rnmapbox/maps';

import { PhotoViewerModal } from '@/components/review/photo-viewer-modal';
import { ReviewRouteLayer } from '@/components/review/review-route-layer';
import { WalkActionBar } from '@/components/review/walk-action-bar';
import { WalkHeaderCard } from '@/components/review/walk-header-card';
import { WalkStatSummary } from '@/components/review/walk-stat-summary';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import { getPhotosForWalk } from '@/lib/db/walk-photos';
import { deleteWalk, getWalk } from '@/lib/db/walks';
import { buildRoute } from '@/lib/review/build-route';

function formatDistance(metres: number): string {
  const km = metres / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${metres.toFixed(0)} m`;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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

  // Walk not found — navigation guard
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

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled
        attributionEnabled
        compassEnabled={false}
      >
        <ReviewRouteLayer
          points={route}
          photos={photos}
          onPhotoTap={setSelectedPhoto}
        />
      </MapboxGL.MapView>

      {/* Photo viewer — renders over everything */}
      <PhotoViewerModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />

      {/* App header — absolute overlay at top */}
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <AppHeader
          title={displayTitle}
          onBack={() => router.back()}
        />
      </View>

      {/* Bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['25%', '70%']}
        index={0}
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
          {/* Peek row — always visible at 25% snap */}
          <View style={styles.peekRow}>
            <Text
              style={[styles.peekTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayTitle}
            </Text>
            {stats && (
              <Text style={[styles.peekMeta, { color: colors.textMuted }]}>
                {formatDistance(stats.distanceMetres)} · {formatDuration(stats.durationSeconds)}
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Full detail — visible when expanded to 70% */}
          <WalkHeaderCard
            walkId={walk.id}
            title={title}
            startedAt={walk.startedAt}
            durationSeconds={stats?.durationSeconds ?? 0}
            onTitleChanged={setTitle}
          />

          {/* Elevation chart placeholder — Phase 4 */}

          {stats && <WalkStatSummary stats={stats} />}

          <WalkActionBar onDelete={handleDelete} />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  peekRow: {
    gap: Spacing.xs,
  },
  peekTitle: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  peekMeta: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
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
});
