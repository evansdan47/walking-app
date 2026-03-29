import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import MapboxGL from '@rnmapbox/maps';

import { ReviewRouteLayer, WalkStartDot } from '@/components/review/review-route-layer';
import { AppHeader } from '@/components/shared/app-header';
import { useReviewRoute } from '@/contexts/review-route-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFirstPointForWalk } from '@/lib/db/track-points';
import { listCompletedWalks, type Walk } from '@/lib/db/walks';

type StartPoint = { walkId: string; coordinate: [number, number] };

export default function WalkHistoryMapScreen() {
  const router = useRouter();
  useColorScheme(); // ensure theme re-renders
  const { isReviewActive, reviewRoute, reviewPhotos, onPhotoTap } = useReviewRoute();

  const [startPoints, setStartPoints] = useState<StartPoint[]>([]);

  useFocusEffect(
    useCallback(() => {
      const completed = listCompletedWalks();
      const pts: StartPoint[] = [];
      for (const w of completed as Walk[]) {
        const pt = getFirstPointForWalk(w.id);
        if (pt) pts.push({ walkId: w.id, coordinate: [pt.longitude, pt.latitude] });
      }
      setStartPoints(pts);
    }, []),
  );

  const cameraCenter = useMemo<[number, number]>(
    () => startPoints[0]?.coordinate ?? [-0.1276, 51.5074],
    [startPoints],
  );

  return (
    <View style={styles.container}>
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MapboxGL.StyleURL.Outdoors}
        logoEnabled
        attributionEnabled
        scrollEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        compassEnabled={false}
      >
        {!isReviewActive && (
          <MapboxGL.Camera
            centerCoordinate={cameraCenter}
            zoomLevel={startPoints.length > 0 ? 11 : 10}
            animationMode="none"
          />
        )}
        {!isReviewActive &&
          startPoints.map(({ walkId, coordinate }) => (
            <MapboxGL.PointAnnotation
              key={walkId}
              id={`history-dot-${walkId}`}
              coordinate={coordinate}
            >
              <WalkStartDot />
            </MapboxGL.PointAnnotation>
          ))}
        {isReviewActive && (
          <ReviewRouteLayer
            points={reviewRoute}
            photos={reviewPhotos}
            {...(onPhotoTap ? { onPhotoTap } : {})}
          />
        )}
      </MapboxGL.MapView>

      <View style={styles.headerOverlay} pointerEvents="box-none">
        <AppHeader title="Walk History" onBack={() => router.back()} />
      </View>
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
});
