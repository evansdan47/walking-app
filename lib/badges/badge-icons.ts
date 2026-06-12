import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

const ICON_MAP: Record<string, IonName> = {
  boot: 'footsteps-outline',
  map: 'map-outline',
  distance: 'analytics-outline',
  person: 'person-outline',
  target: 'locate-outline',
  star: 'star-outline',
  settings: 'settings-outline',
  award: 'ribbon-outline',
  sun: 'sunny-outline',
  camera: 'camera-outline',
  eye: 'eye-outline',
  calendar: 'calendar-outline',
  month: 'calendar-number-outline',
  compass: 'compass-outline',
  gps: 'navigate-outline',
  mountain: 'triangle-outline',
  route: 'git-branch-outline',
  share: 'share-social-outline',
};

export function badgeIconName(iconKey: string): IonName {
  return ICON_MAP[iconKey] ?? 'ribbon-outline';
}
