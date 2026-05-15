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
import { useQuery } from 'convex/react';
import { useMemo, useRef } from 'react';

import { api } from '@/convex/_generated/api';
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
  return 0; // individual pins
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
  viewBounds: ExploreViewBounds | null;
  zoom: number;
  selectedRoute: PlannedRoute | null;
  onSelectRoute: (route: PlannedRoute) => void;
  onClusterZoom: (lat: number, lng: number, newZoom: number) => void;
}

export function ExploreMapLayer({
  viewBounds,
  zoom,
  selectedRoute,
  onSelectRoute,
  onClusterZoom,
}: ExploreMapLayerProps) {
  const routes = useQuery(
    api.planned_routes.listWithinBounds,
    viewBounds ?? 'skip',
  ) as PlannedRoute[] | undefined;

  // ── Stabilize against auth-refresh oscillation ────────────────────────────
  // Convex re-runs queries on JWT refresh and briefly returns [] or a different
  // (smaller) set when auth context is absent.  We keep the "richest" result:
  // accept updates only when the new set has MORE routes or the same route IDs.
  const lastRoutesRef = useRef<PlannedRoute[] | null>(null);
  const lastRoutesBoundsRef = useRef<ExploreViewBounds | null>(null);

  if (viewBounds !== lastRoutesBoundsRef.current) {
    lastRoutesBoundsRef.current = viewBounds;
    lastRoutesRef.current = null; // fresh start for new viewport
  }

  if (routes !== undefined) {
    const prev = lastRoutesRef.current;
    if (prev === null) {
      lastRoutesRef.current = routes;
    } else if (routes.length > prev.length) {
      lastRoutesRef.current = routes;
    } else if (routes.length === prev.length && routes.length > 0) {
      const prevIds = new Set(prev.map(r => r._id));
      if (routes.every(r => prevIds.has(r._id))) {
        // Same content — keep stable reference, skip update
      }
      // else: same count but different IDs → auth oscillation, suppress
    }
    // else: fewer routes → auth oscillation, suppress
  }
  const knownRoutes = lastRoutesRef.current;

  const groups = useMemo(
    () => buildClusters(knownRoutes ?? [], zoom),
    [knownRoutes, zoom],
  );

  const pinsGeoJSON = useMemo(
    () => buildPinsGeoJSON(groups, selectedRoute?._id ?? null),
    [groups, selectedRoute],
  );

  const routeLineGeoJSON = useMemo(
    () => (selectedRoute ? buildRouteLineGeoJSON(selectedRoute) : EMPTY_FC),
    [selectedRoute],
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
      // Cluster — zoom in to expand it
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      onClusterZoom(lat ?? 0, lng ?? 0, Math.min(zoom + 2.5, 15));
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
            lineWidth: 7,
            lineOpacity: 0.7,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
        <MapboxGL.LineLayer
          id="explore-route-fill"
          style={{
            lineColor: ['get', 'color'] as unknown as string,
            lineWidth: 4.5,
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
        {/* Outer ring for selected pin */}
        <MapboxGL.CircleLayer
          id="explore-pin-selected-ring"
          filter={['==', ['get', 'isSelected'], 1]}
          style={{
            circleRadius: 18,
            circleColor: 'transparent',
            circleStrokeWidth: 3,
            circleStrokeColor: '#007AFF',
            circleOpacity: 0,
            circleStrokeOpacity: 0.8,
          }}
        />
        {/* Main circle */}
        <MapboxGL.CircleLayer
          id="explore-pin-circle"
          style={{
            circleRadius: [
              'case',
              ['==', ['get', 'isSelected'], 1],
              13,
              ['>', ['get', 'count'], 1],
              16,
              10,
            ] as unknown as number,
            circleColor: [
              'case',
              ['==', ['get', 'isSelected'], 1],
              '#007AFF',
              ['get', 'color'],
            ] as unknown as string,
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
