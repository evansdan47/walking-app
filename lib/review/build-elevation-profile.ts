import { haversineMetres } from '@/lib/location/haversine';
import type { RoutePoint } from './build-route';

export interface ElevationPoint {
  /** Cumulative distance from the start of the walk, in metres. */
  distanceMetres: number;
  altitudeMetres: number;
}

/**
 * Builds an elevation profile from a route's points.
 *
 * Returns an empty array when:
 * - Fewer than 2 points have altitude data, or
 * - All altitude values are identical (flat — no meaningful chart to draw).
 */
export function buildElevationProfile(points: RoutePoint[]): ElevationPoint[] {
  // Only consider points that carry altitude
  const altPoints = points.filter((p) => p.altitude !== null) as (RoutePoint & {
    altitude: number;
  })[];

  if (altPoints.length < 2) return [];

  const min = Math.min(...altPoints.map((p) => p.altitude));
  const max = Math.max(...altPoints.map((p) => p.altitude));
  if (max - min < 1) return []; // effectively flat — chart would be meaningless

  // Accumulate Haversine distance between consecutive altitude-bearing points
  const result: ElevationPoint[] = [];
  let cumulative = 0;

  result.push({ distanceMetres: 0, altitudeMetres: altPoints[0]!.altitude });

  for (let i = 1; i < altPoints.length; i++) {
    const prev = altPoints[i - 1]!;
    const curr = altPoints[i]!;
    cumulative += haversineMetres(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    result.push({ distanceMetres: cumulative, altitudeMetres: curr.altitude });
  }

  return result;
}
