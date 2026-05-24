import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { PlannedRoute } from '@/components/explore/explore-map-layer';

interface FollowRouteLayerProps {
  route: PlannedRoute;
  /** Index into the flattened route point list up to which the walk has been completed. */
  walkedPointIndex: number;
  cameraPaddingBottom?: number;
  cameraPaddingTop?: number;
  /**
   * When false the Camera is not rendered — use this when the layer is added
   * to an existing MapView that manages its own camera (e.g. the main map screen).
   * Defaults to true.
   */
  showCamera?: boolean;
}

/** Flatten all leg points to [lng, lat] pairs. */
function flattenRouteCoords(route: PlannedRoute): [number, number][] {
  const coords: [number, number][] = [];
  for (const leg of route.legs) {
    for (const pt of leg.points) {
      coords.push([pt.lng, pt.lat]);
    }
  }
  return coords;
}

function computeBounds(coords: [number, number][]) {
  if (coords.length === 0) return null;
  const lngs = coords.map(([lng]) => lng);
  const lats = coords.map(([, lat]) => lat);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
  };
}

/**
 * Renders the planned route inside an existing MapboxGL.MapView.
 *
 * Two polylines:
 *   - Full planned route: slate #94A3B8
 *   - Walked portion (up to walkedPointIndex): primary ochre colour
 *
 * Also fits the camera to the full route on mount.
 * No MapboxGL.MapView here — layers only, consistent with ReviewRouteLayer.
 */
export function FollowRouteLayer({
  route,
  walkedPointIndex,
  cameraPaddingBottom = 300,
  cameraPaddingTop = 80,
  showCamera = true,
}: FollowRouteLayerProps) {
  const allCoords = useMemo(() => flattenRouteCoords(route), [route]);
  const bounds = useMemo(() => computeBounds(allCoords), [allCoords]);

  const fullRouteGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: allCoords },
    }),
    [allCoords],
  );

  const walkedCoords = useMemo(
    () => (walkedPointIndex > 0 ? allCoords.slice(0, walkedPointIndex + 1) : []),
    [allCoords, walkedPointIndex],
  );

  const walkedGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: walkedCoords },
    }),
    [walkedCoords],
  );

  if (allCoords.length < 2) return null;

  return (
    <>
      {/* Fit camera to full route extent on first render */}
      {showCamera && bounds ? (
        <MapboxGL.Camera
          bounds={{
            ne: bounds.ne,
            sw: bounds.sw,
            paddingTop: cameraPaddingTop,
            paddingBottom: cameraPaddingBottom,
            paddingLeft: 40,
            paddingRight: 40,
          }}
          animationDuration={300}
        />
      ) : null}

      {/* Full planned route — slate */}
      <MapboxGL.ShapeSource id="follow-route-full" shape={fullRouteGeoJSON}>
        <MapboxGL.LineLayer
          id="follow-route-full-line"
          style={{
            lineColor: '#94A3B8',
            lineWidth: 5,
            lineCap: 'round',
            lineJoin: 'round',
            lineOpacity: 0.85,
          }}
        />
      </MapboxGL.ShapeSource>

      {/* Walked portion — primary ochre */}
      {walkedCoords.length >= 2 && (
        <MapboxGL.ShapeSource id="follow-route-walked" shape={walkedGeoJSON}>
          <MapboxGL.LineLayer
            id="follow-route-walked-line"
            style={{
              lineColor: '#D97706',
              lineWidth: 3.5,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.95,
            }}
          />
        </MapboxGL.ShapeSource>
      )}

      {/* Start marker */}
      {allCoords[0] ? (
        <MapboxGL.PointAnnotation id="follow-route-start" coordinate={allCoords[0]}>
          <MapboxGL.Callout title="" />
        </MapboxGL.PointAnnotation>
      ) : null}
    </>
  );
}
