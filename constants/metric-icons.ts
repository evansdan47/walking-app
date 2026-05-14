/**
 * Centralised icon names for each stat metric used across the app.
 * Values are SF Symbol names (iOS native); `IconSymbol` maps them to
 * MaterialIcons automatically on Android / web.
 *
 * Add new metrics here — never hard-code icon names in individual components.
 */
import type { IconSymbolName } from '@/components/ui/icon-symbol';

export const METRIC_ICONS = {
  distance:      'arrow.left.and.right',
  duration:      'clock',
  movingTime:    'clock.fill',
  pace:          'gauge',
  steps:         'figure.walk',
  elevationGain: 'arrow.up.forward',
  elevationLoss: 'arrow.down.forward',
  altitude:      'mountain.2',
  speed:         'gauge',
  calories:      'flame.fill',
} as const satisfies Record<string, IconSymbolName>;

export type MetricIconKey = keyof typeof METRIC_ICONS;
