import { getCleanPointsForWalk } from '@/lib/db/track-points';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
}

/**
 * Loads clean track points for a walk and maps them to RoutePoint[].
 * Returns an empty array when no points exist — callers must guard against this.
 */
export function buildRoute(walkId: string): RoutePoint[] {
  const points = getCleanPointsForWalk(walkId);
  return points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitudeMetres,
    timestamp: p.timestamp,
  }));
}

/**
 * Converts a RoutePoint array into a GeoJSON LineString Feature suitable for
 * passing directly to a Mapbox ShapeSource.
 */
export function buildRouteGeoJSON(points: RoutePoint[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  };
}
