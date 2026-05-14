// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // Walking app tabs
  'list.bullet': 'format-list-bulleted',
  'figure.walk': 'directions-walk',
  'person.circle': 'account-circle',
  'safari': 'explore',
  'map': 'map',
  // Recording controls
  'record.circle.fill': 'fiber-manual-record',
  'pause.circle.fill': 'pause-circle-filled',
  'stop.circle.fill': 'stop-circle',
  'play.circle.fill': 'play-circle-filled',
  // General UI
  'camera.fill': 'photo-camera',
  'photo.on.rectangle': 'photo-library',
  'map.fill': 'map',
  'location.fill': 'location-on',
  'scope': 'my-location',
  // ── Metric / stat icons ────────────────────────────────────────────────
  'arrow.left.and.right': 'straighten',           // distance
  'clock': 'timer',                               // duration / elapsed time
  'clock.fill': 'timer',                          // moving time (filled variant)
  'arrow.up.forward': 'trending-up',             // elevation gain
  'arrow.down.forward': 'trending-down',         // elevation loss
  'mountain.2': 'terrain',                       // altitude
  'gauge': 'speed',                              // speed / pace
  'flame.fill': 'local-fire-department',         // calories
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'xmark': 'close',
  'arrow.left': 'arrow-back',
  'gear': 'settings',
  'person.fill': 'person',
  'bookmark.fill': 'bookmark',
} as unknown as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
