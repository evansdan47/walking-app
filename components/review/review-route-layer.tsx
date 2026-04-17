import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

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

// Cone geometry constants
const DOT_R = 16;          // dot radius (px) — 32px dot diameter
const CONE_LEN = 80;       // how far the cone extends from the dot centre
const CONE_HALF_ANG = 25;  // half-angle of the cone in degrees

/** SVG camera dot with a gradient heading cone radiating outward. */
function PhotoConePin({ heading }: { heading: number | null }) {
  // SVG canvas is square: (CONE_LEN + DOT_R) on each side, dot centred at (cx, cy).
  // The cone tip starts at the dot centre and fans outward upward (north = 0°).
  const size = (CONE_LEN + DOT_R) * 2;
  const cx = size / 2;
  const cy = size / 2;

  // Cone arc points (tip at dot centre, fan opening upward before rotation)
  const ang1 = (-90 - CONE_HALF_ANG) * (Math.PI / 180);
  const ang2 = (-90 + CONE_HALF_ANG) * (Math.PI / 180);
  const x1 = cx + CONE_LEN * Math.cos(ang1);
  const y1 = cy + CONE_LEN * Math.sin(ang1);
  const x2 = cx + CONE_LEN * Math.cos(ang2);
  const y2 = cy + CONE_LEN * Math.sin(ang2);

  // Gradient runs from dot centre (opaque) to the far edge (transparent)
  const gradX2 = cx;
  const gradY2 = cy - CONE_LEN;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}
        viewBox={`0 0 ${size} ${size}`}
      >
        <Defs>
          <LinearGradient id="cone-grad" x1={cx} y1={cy} x2={gradX2} y2={gradY2} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#1565c0" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#1565c0" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {heading !== null && (
          <Path
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${CONE_LEN} ${CONE_LEN} 0 0 1 ${x2} ${y2} Z`}
            fill="url(#cone-grad)"
            transform={`rotate(${heading}, ${cx}, ${cy})`}
          />
        )}
        {/* Dot */}
        <Path
          d={`M ${cx} ${cy} m -${DOT_R} 0 a ${DOT_R} ${DOT_R} 0 1 0 ${DOT_R * 2} 0 a ${DOT_R} ${DOT_R} 0 1 0 -${DOT_R * 2} 0`}
          fill="#1565c0"
        />
        {/* White ring */}
        <Path
          d={`M ${cx} ${cy} m -${DOT_R} 0 a ${DOT_R} ${DOT_R} 0 1 0 ${DOT_R * 2} 0 a ${DOT_R} ${DOT_R} 0 1 0 -${DOT_R * 2} 0`}
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
        />
        {/* Camera icon — lens */}
        <Path
          d={`M ${cx} ${cy} m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0`}
          fill="#fff"
          opacity="0.9"
        />
        {/* Camera icon — body outline */}
        <Path
          d={`M ${cx - 10} ${cy - 5} h 20 a 2 2 0 0 1 2 2 v 9 a 2 2 0 0 1 -2 2 h -20 a 2 2 0 0 1 -2 -2 v -9 a 2 2 0 0 1 2 -2 z`}
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          opacity="0.7"
        />
      </Svg>
    </View>
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
  /** Controls how the route polyline is coloured. Defaults to 'route'. */
  mode?: RouteDisplayMode;
  /** Override the positive/negative/neutral segment colours. */
  colours?: RouteColours;
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
export function ReviewRouteLayer({ points, photos = [], onPhotoTap, mode = 'route', colours }: ReviewRouteLayerProps) {
  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(points), [points]);
  const segmentedGeoJSON = useMemo(
    () => buildSegmentedRoute(points, mode, colours),
    [points, mode, colours],
  );
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

      {/* Photo pins */}
      {photos.map((photo) => (
        <MapboxGL.PointAnnotation
          key={photo.id}
          id={`review-photo-${photo.id}`}
          coordinate={[photo.longitude, photo.latitude]}
          onSelected={() => onPhotoTap?.(photo)}
        >
          <PhotoConePin heading={photo.heading} />
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
    // kept for fallback reference but PhotoConePin uses SVG now
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1565c0',
    borderWidth: 2.5,
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
