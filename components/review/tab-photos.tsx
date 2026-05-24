import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import type { Walk } from '@/lib/db/walks';
import { buildPhotoTimeline } from '@/lib/review/build-photo-timeline';
import type { RoutePoint } from '@/lib/review/build-route';

interface TabPhotosProps {
  photos: WalkPhoto[];
  route: RoutePoint[];
  walk: Walk;
  unit: 'km' | 'mi';
  onPhotoOpen: (photo: WalkPhoto, index: number) => void;
}

const GRID_COLUMNS = 3;
const GRID_GAP = 2;

export function TabPhotos({ photos, route, walk, unit, onPhotoOpen }: TabPhotosProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { width: windowWidth } = useWindowDimensions();

  // Account for horizontal padding in the sheet content (Spacing.base * 2)
  const availableWidth = windowWidth - Spacing.base * 2;
  const cellSize = Math.floor((availableWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  const timeline = buildPhotoTimeline(photos, route, walk.startedAt, unit);

  // ── Empty state ─────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.backgroundCard }]}>
          <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No photos taken</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Use the camera button during recording to capture photos along the way.
        </Text>
      </View>
    );
  }

  // Compute first and last photo times for the footer
  const firstTime = timeline[0]?.formattedTime ?? '';
  const lastTime = timeline[timeline.length - 1]?.formattedTime ?? '';

  // ── Photo grid ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
        <Text style={[styles.photoCount, { color: colors.textMuted }]}>
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </Text>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {timeline.map((entry, index) => (
          <Pressable
            key={entry.photo.id}
            style={[
              styles.cell,
              {
                width: cellSize,
                height: cellSize,
              },
            ]}
            onPress={() => onPhotoOpen(entry.photo, index)}
            android_ripple={{ color: 'rgba(0,0,0,0.2)' }}
          >
            {entry.photo.photoStatus === 'upload_skipped' && !entry.photo.localAssetUri ? (
              <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
                <Ionicons name="image-outline" size={24} color="#666" />
              </View>
            ) : (
              <Image
                source={{ uri: entry.photo.localAssetUri ?? entry.photo.localUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            )}
            {/* Timestamp chip — bottom left */}
            <View style={styles.timestampChip}>
              <Text style={styles.timestampText}>{entry.formattedTime}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Footer summary */}
      <View style={[styles.footer, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
        <View style={[styles.footerIconWrap, { backgroundColor: colors.backgroundCard }]}>
          <Ionicons name="images-outline" size={20} color={colors.textMuted} />
        </View>
        <View style={styles.footerText}>
          <Text style={[styles.footerMain, { color: colors.text }]}>
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </Text>
          <Text style={[styles.footerSub, { color: colors.textMuted }]}>
            From {firstTime} to {lastTime}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  photoCount: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  cell: {
    overflow: 'hidden',
    borderRadius: Radius.sm,
    backgroundColor: '#1a1a1a',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
  },
  timestampChip: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  timestampText: {
    fontFamily: Typography.fontMedium,
    fontSize: 10,
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  footerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    flex: 1,
    gap: 2,
  },
  footerMain: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
  },
  footerSub: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.xs,
  },
  // Empty state
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.base,
  },
  emptySubtitle: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
