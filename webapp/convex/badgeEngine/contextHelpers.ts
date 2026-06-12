import type { Doc } from '../_generated/dataModel';
import type { CompletedWalkSnapshot } from './types';

/** ~2.4 km cells at mid-latitudes — "area" bucket for exploration badges. */
export function areaBucket(lat: number, lng: number): string {
  const factor = 100;
  return `${Math.round(lat * factor)}:${Math.round(lng * factor)}`;
}

/** Coarser bucket — "region" for New Horizons. */
export function regionBucket(lat: number, lng: number): string {
  const factor = 10;
  return `${Math.round(lat * factor)}:${Math.round(lng * factor)}`;
}

function utcDayIndex(ms: number): number {
  return Math.floor(ms / 86_400_000);
}

function utcDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function utcWeekKey(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDay();
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((day + 6) % 7)));
  return utcDayKey(monday.getTime());
}

function utcMonthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

export function maxConsecutiveWalkDays(walks: CompletedWalkSnapshot[]): number {
  const days = [...new Set(walks.map((w) => utcDayIndex(w.startedAt)))].sort((a, b) => a - b);
  if (days.length === 0) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const diffDays = days[i]! - days[i - 1]!;
    if (diffDays === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return best;
}

export function hasWeekendHabitWeek(walks: CompletedWalkSnapshot[]): boolean {
  const byWeek = new Map<string, Set<number>>();
  for (const walk of walks) {
    const day = new Date(walk.startedAt).getUTCDay();
    if (day !== 0 && day !== 6) continue;
    const week = utcWeekKey(walk.startedAt);
    const set = byWeek.get(week) ?? new Set();
    set.add(day);
    byWeek.set(week, set);
  }
  for (const days of byWeek.values()) {
    if (days.has(0) && days.has(6)) return true;
  }
  return false;
}

export function maxActiveWeeksStreak(walks: CompletedWalkSnapshot[]): number {
  const weeks = [...new Set(walks.map((w) => utcWeekKey(w.startedAt)))].sort();
  return maxConsecutiveFromSortedKeys(weeks, 7 * 86_400_000);
}

export function maxActiveMonthsStreak(walks: CompletedWalkSnapshot[]): number {
  const months = [...new Set(walks.map((w) => utcMonthKey(w.startedAt)))].sort();
  return maxConsecutiveFromSortedKeys(months, 28 * 86_400_000);
}

function maxConsecutiveFromSortedKeys(keys: string[], expectedGapMs: number): number {
  if (keys.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]!);
    const next = new Date(keys[i]!);
    const gap = next.getTime() - prev.getTime();
    if (gap > 0 && gap <= expectedGapMs * 1.5) {
      current += 1;
      best = Math.max(best, current);
    } else if (keys[i] !== keys[i - 1]) {
      current = 1;
    }
  }
  return best;
}

export function isCircularRoute(route: Doc<'plannedRoutes'>): boolean {
  const legs = route.legs;
  if (legs.length === 0) return false;
  const firstLeg = legs[0]!;
  const lastLeg = legs[legs.length - 1]!;
  const start = firstLeg.points[0];
  const end = lastLeg.points[lastLeg.points.length - 1];
  if (!start || !end) return false;
  const dLat = Math.abs(start.lat - end.lat);
  const dLng = Math.abs(start.lng - end.lng);
  return dLat < 0.002 && dLng < 0.002;
}

export function routeDistanceMetres(route: Doc<'plannedRoutes'>): number {
  return (route.stats?.distanceKm ?? 0) * 1000;
}

export function walkCleanRatio(
  walk: CompletedWalkSnapshot,
  totalPoints: number,
): number {
  const clean = walk.stats?.pointCount ?? 0;
  if (totalPoints <= 0) return clean > 0 ? 1 : 0;
  return clean / totalPoints;
}
