export type DistanceUnit = 'km' | 'miles';
export type WeightUnit = 'kg' | 'lb';
export type ElevationUnit = 'metres' | 'feet';

const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;
const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function metresToFeet(metres: number): number {
  return metres / METRES_PER_FOOT;
}

export function formatDistanceMetres(metres: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const miles = metres / METRES_PER_MILE;
    if (miles < 0.1) return `${Math.round(metres * 3.28084)} ft`;
    return miles >= 10 ? `${miles.toFixed(1)} mi` : `${miles.toFixed(2)} mi`;
  }
  const km = metres / 1000;
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(metres)} m`;
}

/** Shorter distance formatting (one decimal, used in lists). */
export function formatDistanceMetresShort(metres: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const miles = metres / METRES_PER_MILE;
    if (miles < 0.1) return `${Math.round(metres * 3.28084)} ft`;
    return `${miles.toFixed(1)} mi`;
  }
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

export function formatDistanceKm(km: number, unit: DistanceUnit): string {
  return formatDistanceMetres(km * 1000, unit);
}

export function formatDistanceKmShort(km: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const miles = (km * 1000) / METRES_PER_MILE;
    return miles < 0.1 ? `${Math.round(km * 1000 * 3.28084)} ft` : `${miles.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Format elevation stored in metres for display. */
export function formatElevation(metres: number, unit: ElevationUnit): string {
  if (unit === 'feet') {
    return `${Math.round(metresToFeet(metres)).toLocaleString()} ft`;
  }
  return `${Math.round(metres).toLocaleString()} m`;
}

/** Compact elevation label (charts, inline stats). */
export function formatElevationCompact(metres: number, unit: ElevationUnit): string {
  if (unit === 'feet') return `${Math.round(metresToFeet(metres))} ft`;
  return `${Math.round(metres)} m`;
}

export function formatPace(secsPerKm: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const secsPerMile = secsPerKm * (METRES_PER_MILE / 1000);
    const m = Math.floor(secsPerMile / 60);
    const s = Math.round(secsPerMile % 60);
    return `${m}:${String(s).padStart(2, '0')} /mi`;
  }
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function formatWeightKg(kg: number, unit: WeightUnit): string {
  if (unit === 'lb') return `${Math.round(kgToLb(kg))} lb`;
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(1)} kg`;
}

export function distanceAxisLabel(unit: DistanceUnit): string {
  return unit === 'miles' ? 'mi' : 'km';
}

export function elevationAxisLabel(unit: ElevationUnit): string {
  return unit === 'feet' ? 'ft' : 'm';
}

/** Lifetime / summary moving time for overview stats (e.g. "103 h"). */
export function formatMovingTimeTotal(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 h';
  const hours = totalSeconds / 3600;
  if (hours >= 10) return `${Math.round(hours).toLocaleString()} h`;
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  const mins = Math.max(1, Math.round(totalSeconds / 60));
  return `${mins} min`;
}
