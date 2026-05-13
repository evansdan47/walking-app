import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import type { Walk } from '@/lib/db/walks';

const PHOTO_THUMB_SIZE = 88;
const ROUTE_THUMB_SIZE = 64;

interface SessionMemoryCardProps {
  walk: Walk;
  photos: WalkPhoto[];
  totalPhotos: number;
  routeCoordinates: [number, number][];
  onPress: () => void;
}

function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatElevation(metres: number | undefined): string | null {
  if (!metres || metres < 1) return null;
  return `${Math.round(metres)} m`;
}

function buildRoutePolyline(
  coords: [number, number][],
  size: number,
  padding = 6,
): string {
  if (coords.length < 2) return '';
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const dLon = maxLon - minLon || 0.0001;
  const dLat = maxLat - minLat || 0.0001;
  const drawSize = size - padding * 2;
  // Keep aspect ratio
  const scale = drawSize / Math.max(dLon, dLat);
  return coords
    .map((c) => {
      const x = padding + (c[0] - minLon) * scale;
      const y = padding + (maxLat - c[1]) * scale; // flip Y
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function SessionMemoryCard({
  walk,
  photos,
  totalPhotos,
  routeCoordinates,
  onPress,
}: SessionMemoryCardProps) {
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];

  const displayTitle =
    walk.title ??
    new Date(walk.startedAt).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

  const extraPhotos = totalPhotos - photos.length;
  const polylinePoints = buildRoutePolyline(routeCoordinates, ROUTE_THUMB_SIZE);

  const elevation = walk.stats?.elevationGainMetres
    ? formatElevation(walk.stats.elevationGainMetres)
    : null;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]}
      onPress={onPress}
      android_ripple={{ color: colors.primaryMuted }}
    >
      {/* Photo strip */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photoStrip}
          contentContainerStyle={styles.photoStripContent}
          scrollEnabled={false}
          pointerEvents="none"
        >
          {photos.slice(0, 4).map((photo, idx) => {
            const isLast = idx === 3 && extraPhotos > 0;
            return (
              <View key={photo.id} style={styles.photoThumbWrapper}>
                <Image
                  source={{ uri: photo.localUri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
                {isLast && (
                  <View style={styles.photoOverlay}>
                    <Text style={styles.photoOverlayText}>+{extraPhotos}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom row: route thumb + info + chevron */}
      <View style={styles.infoRow}>
        {/* Route SVG thumbnail */}
        <View style={[styles.routeThumb, { backgroundColor: colors.backgroundMuted, borderColor: colors.border }]}>
          {polylinePoints.length > 0 ? (
            <Svg width={ROUTE_THUMB_SIZE} height={ROUTE_THUMB_SIZE}>
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={colors.secondary}
                strokeWidth={1.8}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <View style={styles.routeThumbEmpty} />
          )}
        </View>

        {/* Title + meta */}
        <View style={styles.infoBody}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {displayTitle}
          </Text>
          <View style={styles.metaRow}>
            {walk.stats && (
              <>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {formatDistance(walk.stats.distanceMetres)}
                </Text>
                <Text style={[styles.metaDot, { color: colors.border }]}> · </Text>
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {formatDuration(walk.stats.durationSeconds)}
                </Text>
                {elevation && (
                  <>
                    <Text style={[styles.metaDot, { color: colors.border }]}> · </Text>
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {elevation}
                    </Text>
                  </>
                )}
              </>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  photoStrip: {
    height: PHOTO_THUMB_SIZE,
  },
  photoStripContent: {
    flexDirection: 'row',
    gap: 2,
  },
  photoThumbWrapper: {
    position: 'relative',
  },
  photoThumb: {
    width: PHOTO_THUMB_SIZE,
    height: PHOTO_THUMB_SIZE,
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayText: {
    color: '#fff',
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  routeThumb: {
    width: ROUTE_THUMB_SIZE,
    height: ROUTE_THUMB_SIZE,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeThumbEmpty: {
    width: ROUTE_THUMB_SIZE,
    height: ROUTE_THUMB_SIZE,
  },
  infoBody: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  metaDot: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
});
