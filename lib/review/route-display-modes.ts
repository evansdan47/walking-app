import type { RoutePoint } from './build-route';

// ---------------------------------------------------------------------------
// Mode definitions
// ---------------------------------------------------------------------------

export type RouteDisplayMode =
  | 'route'
  | 'altitude-direction'
  | 'altitude-gradient'
  | 'pace';

export interface ModeOption {
  id: RouteDisplayMode;
  label: string;
  description: string;
  /** Representative colors shown as small swatches in the picker. */
  swatchColors: string[];
}

// ---------------------------------------------------------------------------
// Route colour palette (configurable)
// ---------------------------------------------------------------------------

/** The three semantic colours used by all segmented route display modes. */
export interface RouteColours {
  /** Applied to fast legs, descents, or other "positive" segments. */
  positive: string;
  /** Applied to slow legs, ascents, or other "negative" segments. */
  negative: string;
  /** Applied to flat / indeterminate segments. */
  neutral: string;
}

export const DEFAULT_ROUTE_COLOURS: RouteColours = {
  positive: '#43A047',
  negative: '#E53935',
  neutral:  '#9E9E9E',
};

export const ROUTE_DISPLAY_MODES: ModeOption[] = [
  {
    id: 'route',
    label: 'Route',
    description: 'Displays the recorded path as a single coloured line.',
    swatchColors: ['#3D7AB5'],
  },
  {
    id: 'altitude-direction',
    label: 'Altitude Direction',
    description:
      'Green segments are descents, red segments are ascents. Flat sections are shown in grey.',
    swatchColors: ['#43A047', '#9E9E9E', '#E53935'],
  },
  {
    id: 'altitude-gradient',
    label: 'Altitude Intensity',
    description:
      'Colour intensity shows how steep each climb or descent is relative to the steepest point on this walk.',
    swatchColors: ['#43A047', '#9E9E9E', '#E53935'],
  },
  {
    id: 'pace',
    label: 'Pace',
    description:
      'Green segments are the fastest legs, red the slowest. Colour is scaled to the speed range of this walk.',
    swatchColors: ['#43A047', '#9E9E9E', '#E53935'],
  },
];

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function haversineMetres(p1: RoutePoint, p2: RoutePoint): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.latitude - p1.latitude);
  const dLon = toRad(p2.longitude - p1.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const v = (h: string, offset: number) => parseInt(h.slice(offset, offset + 2), 16);
  const r = Math.round(v(hex1, 1) + (v(hex2, 1) - v(hex1, 1)) * t);
  const g = Math.round(v(hex1, 3) + (v(hex2, 3) - v(hex1, 3)) * t);
  const b = Math.round(v(hex1, 5) + (v(hex2, 5) - v(hex1, 5)) * t);
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

// ---------------------------------------------------------------------------
// Segmented GeoJSON — each pair of consecutive points becomes a Feature
// with a `color` property so a single LineLayer can use ['get', 'color'].
// ---------------------------------------------------------------------------

export type SegmentFeature = GeoJSON.Feature<GeoJSON.LineString, { color: string }>;
export type SegmentCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, { color: string }>;

/**
 * Builds a GeoJSON FeatureCollection where each segment between consecutive
 * route points is coloured according to the requested mode.
 *
 * Returns `null` for the 'route' mode — callers should use the plain
 * LineString from `buildRouteGeoJSON` in that case.
 */
export function buildSegmentedRoute(
  points: RoutePoint[],
  mode: RouteDisplayMode,
  colours: RouteColours = DEFAULT_ROUTE_COLOURS,
): SegmentCollection | null {
  if (mode === 'route' || points.length < 2) return null;

  const { positive: GREEN, negative: RED, neutral: NEUTRAL } = colours;

  // Pre-compute altitude deltas for every segment.
  const deltas: (number | null)[] = points.slice(0, -1).map((p, i) => {
    const a = p.altitude;
    const b = points[i + 1]!.altitude;
    return a != null && b != null ? b - a : null;
  });

  let getColor: (i: number) => string;

  if (mode === 'altitude-direction') {
    // Segments > 1 m gain → red, > 1 m loss → green, else neutral.
    const THRESHOLD = 1;
    getColor = (i) => {
      const d = deltas[i];
      if (d == null) return NEUTRAL;
      if (d > THRESHOLD) return RED;
      if (d < -THRESHOLD) return GREEN;
      return NEUTRAL;
    };
  } else if (mode === 'altitude-gradient') {
    // altitude-gradient: intensity relative to the steepest point.
    const numerical = deltas.map((d) => d ?? 0);
    const maxAscent = Math.max(...numerical.filter((d) => d > 0), 1);
    const maxDescent = Math.max(...numerical.filter((d) => d < 0).map((d) => -d), 1);
    const THRESHOLD = 0.5;
    getColor = (i) => {
      const d = deltas[i] ?? 0;
      if (d > THRESHOLD) return lerpColor(NEUTRAL, RED, Math.min(d / maxAscent, 1));
      if (d < -THRESHOLD) return lerpColor(NEUTRAL, GREEN, Math.min(-d / maxDescent, 1));
      return NEUTRAL;
    };
  } else {
    // pace: speed (m/s) per leg, normalized to this walk's range — green=fast, red=slow.
    const MIN_DIST_M = 0.5;
    const speeds: (number | null)[] = points.slice(0, -1).map((p, i) => {
      const next = points[i + 1]!;
      const distM = haversineMetres(p, next);
      const timeSec = (next.timestamp - p.timestamp) / 1000;
      if (distM < MIN_DIST_M || timeSec <= 0) return null;
      return distM / timeSec;
    });
    const valid = speeds.filter((s): s is number => s !== null);
    if (valid.length === 0 || Math.max(...valid) - Math.min(...valid) < 0.05) {
      getColor = () => NEUTRAL;
    } else {
      const minSpeed = Math.min(...valid);
      const maxSpeed = Math.max(...valid);
      const range = maxSpeed - minSpeed;
      getColor = (i) => {
        const s = speeds[i];
        if (s == null) return NEUTRAL;
        return lerpColor(RED, GREEN, (s - minSpeed) / range);
      };
    }
  }

  const features: SegmentFeature[] = points.slice(0, -1).map((p, i) => ({
    type: 'Feature',
    properties: { color: getColor(i) },
    geometry: {
      type: 'LineString',
      coordinates: [
        [p.longitude, p.latitude],
        [points[i + 1]!.longitude, points[i + 1]!.latitude],
      ],
    },
  }));

  return { type: 'FeatureCollection', features };
}
