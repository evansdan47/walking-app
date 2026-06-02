/**
 * Route statistics helpers for the planning screen.
 * Calculates distance, elevation gain, estimated walking time, and difficulty.
 */

export type PlanPoint = {
  lat: number;
  lng: number;
  isControlPoint?: boolean;
  isSnapped?: boolean;
};

export type PlanLeg = {
  id: string;
  name: string;
  color: string;
  points: PlanPoint[];
};

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

function haversineKm(a: PlanPoint, b: PlanPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Total route distance in kilometres across all legs' point arrays. */
export function totalDistKm(legs: { points: PlanPoint[] }[]): number {
  let km = 0;
  for (const leg of legs) {
    const pts = leg.points;
    for (let i = 1; i < pts.length; i++) {
      km += haversineKm(pts[i - 1]!, pts[i]!);
    }
  }
  return km;
}

// ---------------------------------------------------------------------------
// Estimated time  (Naismith's rule simplified)
//   5 km/h flat walking + 1 min per 10 m of ascent
// ---------------------------------------------------------------------------

export function estimatedTimeMins(distKm: number, elevGainM = 0): number {
  return (distKm / 5) * 60 + elevGainM / 10;
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export function difficulty(distKm: number, elevGainM = 0): 'Easy' | 'Moderate' | 'Challenging' {
  const score = distKm + elevGainM / 100;
  if (score < 5) return 'Easy';
  if (score < 15) return 'Moderate';
  return 'Challenging';
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatDistKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

export function formatTimeMins(mins: number): string {
  if (mins < 1) return '< 1 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
