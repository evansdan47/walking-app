import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { METRIC_ICONS } from '@/constants/metric-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WalkSyncStatus } from '@/lib/db/sync-jobs';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import type { Walk } from '@/lib/db/walks';

const PHOTO_THUMB_SIZE = 88;
const ROUTE_THUMB_SIZE = 64;

interface SessionMemoryCardProps {
  walk: Walk;
  photos: WalkPhoto[];
  totalPhotos: number;
  routeCoordinates: [number, number][];
  syncStatus: WalkSyncStatus | null;
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

// ── MetaChip ────────────────────────────────────────────────────────────────

interface MetaChipProps {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  colors: typeof Colors['light'];
}

function MetaChip({ icon, label, colors }: MetaChipProps) {
  return (
    <View style={styles.metaChip}>
      <IconSymbol name={icon} size={12} color={colors.textMuted} />
      <Text style={[styles.metaChipText, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

// ── Difficulty colour (traffic-light) ────────────────────────────────────────
function difficultyColor(distanceMetres: number, elevationGainMetres = 0): string {
  const distKm = distanceMetres / 1000;
  const grade = elevationGainMetres / (distanceMetres || 1);
  if (grade > 0.06 || distKm > 15 || elevationGainMetres > 500) return '#c0392b'; // hard
  if (grade > 0.025 || distKm > 8 || elevationGainMetres > 150) return '#d97706'; // moderate
  return '#16a34a'; // easy
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
  syncStatus,
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
  const routeColor = difficultyColor(
    walk.stats?.distanceMetres ?? 0,
    walk.stats?.elevationGainMetres,
  );

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
        {/* Route SVG thumbnail — transparent bg, difficulty-coloured line */}
        <View style={styles.routeThumb}>
          {polylinePoints.length > 0 ? (
            <Svg width={ROUTE_THUMB_SIZE} height={ROUTE_THUMB_SIZE}>
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={routeColor}
                strokeWidth={2.2}
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
          {walk.stats && (
            <View style={styles.metaRow}>
              <MetaChip icon={METRIC_ICONS.distance} label={formatDistance(walk.stats.distanceMetres)} colors={colors} />
              <MetaChip icon={METRIC_ICONS.duration} label={formatDuration(walk.stats.durationSeconds)} colors={colors} />
              {(walk.stats.elevationGainMetres ?? 0) >= 1 && (
                <MetaChip icon={METRIC_ICONS.elevationGain} label={`${Math.round(walk.stats.elevationGainMetres!)} m`} colors={colors} />
              )}
              {(walk.stats.stepCount ?? walk.stats.hcStepCount ?? 0) > 0 && (
                <MetaChip
                  icon={METRIC_ICONS.steps}
                  label={(walk.stats.hcStepCount ?? walk.stats.stepCount!).toLocaleString()}
                  colors={colors}
                />
              )}
            </View>
          )}
          {/* Photo sync badge */}
          {syncStatus?.photoSyncStatus === 'failed' && (
            <View style={[styles.syncBadge, styles.syncBadgeError]}>
              <IconSymbol name="exclamationmark.triangle" size={10} color="#fff" />
              <Text style={styles.syncBadgeText}>Photo upload issue</Text>
            </View>
          )}
          {(syncStatus?.photoSyncStatus === 'pending' || syncStatus?.photoSyncStatus === 'partial') && (
            <View style={[styles.syncBadge, styles.syncBadgePending]}>
              <IconSymbol name="icloud.and.arrow.up" size={10} color="#fff" />
              <Text style={styles.syncBadgeText}>Photos uploading…</Text>
            </View>
          )}
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
    // subtle lift above the sheet background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
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
    gap: 4,
  },
  title: {
    fontFamily: Typography.fontBold,
    fontSize: Typography.sizes.base,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaChipText: {
    fontFamily: Typography.fontRegular,
    fontSize: Typography.sizes.sm,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 24,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  syncBadgePending: {
    backgroundColor: '#d97706',
  },
  syncBadgeError: {
    backgroundColor: '#dc2626',
  },
  syncBadgeText: {
    fontFamily: Typography.fontMedium,
    fontSize: 11,
    color: '#fff',
  },
});
