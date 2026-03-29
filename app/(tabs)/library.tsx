import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapboxGL from '@rnmapbox/maps';

import { EmptyWalkHistory } from '@/components/review/empty-walk-history';
import { HistoryWalkCard } from '@/components/review/history-walk-card';
import { WalkStartDot } from '@/components/review/review-route-layer';
import { AppHeader } from '@/components/shared/app-header';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useWalkSessionContext } from '@/contexts/walk-session-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFirstPointForWalk } from '@/lib/db/track-points';
import { listCompletedWalks, type Walk } from '@/lib/db/walks';

type StartPoint = { walkId: string; coordinate: [number, number] };

export default function WalkLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = (useColorScheme() ?? 'light') as 'light' | 'dark';
  const colors = Colors[scheme];
  const { state } = useWalkSessionContext();
  const sheetRef = useRef<BottomSheet>(null);

  const [walks, setWalks] = useState<Walk[]>([]);
  const [startPoints, setStartPoints] = useState<StartPoint[]>([]);

  // Reload on every focus so newly completed walks appear immediately
  useFocusEffect(
    useCallback(() => {
      const completed = listCompletedWalks();
      setWalks(completed);
      const pts: StartPoint[] = [];
      for (const w of completed as Walk[]) {
        const pt = getFirstPointForWalk(w.id);
        if (pt) pts.push({ walkId: w.id, coordinate: [pt.longitude, pt.latitude] });
      }
      setStartPoints(pts);
    }, []),
  );

  const handleWalkPress = (walkId: string) => {
    if (state.phase === 'recording' || state.phase === 'paused') {
      Alert.alert(
        'Recording in progress',
        'Stop your current recording before opening a saved walk.',
        [{ text: 'OK' }],
      );
      return;
    }
    router.push({ pathname: '/walk-review', params: { walkId } });
  };

  // Camera centres on the most recent walk's start point, or defaults to London
  const cameraCenter = useMemo<[number, number]>(
    () => startPoints[0]?.coordinate ?? [-0.1276, 51.5074],
    [startPoints],
  );

  const walkCount = walks.length;
  const walkLabel = `${walkCount} ${walkCount === 1 ? 'walk' : 'walks'}`;

  return (
    <View style={styles.container}>
      {/* Full-screen map — walk start dots */}
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
        <MapboxGL.Camera
          centerCoordinate={cameraCenter}
          zoomLevel={startPoints.length > 0 ? 11 : 10}
          animationMode="none"
        />
        {startPoints.map(({ walkId, coordinate }) => (
          <MapboxGL.PointAnnotation
            key={walkId}
            id={`history-dot-${walkId}`}
            coordinate={coordinate}
          >
            <WalkStartDot />
          </MapboxGL.PointAnnotation>
        ))}
      </MapboxGL.MapView>

      {/* App header — absolute overlay */}
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <AppHeader title="My Walks" onBack={() => router.back()} />
      </View>

      {/* Bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['15%', '75%']}
        index={0}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.backgroundCard }}
        handleIndicatorStyle={{ backgroundColor: colors.textMuted }}
      >
        <BottomSheetFlatList
          data={walks}
          keyExtractor={(w: Walk) => w.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.base },
          ]}
          ListHeaderComponent={
            <Text style={[styles.walkCount, { color: colors.textMuted }]}>
              {walkLabel}
            </Text>
          }
          ListEmptyComponent={<EmptyWalkHistory />}
          renderItem={({ item }: { item: Walk }) => (
            <HistoryWalkCard walk={item} onPress={() => handleWalkPress(item.id)} />
          )}
        />
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
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  walkCount: {
    fontFamily: Typography.fontMedium,
    fontSize: Typography.sizes.sm,
    marginBottom: Spacing.sm,
  },
});

