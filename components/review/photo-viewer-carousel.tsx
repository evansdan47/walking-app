import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';

import type { Walk } from '@/lib/db/walks';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import { buildPhotoTimeline } from '@/lib/review/build-photo-timeline';
import type { RoutePoint } from '@/lib/review/build-route';

interface PhotoViewerCarouselProps {
  photos: WalkPhoto[];
  initialIndex: number;
  walk: Walk;
  route: RoutePoint[];
  unit: 'km' | 'mi';
  onClose: () => void;
}

const SWIPE_VELOCITY_THRESHOLD = 300;
const SWIPE_TRANSLATION_THRESHOLD = 60;

export function PhotoViewerCarousel({
  photos,
  initialIndex,
  walk,
  route,
  unit,
  onClose,
}: PhotoViewerCarouselProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const timeline = useMemo(
    () => buildPhotoTimeline(photos, route, walk.startedAt, unit),
    [photos, route, walk.startedAt, unit],
  );

  const current = timeline[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < photos.length - 1;

  function goToPrev() {
    if (canGoPrev) setCurrentIndex((i) => i - 1);
  }

  function goToNext() {
    if (canGoNext) setCurrentIndex((i) => i + 1);
  }

  // Swipe gesture for left/right navigation
  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((event) => {
      const isHorizontalSwipe = Math.abs(event.velocityX) > Math.abs(event.velocityY);
      if (!isHorizontalSwipe) return;

      const swipedLeft =
        event.velocityX < -SWIPE_VELOCITY_THRESHOLD ||
        event.translationX < -SWIPE_TRANSLATION_THRESHOLD;
      const swipedRight =
        event.velocityX > SWIPE_VELOCITY_THRESHOLD ||
        event.translationX > SWIPE_TRANSLATION_THRESHOLD;

      if (swipedLeft) goToNext();
      else if (swipedRight) goToPrev();
    });

  return (
    <Modal
      visible
      presentationStyle="overFullScreen"
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Close button — top left */}
        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>

        {/* Time + distance chip — top centre */}
        {current && (
          <View style={[styles.metaChip, { top: insets.top + 14 }]}>
            <Text style={styles.metaText}>
              {current.formattedTime}
              {'  ·  '}
              {current.formattedDistance}
            </Text>
          </View>
        )}

        {/* Photo with left/right tap zones via gesture */}
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.photoContainer}>
            {current && (
              <Image
                source={{ uri: current.photo.localUri }}
                style={styles.photo}
                resizeMode="contain"
              />
            )}

            {/* Left tap zone */}
            <Pressable
              style={[styles.tapZone, styles.tapZoneLeft]}
              onPress={goToPrev}
            />
            {/* Right tap zone */}
            <Pressable
              style={[styles.tapZone, styles.tapZoneRight]}
              onPress={goToNext}
            />

            {/* Left arrow */}
            {canGoPrev && (
              <View style={[styles.arrow, styles.arrowLeft]} pointerEvents="none">
                <Ionicons name="chevron-back" size={32} color="rgba(255,255,255,0.7)" />
              </View>
            )}
            {/* Right arrow */}
            {canGoNext && (
              <View style={[styles.arrow, styles.arrowRight]} pointerEvents="none">
                <Ionicons name="chevron-forward" size={32} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </View>
        </GestureDetector>

        {/* Footer — "Photo X of Y" with nav buttons */}
        <View style={[styles.footer, { bottom: insets.bottom + 16 }]}>
          <Pressable onPress={goToPrev} hitSlop={12} style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>

          <View style={styles.countChip}>
            <Text style={styles.countText}>
              Photo {currentIndex + 1} of {photos.length}
            </Text>
          </View>

          <Pressable onPress={goToNext} hitSlop={12} style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    padding: 4,
  },
  metaChip: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    zIndex: 20,
  },
  metaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  photoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '25%',
  },
  tapZoneLeft: {
    left: 0,
  },
  tapZoneRight: {
    right: 0,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  navButton: {
    padding: 8,
    opacity: 1,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  countChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  countText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
});
