/**
 * Snap-to-path helper using the Mapbox Directions API.
 *
 * Given two control points, fetches the walking route between them and
 * returns the intermediate coordinates (excluding the duplicated origin
 * so callers can concatenate legs cleanly).
 */

import type { PlanPoint } from '@/lib/planning/route-stats';

/**
 * Fetch a walking route between two points from the Mapbox Directions API.
 *
 * @param origin      Start point (lat/lng)
 * @param destination End point (lat/lng)
 * @param token       Mapbox public access token
 * @returns           Array of snapped points (origin excluded to avoid duplication)
 */
export async function fetchSnappedRoute(
  origin: PlanPoint,
  destination: PlanPoint,
  token: string,
): Promise<PlanPoint[]> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Directions API error: ${res.status}`);
  }

  const json = (await res.json()) as {
    routes?: { geometry?: { coordinates?: [number, number][] } }[];
  };

  const coords = json.routes?.[0]?.geometry?.coordinates;
  if (!coords || coords.length === 0) {
    // No route found — fall back to straight line
    return [{ lng: destination.lng, lat: destination.lat, isSnapped: false }];
  }

  // Skip the first coordinate (duplicates the origin already in the leg)
  return coords.slice(1).map(([lng, lat]) => ({
    lng,
    lat,
    isSnapped: true,
  }));
}
