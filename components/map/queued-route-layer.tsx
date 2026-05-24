import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { PlannedRoute } from '@/components/explore/explore-map-layer';

interface QueuedRouteLayerProps {
  route: PlannedRoute;
}

/** Flatten all leg points to [lng, lat] GeoJSON coordinate pairs. */
function flattenRouteCoords(route: PlannedRoute): [number, number][] {
  const coords: [number, number][] = [];
  for (const leg of route.legs) {
    for (const pt of leg.points) {
      coords.push([pt.lng, pt.lat]);
    }
  }
  return coords;
}

/**
 * Renders a queued (upcoming) planned route as a dashed line on the map.
 *
 * No camera manipulation — the user should stay on their current view.
 * Renders nothing when the route has fewer than 2 points.
 */
export function QueuedRouteLayer({ route }: QueuedRouteLayerProps) {
  const coords = useMemo(() => flattenRouteCoords(route), [route]);

  const geoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }),
    [coords],
  );

  if (coords.length < 2) return null;

  return (
    <MapboxGL.ShapeSource id="queued-route" shape={geoJSON}>
      {/* White casing so the dashes read on any background */}
      <MapboxGL.LineLayer
        id="queued-route-casing"
        style={{
          lineColor: '#ffffff',
          lineWidth: 6,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 0.6,
          lineDasharray: [0, 2],
        }}
      />
      {/* Teal dashed line */}
      <MapboxGL.LineLayer
        id="queued-route-line"
        style={{
          lineColor: '#0EA5E9',
          lineWidth: 3.5,
          lineCap: 'round',
          lineJoin: 'round',
          lineOpacity: 0.9,
          lineDasharray: [2, 2],
        }}
      />
    </MapboxGL.ShapeSource>
  );
}
