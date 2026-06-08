/** Preset Rambleio avatar catalogue — expand with more assets over time. */
export type RambleioAvatarPreset = {
  id: string;
  label: string;
  src: string;
};

export const RAMBLEIO_AVATAR_PRESETS: RambleioAvatarPreset[] = [
  { id: 'boot', label: 'Trail boot', src: '/avatars/boot.svg' },
  { id: 'mountain', label: 'Mountain', src: '/avatars/mountain.svg' },
  { id: 'compass', label: 'Compass', src: '/avatars/compass.svg' },
  { id: 'forest', label: 'Forest', src: '/avatars/forest.svg' },
  { id: 'sunrise', label: 'Sunrise', src: '/avatars/sunrise.svg' },
  { id: 'trail', label: 'Trail', src: '/avatars/trail.svg' },
];

export const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
