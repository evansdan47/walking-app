const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;
const KG_PER_LB = 0.45359237;

export type DistanceUnit = 'km' | 'miles';
export type WeightUnit = 'kg' | 'lb';
export type ElevationUnit = 'metres' | 'feet';

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function formatDistanceMetresShort(metres: number, unit: DistanceUnit): string {
  if (unit === 'miles') {
    const miles = metres / METRES_PER_MILE;
    if (miles < 0.1) return `${Math.round(metres * 3.28084)} ft`;
    return `${miles.toFixed(1)} mi`;
  }
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

export function formatElevation(metres: number, unit: ElevationUnit): string {
  if (unit === 'feet') {
    return `${Math.round(metres / METRES_PER_FOOT).toLocaleString()} ft`;
  }
  return `${Math.round(metres).toLocaleString()} m`;
}

export function formatElevationCompact(metres: number, unit: ElevationUnit): string {
  if (unit === 'feet') return `${Math.round(metres / METRES_PER_FOOT)} ft`;
  return `${Math.round(metres)} m`;
}

export function formatMovingTimeTotal(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 h';
  const hours = totalSeconds / 3600;
  if (hours >= 10) return `${Math.round(hours).toLocaleString()} h`;
  if (hours >= 1) return `${hours.toFixed(1)} h`;
  const mins = Math.max(1, Math.round(totalSeconds / 60));
  return `${mins} min`;
}
