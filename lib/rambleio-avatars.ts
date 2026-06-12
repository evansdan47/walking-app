/** Preset Rambleio avatar catalogue — SVG markup matches web `public/avatars/`. */
export type RambleioAvatarPreset = {
  id: string;
  label: string;
  svg: string;
};

export const RAMBLEIO_AVATAR_PRESETS: RambleioAvatarPreset[] = [
  {
    id: 'boot',
    label: 'Trail boot',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#E8F5E9"/><path d="M44 88V56c0-6 5-11 11-11h18c6 0 11 5 11 11v32" stroke="#2E7D32" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 88h52" stroke="#2E7D32" stroke-width="6" stroke-linecap="round"/><path d="M52 45c2-8 8-14 12-14s10 6 12 14" stroke="#43A047" stroke-width="4" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'mountain',
    label: 'Mountain',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#FFF3E0"/><path d="M20 92L52 40l20 28 16-24 20 48H20z" fill="#E65100"/><path d="M52 40l20 28" stroke="#FF6D00" stroke-width="3" stroke-linecap="round"/><circle cx="88" cy="36" r="10" fill="#FFB74D"/></svg>`,
  },
  {
    id: 'compass',
    label: 'Compass',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#E0F7FA"/><circle cx="64" cy="64" r="36" stroke="#00838F" stroke-width="4"/><path d="M64 32v8M64 88v8M32 64h8M88 64h8" stroke="#00838F" stroke-width="4" stroke-linecap="round"/><path d="M64 44l8 20 20 8-20 8-8 20-8-20-20-8 20-8 8-20z" fill="#00ACC1"/></svg>`,
  },
  {
    id: 'forest',
    label: 'Forest',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#E8F5E9"/><path d="M32 92V68l16-28 12 20 12-32 12 40v24H32z" fill="#388E3C"/><path d="M32 92h64" stroke="#2E7D32" stroke-width="4" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'sunrise',
    label: 'Sunrise',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#FFF8E1"/><circle cx="64" cy="56" r="18" fill="#FFA000"/><path d="M64 24v10M64 78v10M36 56h10M82 56h10M44 36l7 7M77 77l7 7M44 76l7-7M77 35l7-7" stroke="#FF8F00" stroke-width="4" stroke-linecap="round"/><path d="M24 92h80" stroke="#E65100" stroke-width="4" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'trail',
    label: 'Trail',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#FBE9E7"/><path d="M36 88c12-24 24-36 28-52 4 16 16 28 28 52" stroke="#BF360C" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="64" cy="36" r="8" fill="#E65100"/><circle cx="48" cy="68" r="5" fill="#FF6D00"/><circle cx="80" cy="72" r="5" fill="#FF6D00"/></svg>`,
  },
];

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
