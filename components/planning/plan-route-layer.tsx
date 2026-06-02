/**
 * PlanRouteLayer
 *
 * Renders the in-progress planned route inside an existing MapboxGL.MapView.
 * Visual style matches the webapp planner exactly:
 *
 *   - White-cased dark-green route line (#2E7D32)
 *   - Direction chevrons spaced every 80 px, auto-rotated along the line
 *   - Start marker: white circle, green (#2E7D32) border, play triangle
 *   - Finish marker: white circle, red (#e53935) border, red stop square
 *   - Intermediate waypoints: white circle, green border, sequential number
 *
 * No MapboxGL.MapView here — layers only, must be placed inside a MapView.
 */

import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { PlanLeg } from '@/lib/planning/route-stats';

// ── Design constants (matching webapp) ────────────────────────────────────────
const GREEN      = '#2E7D32';
const RED        = '#e53935';
const ARROW_COL  = '#0d2b10';

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenLegCoords(legs: PlanLeg[]): [number, number][] {
  const coords: [number, number][] = [];
  for (const leg of legs) {
    for (const pt of leg.points) {
      coords.push([pt.lng, pt.lat]);
    }
  }
  return coords;
}

function getControlPoints(
  legs: PlanLeg[],
): { lng: number; lat: number; index: number }[] {
  const result: { lng: number; lat: number; index: number }[] = [];
  let counter = 1;
  for (const leg of legs) {
    for (const pt of leg.points) {
      if (pt.isControlPoint) {
        result.push({ lng: pt.lng, lat: pt.lat, index: counter++ });
      }
    }
  }
  return result;
}

// ── Static empty-shape fallbacks ────────────────────────────────────────────
// Both ShapeSources are ALWAYS mounted so their Mapbox layer positions are fixed
// by JSX order (route first, markers second). If either source rendered
// conditionally, the first source to mount would sit below the second one in
// the style array — causing markers to appear behind the route line whenever
// the first control-point is placed before the second (i.e., always).
const EMPTY_LINE: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: [] },
};
const EMPTY_POINTS: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: 'FeatureCollection',
  features: [],
};

// ── Main component ────────────────────────────────────────────────────────────

interface PlanRouteLayerProps {
  legs: PlanLeg[];
}

export function PlanRouteLayer({ legs }: PlanRouteLayerProps) {
  const allCoords  = useMemo(() => flattenLegCoords(legs), [legs]);
  const controlPts = useMemo(() => getControlPoints(legs), [legs]);
  const hasLine    = allCoords.length >= 2;

  const routeGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: allCoords },
    }),
    [allCoords],
  );

  // GeoJSON for all marker points — mtype drives SymbolLayer icon selection + textField
  // When first and last control point share a location (looped walk), collapse them
  // into a single 'start-finish' feature and drop the duplicate endpoint.
  const markersGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const first = controlPts[0];
    const last  = controlPts[controlPts.length - 1];
    const isLoop =
      controlPts.length >= 2 &&
      Math.abs(first.lat - last.lat) < 1e-4 &&
      Math.abs(first.lng - last.lng) < 1e-4;
    // When looped: drop the duplicate last point so the combined pill only renders once
    const pts = isLoop ? controlPts.slice(0, -1) : controlPts;
    return {
      type: 'FeatureCollection',
      features: pts.map((cp, i) => ({
        type: 'Feature',
        id: String(cp.index),
        geometry: { type: 'Point', coordinates: [cp.lng, cp.lat] },
        properties: {
          mtype:
            i === 0 && isLoop
              ? 'start-finish'
              : i === 0
              ? 'start'
              : !isLoop && i === pts.length - 1
              ? 'finish'
              : 'waypoint',
          num: String(cp.index),
        },
      })),
    };
  }, [controlPts]);

  return (
    <>
      {/* ── Register images ── */}
      <MapboxGL.Images
        images={{
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          'route-arrow': require('@/assets/images/route-arrow.png'),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          'marker-start-full':    require('@/assets/images/marker-start-full.png'),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          'marker-finish-full':   require('@/assets/images/marker-finish-full.png'),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          'marker-waypoint-bg':   require('@/assets/images/marker-waypoint-bg.png'),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          'marker-start-finish':  require('@/assets/images/marker-start-finish.png'),
        }}
      />

      {/* ── Route polyline — always mounted; empty geometry when no line yet ── */}
      <MapboxGL.ShapeSource
        id="plan-route-source"
        shape={hasLine ? routeGeoJSON : EMPTY_LINE}
      >
          {/* White casing — declared first so it renders below the green line */}
          <MapboxGL.LineLayer
            id="plan-route-casing"
            style={{
              lineColor: '#ffffff',
              lineWidth: 7,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 0.9,
            }}
          />
          {/* Dark-green route line — declared second, renders on top of casing */}
          <MapboxGL.LineLayer
            id="plan-route-line"
            style={{
              lineColor: GREEN,
              lineWidth: 4.5,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: 1,
            }}
          />
          {/* Direction arrow circles — spaced every 80 px, auto-rotated along line */}
          <MapboxGL.SymbolLayer
            id="plan-route-arrows"
            minZoomLevel={10}
            style={{
              symbolPlacement: 'line',
              symbolSpacing: 80,
              iconImage: 'route-arrow',
              iconSize: ['interpolate', ['linear'], ['zoom'], 10, 0.55, 16, 0.85] as any,
              iconRotationAlignment: 'map',
              iconKeepUpright: false,
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
            }}
          />
        </MapboxGL.ShapeSource>

      {/* All markers — always mounted AFTER route source so markers layer is always
           above route layers in Mapbox's style array, regardless of data timing */}
      <MapboxGL.ShapeSource
        id="plan-markers-source"
        shape={controlPts.length >= 1 ? markersGeoJSON : EMPTY_POINTS}
      >
          {/* Complete PNG icons: no CircleLayer needed — all markers stay in Symbol pass */}
          <MapboxGL.SymbolLayer
            id="plan-markers-symbol"
            style={{
              iconImage: ['case',
                ['==', ['get', 'mtype'], 'start-finish'], 'marker-start-finish',
                ['==', ['get', 'mtype'], 'start'],        'marker-start-full',
                ['==', ['get', 'mtype'], 'finish'],       'marker-finish-full',
                'marker-waypoint-bg',
              ] as any,
              iconSize: 1,
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              textField: ['case',
                ['==', ['get', 'mtype'], 'waypoint'], ['get', 'num'],
                '',
              ] as any,
              textAnchor: 'center',
              textOffset: [0, 0] as any,
              textColor: ARROW_COL,
              textSize: 11,
              textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'] as any,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </MapboxGL.ShapeSource>
    </>
  );
}


