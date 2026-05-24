/**
 * ExploreMapLayer
 *
 * Renders route markers inside the shared MapboxGL.MapView.
 *
 * Behaviour:
 *  • At low zoom (< 11) nearby route start-points are grouped into cluster pins
 *    with a count badge via a pure-JS greedy algorithm — no native Mapbox
 *    cluster support required.
 *  • At zoom ≥ 11 each route is shown as an individual coloured pin.
 *  • The currently-selected route is drawn as a coloured polyline.
 *  • Tapping a cluster pin calls onClusterZoom to zoom the camera in.
 *  • Tapping an individual pin calls onSelectRoute with the full route doc.
 */

import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';

import type { Doc } from '@/convex/_generated/dataModel';

export type PlannedRoute = Doc<'plannedRoutes'>;

export interface ExploreViewBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface RouteGroup {
  routes: PlannedRoute[];
  lat: number;
  lng: number;
}

// ── Haversine distance ────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Zoom-dependent cluster radius (metres) ────────────────────────────────────

function clusterRadius(zoom: number): number {
  if (zoom < 9) return 80000;
  if (zoom < 10) return 30000;
  if (zoom < 11) return 10000;
  if (zoom < 12) return 3000;
  return 50; // proximity groups — routes within 50 m always cluster together
}

// ── Greedy single-pass clustering ─────────────────────────────────────────────

function buildClusters(routes: PlannedRoute[], zoom: number): RouteGroup[] {
  const radius = clusterRadius(zoom);
  const assigned = new Set<string>();
  const groups: RouteGroup[] = [];

  for (const route of routes) {
    if (assigned.has(route._id)) continue;
    const fp = route.legs[0]?.points[0];
    if (!fp) continue;

    const group: PlannedRoute[] = [route];
    assigned.add(route._id);

    if (radius > 0) {
      for (const other of routes) {
        if (assigned.has(other._id)) continue;
        const op = other.legs[0]?.points[0];
        if (!op) continue;
        if (haversineM(fp.lat, fp.lng, op.lat, op.lng) <= radius) {
          group.push(other);
          assigned.add(other._id);
        }
      }
    }

    const lat =
      group.reduce((s, r) => s + (r.legs[0]?.points[0]?.lat ?? 0), 0) / group.length;
    const lng =
      group.reduce((s, r) => s + (r.legs[0]?.points[0]?.lng ?? 0), 0) / group.length;
    groups.push({ routes: group, lat, lng });
  }

  return groups;
}

// ── GeoJSON builders ──────────────────────────────────────────────────────────

function buildPinsGeoJSON(
  groups: RouteGroup[],
  selectedRouteId: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: groups.map((g, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
      properties: {
        groupId: i,
        count: g.routes.length,
        color: g.routes[0]?.legs[0]?.color ?? '#E65100',
        isSelected:
          g.routes.length === 1 && g.routes[0]?._id === selectedRouteId ? 1 : 0,
      },
    })),
  };
}

function buildRouteLineGeoJSON(route: PlannedRoute): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: route.legs
      .filter((leg) => leg.points.length >= 2)
      .map((leg) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: leg.points.map((p) => [p.lng, p.lat]),
        },
        properties: { color: leg.color },
      })),
  };
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// ── ExploreMapLayer ────────────────────────────────────────────────────────────

interface ExploreMapLayerProps {
  /** Resolved routes from ExploreSheetContent — shared to avoid a duplicate subscription. */
  routes: PlannedRoute[];
  viewBounds: ExploreViewBounds | null;
  zoom: number;
  highlightedRoute: PlannedRoute | null;
  onSelectRoute: (route: PlannedRoute) => void;
  onClusterZoom: (lat: number, lng: number, newZoom: number) => void;
  /** Called when the user taps a proximity group pin (zoom >= 12, routes within 50 m). */
  onGroupSelect: (routes: PlannedRoute[]) => void;
}

export function ExploreMapLayer({
  routes,
  viewBounds,
  zoom,
  highlightedRoute,
  onSelectRoute,
  onClusterZoom,
  onGroupSelect,
}: ExploreMapLayerProps) {

  const groups = useMemo(
    () => buildClusters(routes, zoom),
    [routes, zoom],
  );

  const pinsGeoJSON = useMemo(
    () => buildPinsGeoJSON(groups, highlightedRoute?._id ?? null),
    [groups, highlightedRoute],
  );

  const routeLineGeoJSON = useMemo(
    () => (highlightedRoute ? buildRouteLineGeoJSON(highlightedRoute) : EMPTY_FC),
    [highlightedRoute],
  );

  const handlePinPress = (event: { features?: GeoJSON.Feature[] }) => {
    const feature = event.features?.[0];
    if (!feature?.properties) return;
    const { groupId, count } = feature.properties as {
      groupId: number;
      count: number;
    };
    const group = groups[groupId];
    if (!group) return;

    if (count > 1) {
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      if (zoom >= 12) {
        // Proximity group (≤ 50 m) — show the grouped walks panel
        onGroupSelect(group.routes);
      } else {
        // Visual cluster at low zoom — zoom in to separate
        onClusterZoom(lat ?? 0, lng ?? 0, Math.min(zoom + 2.5, 15));
      }
    } else {
      // Individual pin — select it
      const route = group.routes[0];
      if (route) onSelectRoute(route);
    }
  };

  return (
    <>
      {/* Selected route polyline — drawn below pins */}
      <MapboxGL.ShapeSource id="explore-route-line" shape={routeLineGeoJSON}>
        <MapboxGL.LineLayer
          id="explore-route-casing"
          style={{
            lineColor: '#ffffff',
            lineWidth: 6,
            lineOpacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        <MapboxGL.LineLayer
          id="explore-route-fill"
          style={{
            lineColor: ['get', 'color'] as unknown as string,
            lineWidth: 3.5,
            lineOpacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      </MapboxGL.ShapeSource>

      {/* Route start-point pins */}
      <MapboxGL.ShapeSource
        id="explore-pins"
        shape={pinsGeoJSON}
        onPress={handlePinPress as any}
      >
        {/* Main circle */}
        <MapboxGL.CircleLayer
          id="explore-pin-circle"
          style={{
            circleRadius: [
              'case',
              ['>', ['get', 'count'], 1],
              16,
              10,
            ] as unknown as number,
            circleColor: ['get', 'color'] as unknown as string,
            circleStrokeWidth: 2.5,
            circleStrokeColor: '#ffffff',
            circleOpacity: 0.95,
          }}
        />
        {/* Count badge — only for clusters (count > 1) */}
        <MapboxGL.SymbolLayer
          id="explore-pin-count"
          filter={['>', ['get', 'count'], 1]}
          style={{
            textField: '{count}',
            textSize: 12,
            textColor: '#ffffff',
            textAllowOverlap: true,
            textIgnorePlacement: true,
          }}
        />
      </MapboxGL.ShapeSource>
    </>
  );
}
