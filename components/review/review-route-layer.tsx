import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import type { WalkPhoto } from '@/lib/db/walk-photos';
import { buildRouteGeoJSON, type RoutePoint } from '@/lib/review/build-route';
import {
    buildSegmentedRoute,
    type RouteColours,
    type RouteDisplayMode,
} from '@/lib/review/route-display-modes';

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

/** Blue circle camera marker — tap to open photo, long-press to zoom map. */
function PhotoDotPin({ onLongPress }: { onLongPress?: () => void }) {
  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={markerStyles.photoDotHitArea}
    >
      <View style={markerStyles.photoDot}>
        <Ionicons name="camera" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
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
  /** Called when the user long-presses a photo annotation. */
  onPhotoLongPress?: (photo: WalkPhoto) => void;
  /** Controls how the route polyline is coloured. Defaults to 'route'. */
  mode?: RouteDisplayMode;
  /** Override the positive/negative/neutral segment colours. */
  colours?: RouteColours;
  /** Show photo dot markers on the map. Defaults to false. */
  showPhotoMarkers?: boolean;
  /**
   * Bottom padding (px) passed to the Camera bounds fit — use to keep the
   * route above the bottom sheet.  Defaults to 300.
   */
  cameraPaddingBottom?: number;
  /**
   * Top padding (px) passed to the Camera bounds fit — use to keep the
   * route below the header.  Defaults to 80.
   */
  cameraPaddingTop?: number;
  /**
   * When set, the camera animates to center on this coordinate at zoom 16
   * (e.g. after a photo marker long-press).  Pass null to return to route fit.
   */
  focusCoordinate?: [number, number] | null;
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
export function ReviewRouteLayer({ points, photos = [], onPhotoTap, onPhotoLongPress, mode = 'route', colours, showPhotoMarkers = false, cameraPaddingBottom = 300, cameraPaddingTop = 80, focusCoordinate = null }: ReviewRouteLayerProps) {
  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(points), [points]);
  const segmentedGeoJSON = useMemo(
    () => buildSegmentedRoute(points, mode, colours),
    [points, mode, colours],
  );
  const bounds = useMemo(() => (points.length >= 2 ? computeBounds(points) : null), [points]);

  if (points.length === 0) return null;

  // Camera key changes whenever we switch between route-fit and photo-focus,
  // or when padding changes, so Mapbox always re-animates.
  const cameraKey = focusCoordinate
    ? `focus-${focusCoordinate[0].toFixed(6)},${focusCoordinate[1].toFixed(6)}-${cameraPaddingBottom}`
    : `bounds-${cameraPaddingBottom}`;

  return (
    <>
      {/* Camera: zoom to focused photo, or fit the full route */}
      {focusCoordinate ? (
        <MapboxGL.Camera
          key={cameraKey}
          centerCoordinate={focusCoordinate}
          zoomLevel={16}
          animationDuration={400}
          padding={{
            paddingTop: cameraPaddingTop,
            paddingBottom: cameraPaddingBottom,
            paddingLeft: 40,
            paddingRight: 40,
          }}
        />
      ) : bounds ? (
        <MapboxGL.Camera
          key={cameraKey}
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

      {/* Route polyline — single colour for 'route' mode, per-segment colour otherwise */}
      {points.length >= 2 && mode === 'route' && (
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
      {points.length >= 2 && mode !== 'route' && segmentedGeoJSON && (
        <MapboxGL.ShapeSource id="review-route-segmented" shape={segmentedGeoJSON as GeoJSON.FeatureCollection}>
          <MapboxGL.LineLayer
            id="review-route-line-segmented"
            style={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              lineColor: ['get', 'color'] as any,
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

      {/* Photo dot markers — only shown when Photos tab is active */}
      {showPhotoMarkers && photos.map((photo) => (
        <MapboxGL.PointAnnotation
          key={photo.id}
          id={`review-photo-${photo.id}`}
          coordinate={[photo.longitude, photo.latitude]}
          onSelected={() => onPhotoTap?.(photo)}
        >
          <PhotoDotPin onLongPress={() => onPhotoLongPress?.(photo)} />
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
  photoDotHitArea: {
    // Enlarged touch target around the visible dot
    padding: 6,
  },
  photoDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976d2',
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow so it lifts off the map
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
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
