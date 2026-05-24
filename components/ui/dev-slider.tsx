/**
 * DevSlider — a draggable slider designed for use inside BottomSheetScrollView.
 *
 * `@react-native-community/slider` often loses the horizontal drag gesture to
 * the parent scroll view on Android. This component uses a PanResponder that
 * captures the gesture on the very first touch so it always wins.
 *
 * It also adds ‒ / + step buttons for fine-grained adjustments.
 */
import { useCallback, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

interface DevSliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  onValueChange: (value: number) => void;
  /** Colour of the filled track portion (left of thumb). */
  trackFillColor: string;
  /** Colour of the empty track portion (right of thumb). */
  trackEmptyColor: string;
  /** Thumb and button accent colour. */
  accentColor: string;
  /** Colour for the +/− button labels. */
  labelColor: string;
}

function snap(raw: number, min: number, max: number, step: number): number {
  const snapped = Math.round((raw - min) / step) * step + min;
  return Math.min(max, Math.max(min, parseFloat(snapped.toFixed(10))));
}

export function DevSlider({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  trackFillColor,
  trackEmptyColor,
  accentColor,
  labelColor,
}: DevSliderProps) {
  const trackWidth = useRef(0);
  // Internal live value shown while dragging so the UI is responsive even
  // if the parent re-render is slightly delayed.
  const [liveValue, setLiveValue] = useState(value);
  const liveValueRef = useRef(value);

  // Keep liveValue in sync with prop when not dragging.
  const isDragging = useRef(false);
  if (!isDragging.current && liveValue !== value) {
    setLiveValue(value);
    liveValueRef.current = value;
  }

  const emit = useCallback(
    (v: number) => {
      liveValueRef.current = v;
      setLiveValue(v);
      onValueChange(v);
    },
    [onValueChange],
  );

  // Fraction at the moment the drag was started — used as anchor so dx maps
  // cleanly onto the track without jumping to the touch position.
  const grantFraction = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      // Capture immediately so the BottomSheetScrollView cannot intercept.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: () => {
        isDragging.current = true;
        grantFraction.current =
          (liveValueRef.current - minimumValue) / (maximumValue - minimumValue);
      },

      onPanResponderMove: (_, gs) => {
        if (trackWidth.current === 0) return;
        const newFraction = Math.min(
          1,
          Math.max(0, grantFraction.current + gs.dx / trackWidth.current),
        );
        const raw = minimumValue + newFraction * (maximumValue - minimumValue);
        emit(snap(raw, minimumValue, maximumValue, step));
      },

      onPanResponderRelease: () => {
        isDragging.current = false;
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
      },
    }),
  ).current;

  const fraction = (liveValue - minimumValue) / (maximumValue - minimumValue);

  const nudge = (dir: 1 | -1) => {
    emit(snap(liveValue + dir * step, minimumValue, maximumValue, step));
  };

  return (
    <View style={styles.root}>
      {/* − button */}
      <Pressable
        onPress={() => nudge(-1)}
        hitSlop={8}
        style={({ pressed }) => [styles.nudge, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.nudgeText, { color: accentColor }]}>−</Text>
      </Pressable>

      {/* Track + thumb */}
      <View
        style={styles.trackOuter}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        {/* Empty track */}
        <View style={[styles.track, { backgroundColor: trackEmptyColor }]}>
          {/* Fill */}
          <View
            style={[
              styles.trackFill,
              { width: `${fraction * 100}%`, backgroundColor: trackFillColor },
            ]}
          />
        </View>
        {/* Thumb — position driven by fraction */}
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              left: `${fraction * 100}%`,
              marginLeft: -THUMB_SIZE / 2,
              backgroundColor: accentColor,
              borderColor: labelColor === '#ffffff' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)',
            },
          ]}
        />
      </View>

      {/* + button */}
      <Pressable
        onPress={() => nudge(1)}
        hitSlop={8}
        style={({ pressed }) => [styles.nudge, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.nudgeText, { color: accentColor }]}>+</Text>
      </Pressable>
    </View>
  );
}

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 6;

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  nudge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    includeFontPadding: false,
  },
  trackOuter: {
    flex: 1,
    height: THUMB_SIZE + 8, // tall hit area
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    top: '50%',
    marginTop: -THUMB_SIZE / 2,
    // Elevation so the thumb visually sits above the track.
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
