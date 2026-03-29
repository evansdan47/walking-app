/**
 * Design tokens for Wayfinder — Tactical Editorial design system.
 * All colours, typography, spacing, radius and shadow values live here.
 * Nothing else in the codebase should use hardcoded values.
 *
 * Colour naming: Palette holds raw tonal values.
 * Colors holds semantic tokens (what the colour means, not what it looks like).
 */

// ---------------------------------------------------------------------------
// Palette – raw tonal values
// ---------------------------------------------------------------------------

export const Palette = {
  // Primary – Burnt Ochre
  ochre: {
    900: '#6b2300',
    700: '#a43700',   // primary action
    600: '#cd4700',   // primary container / dark mode primary
    100: '#fde8dd',   // primary muted light
  },
  // Secondary – Forest Canopy
  forest: {
    900: '#0d2e10',
    700: '#1b6d24',   // secondary
    container: '#a0f399',
    100: '#d4fbd0',   // secondary muted light
  },
  // Surface – Glacial Blue
  surface: {
    base:    '#f3faff',
    low:     '#e6f6ff',
    lowest:  '#ffffff',
    highest: '#cfe6f2',
    dim:     '#c7dde9',
  },
  // Dark / icon base
  ink: {
    900: '#071e27',   // on-surface – deepest text
    800: '#0d1f14',   // dark bg
    700: '#122518',   // icon bg / dark card
    600: '#1a3322',   // dark muted
  },
  outline: {
    variant: '#e3bfb2',
  },
  // Muted icon / secondary text
  slate: {
    600: '#4a7080',
    400: '#8eb5c1',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Colors – semantic tokens (light & dark)
// ---------------------------------------------------------------------------

export const Colors = {
  light: {
    // Text
    text:            Palette.ink[900],
    textMuted:       Palette.slate[600],
    textInverse:     Palette.white,
    // Backgrounds
    background:      Palette.surface.base,
    backgroundCard:  Palette.surface.low,
    backgroundMuted: Palette.surface.highest,
    // Brand
    primary:         Palette.ochre[700],
    primaryMuted:    Palette.ochre[100],
    secondary:       Palette.forest[700],
    secondaryMuted:  Palette.forest[100],
    tertiary:        '#006064',
    tertiaryMuted:   '#e0f2f1',
    // UI chrome
    border:          Palette.outline.variant,
    icon:            Palette.slate[600],
    tint:            Palette.ochre[700],
    tabIconDefault:  Palette.slate[600],
    tabIconSelected: Palette.ochre[700],
    success:         '#2e7d32',
    successMuted:    '#e8f5e9',
  },
  dark: {
    // Text
    text:            Palette.surface.low,
    textMuted:       Palette.slate[400],
    textInverse:     Palette.ink[900],
    // Backgrounds
    background:      Palette.ink[800],
    backgroundCard:  Palette.ink[700],
    backgroundMuted: Palette.ink[600],
    // Brand
    primary:         Palette.ochre[600],
    primaryMuted:    '#4a1200',
    secondary:       '#4caf50',
    secondaryMuted:  Palette.forest[900],
    tertiary:        '#4db6ac',
    tertiaryMuted:   '#012928',
    // UI chrome
    border:          '#2a4a35',
    icon:            Palette.slate[400],
    tint:            Palette.ochre[600],
    tabIconDefault:  Palette.slate[400],
    tabIconSelected: Palette.ochre[600],
    success:         '#4caf50',
    successMuted:    '#1a3a1f',
  },
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const Typography = {
  // Inter – body, labels, captions (loaded via @expo-google-fonts/inter)
  fontRegular:  'Inter_400Regular',
  fontMedium:   'Inter_500Medium',
  fontBold:     'Inter_700Bold',
  // Plus Jakarta Sans – display/headlines (loaded via @expo-google-fonts/plus-jakarta-sans)
  fontDisplay:  'PlusJakartaSans_800ExtraBold',  // hero stats
  fontHeadline: 'PlusJakartaSans_700Bold',        // titles / section headings

  sizes: {
    xs:   11,
    sm:   13,
    base: 16,
    md:   18,
    lg:   22,
    xl:   28,
    xxl:  36,
    hero: 56, // Large stat display – elapsed timer headline
  },

  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   24,
  xl:   32,
  xxl:  48,
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------

export const Radius = {
  sm:   6,
  md:   12,
  lg:   20,
  full: 999, // Pill shapes (status badges, tags)
} as const;

// ---------------------------------------------------------------------------
// Shadows / elevation
// ---------------------------------------------------------------------------

export const Shadows = {
  card: {
    shadowColor:   Palette.ink[900],
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius:  24,
    elevation:     2,
  },
  modal: {
    shadowColor:   Palette.ink[900],
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius:  24,
    elevation:     8,
  },
} as const;
