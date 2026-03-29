import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';

interface LivePositionLayerProps {
  /** [longitude, latitude] pairs in chronological order. */
  coordinates: [number, number][];
  /** Only render the live-location dot when location permission is granted. */
  showUserLocation?: boolean;
}

/**
 * Renders the user's live position dot and a breadcrumb polyline showing
 * the route walked so far. Intended to be used inside a MapboxGL.MapView.
 */
export function LivePositionLayer({ coordinates, showUserLocation = false }: LivePositionLayerProps) {
  const lineGeoJson = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates,
      },
    }),
    [coordinates],
  );

  return (
    <>
      {/* Live user location dot — only once permission is granted */}
      {showUserLocation && <MapboxGL.UserLocation visible animated />}

      {/* Breadcrumb polyline — only rendered once we have at least two points */}
      {coordinates.length >= 2 && (
        <MapboxGL.ShapeSource id="walk-breadcrumb" shape={lineGeoJson}>
          <MapboxGL.LineLayer
            id="walk-breadcrumb-line"
            style={{
              lineColor: '#33B5E5',
              lineWidth: 3.5,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.9,
            }}
          />
        </MapboxGL.ShapeSource>
      )}
    </>
  );
}
