import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import { buildRouteGeoJSON, type RoutePoint } from '@/lib/review/build-route';

// ---------------------------------------------------------------------------
// Marker components
// ---------------------------------------------------------------------------

/** Green circle — start of the walk. */
function StartMarker() {
  return <View style={markerStyles.start} />;
}

/** Ochre square — end of the walk. */
function EndMarker() {
  return <View style={markerStyles.end} />;
}

/** Camera-icon dot — tappable photo pin. */
function PhotoPin() {
  return <View style={markerStyles.photo} />;
}

/** Small dot used in the history map for each walk's start position. */
export function WalkStartDot() {
  return <View style={markerStyles.walkStart} />;
}

// ---------------------------------------------------------------------------
// Bounding box helper
// ---------------------------------------------------------------------------

function computeBounds(points: RoutePoint[]) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
  };
}

// ---------------------------------------------------------------------------
// ReviewRouteLayer
// ---------------------------------------------------------------------------

interface ReviewRouteLayerProps {
  /** Ordered route points from buildRoute(). */
  points: RoutePoint[];
  /** Photos taken during this walk, from getPhotosForWalk(). */
  photos?: WalkPhoto[];
  /** Called when the user taps a photo annotation. */
  onPhotoTap?: (photo: WalkPhoto) => void;
}

/**
 * Renders the completed walk route inside an existing MapboxGL.MapView.
 *
 * - ShapeSource + LineLayer for the polyline
 * - Start and end PointAnnotations
 * - PointAnnotation per photo (calls onPhotoTap on select)
 * - Camera auto-fit to route bounding box on first render
 *
 * Renders nothing when points is empty — the parent screen should show a
 * placeholder in that case rather than relying on this component.
 */
export function ReviewRouteLayer({ points, photos = [], onPhotoTap }: ReviewRouteLayerProps) {
  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(points), [points]);
  const bounds = useMemo(() => (points.length >= 2 ? computeBounds(points) : null), [points]);

  if (points.length === 0) return null;

  return (
    <>
      {/* Camera: fit to bounding box with padding so the route is never clipped */}
      {bounds && (
        <MapboxGL.Camera
          bounds={{
            ne: bounds.ne,
            sw: bounds.sw,
            paddingTop: 80,
            paddingBottom: 300, // leave room for collapsed bottom sheet
            paddingLeft: 40,
            paddingRight: 40,
          }}
          animationDuration={0}
        />
      )}

      {/* Route polyline */}
      {points.length >= 2 && (
        <MapboxGL.ShapeSource id="review-route" shape={routeGeoJSON}>
          <MapboxGL.LineLayer
            id="review-route-line"
            style={{
              lineColor: Colors.light.primary,
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.9,
            }}
          />
        </MapboxGL.ShapeSource>
      )}

      {/* Start marker */}
      <MapboxGL.PointAnnotation
        id="review-start"
        coordinate={[points[0]!.longitude, points[0]!.latitude]}
      >
        <StartMarker />
      </MapboxGL.PointAnnotation>

      {/* End marker */}
      {points.length > 1 && (
        <MapboxGL.PointAnnotation
          id="review-end"
          coordinate={[points[points.length - 1]!.longitude, points[points.length - 1]!.latitude]}
        >
          <EndMarker />
        </MapboxGL.PointAnnotation>
      )}

      {/* Photo pins */}
      {photos.map((photo) => (
        <MapboxGL.PointAnnotation
          key={photo.id}
          id={`review-photo-${photo.id}`}
          coordinate={[photo.longitude, photo.latitude]}
          onSelected={() => onPhotoTap?.(photo)}
        >
          <PhotoPin />
        </MapboxGL.PointAnnotation>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const markerStyles = StyleSheet.create({
  start: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2e7d32', // forest green
    borderWidth: 2,
    borderColor: '#fff',
  },
  end: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: Colors.light.primary, // burnt ochre
    borderWidth: 2,
    borderColor: '#fff',
  },
  photo: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1565c0', // blue
    borderWidth: 2,
    borderColor: '#fff',
  },
  walkStart: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.primary,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
