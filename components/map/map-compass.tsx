import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  /** Current camera bearing in degrees (0 = north up, clockwise positive). */
  bearing: number;
  /** Called when the user taps the compass to reset to north-up. */
  onResetNorth: () => void;
  /** Background colour for the button (matches the surrounding button strip). */
  backgroundColor: string;
  /** Border colour. */
  borderColor: string;
}

/**
 * A compass button for the map button strip.
 *
 * The "N" needle rotates to show where north is relative to the current camera
 * bearing.  Tapping resets the camera to north-up (bearing = 0).
 */
export function MapCompassButton({
  bearing,
  onResetNorth,
  backgroundColor,
  borderColor,
}: Props) {
  // When bearing is 0 the needle points up (north).  As the camera rotates
  // clockwise (bearing increases) north moves counter-clockwise, so we negate.
  const rotation = -bearing;

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor, borderWidth: 1.5, borderColor }]}
      onPress={onResetNorth}
      activeOpacity={0.8}
      accessibilityLabel="Reset map to north"
    >
      {/* Compass rose: needle with N tip (red) and S tip (grey) */}
      <View style={[styles.rose, { transform: [{ rotate: `${rotation}deg` }] }]}>
        {/* North half — red */}
        <View style={styles.northHalf} />
        {/* South half — muted */}
        <View style={styles.southHalf} />
      </View>
      {/* "N" label, fixed (does not rotate) */}
      <Text style={styles.label}>N</Text>
    </TouchableOpacity>
  );
}

const BUTTON_SIZE = 44;
const NEEDLE_W = 6;
const NEEDLE_H = 14;

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rose: {
    width: NEEDLE_W,
    height: NEEDLE_H * 2,
    alignItems: 'center',
    position: 'absolute',
  },
  northHalf: {
    width: NEEDLE_W,
    height: NEEDLE_H,
    backgroundColor: '#E53935',
    borderTopLeftRadius: NEEDLE_W / 2,
    borderTopRightRadius: NEEDLE_W / 2,
  },
  southHalf: {
    width: NEEDLE_W,
    height: NEEDLE_H,
    backgroundColor: '#9E9E9E',
    borderBottomLeftRadius: NEEDLE_W / 2,
    borderBottomRightRadius: NEEDLE_W / 2,
  },
  label: {
    position: 'absolute',
    top: 2,
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
