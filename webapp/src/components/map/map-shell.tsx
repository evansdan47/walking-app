'use client';

import { useUndoRedo } from '@/hooks/use-undo-redo';
import { usePreview } from '@/components/preview-context';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Popup, Source, type LayerProps, type MapMouseEvent, type MapRef } from 'react-map-gl/mapbox';
import { ExploreMapLayers, ExploreOverlay, type EnrichedRoute } from './explore-overlay';
import { ActivityOverlay, type ActivityWalkPhoto } from './activity-overlay';
import { PlannerOverlay, SEGMENT_COLOURS, bearingDeg, densifyPoints, haversineKm, toGeoJSON, toMultiGeoJSON, type ChartRange, type Leg, type Point } from './planner-overlay';
import { PLACE_TYPE_META } from './poi-add-form';
import type { Id } from '@convex/_generated/dataModel';
import { useUserPreferences } from '@/components/user-preferences-context';
import { elevationAxisLabel, formatDistanceKm, formatDistanceKmShort, formatElevationCompact } from '@/lib/format-units';

// -- Planner initial state (module-scope so it�s a stable reference) --------------
const INITIAL_LEGS: Leg[] = [
  { id: 's1', name: 'Leg 1', color: SEGMENT_COLOURS[0], points: [] },
];

// ── Route layer styles ─────────────────────────────────────────────────────────

const routeOutlineLayer: LayerProps = {
  id: 'route-outline',
  type: 'line',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
};

const routeLayer: LayerProps = {
  id: 'route-line',
  type: 'line',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': '#2E7D32', 'line-width': 4.5, 'line-opacity': 1 },
};

// White arrowhead chevrons placed every 80px along the route, auto-rotated to
// follow the line direction. Density increases naturally as the user zooms in.
const routeArrowLayer: LayerProps = {
  id: 'route-arrows',
  type: 'symbol',
  minzoom: 10,
  layout: {
    'symbol-placement': 'line',
    'symbol-spacing': 80,
    'icon-image': 'route-arrow',
    'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 16, 1.1],
    'icon-rotation-alignment': 'map',
    'icon-keep-upright': false,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  },
  paint: {
    'icon-color': '#0d2b10',
    'icon-opacity': 0.85,
  },
};

// routeBallsLayer and routeBallArrowsLayer are built dynamically inside MapShell from ballTuning state.

const rangeHighlightLayer: LayerProps = {
  id: 'elevation-range-line',
  type: 'line',
  layout: { 'line-join': 'round', 'line-cap': 'round' },
  paint: { 'line-color': '#FF9800', 'line-width': 6, 'line-opacity': 0.9 },
};

// ── URL helpers ────────────────────────────────────────────────────────────────

const DEFAULT_VIEW = { longitude: -5.22, latitude: 50.32, zoom: 12 };

function readInitialView() {
  const p = new URLSearchParams(window.location.search);
  const lat = parseFloat(p.get('lat') ?? '');
  const lng = parseFloat(p.get('lng') ?? '');
  const zoom = parseFloat(p.get('zoom') ?? '');
  return {
    longitude: Number.isFinite(lng) ? lng : DEFAULT_VIEW.longitude,
    latitude: Number.isFinite(lat) ? lat : DEFAULT_VIEW.latitude,
    zoom: Number.isFinite(zoom) ? zoom : DEFAULT_VIEW.zoom,
  };
}

// ── Route animation helpers ──────────────────────────────────────────────────

/** Cubic ease-out: fast start, gentle finish — good for drawing in a line. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Lerp two bearings across the 360° boundary. t=0 → from, t=1 → to. */
function lerpBearing(from: number, to: number, t: number): number {
  const diff = ((to - from) + 540) % 360 - 180;
  return (from + diff * t + 360) % 360;
}

/**
 * Returns the leading subset of `points` at the given fractional `progress`
 * (0 = nothing, points.length = full array). Inserts a lerped intermediate
 * point for the fractional remainder so the line tip moves smoothly.
 */
function interpolateRoute(points: Point[], progress: number): Point[] {
  const n = points.length;
  if (n === 0 || progress <= 0) return [];
  if (progress >= n) return points;
  const whole = Math.floor(progress);
  const frac = progress - whole;
  const result = points.slice(0, whole);
  if (frac > 1e-6 && whole < n) {
    const a = whole > 0 ? points[whole - 1] : points[0];
    const b = points[whole];
    result.push({ lng: a.lng + (b.lng - a.lng) * frac, lat: a.lat + (b.lat - a.lat) * frac });
  }
  return result;
}

// ── Directions API helper ─────────────────────────────────────────────────────

/**
 * Calls the Mapbox Directions API (walking profile) and returns the snapped
 * polyline between origin and destination, excluding the first coordinate
 * (which duplicates the already-committed origin point).
 */
async function fetchSnappedRoute(
  origin: Point,
  destination: Point,
  token: string,
): Promise<Point[]> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/` +
    `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)};` +
    `${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions API ${res.status}`);
  const data = (await res.json()) as {
    routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
  };
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords?.length) throw new Error('No route found');
  // Skip first coord — it duplicates the origin already committed to the route
  return coords.slice(1).map(([lng, lat]) => ({ lng, lat }));
}

// ── MapShell ──────────────────────────────────────────────────────────────────

type Mode = 'explore' | 'planner' | 'activity';

/**
 * The single-page map shell. One Map instance, mode driven by ?mode= URL param.
 * Explore and Planner are overlays rendered on top of the same map.
 * Copying the URL (?mode=&lat=&lng=&zoom=) restores the exact view.
 */
export function MapShell() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') ?? 'explore') as Mode;
  const activityWalkId = searchParams.get('walkId') as Id<'walks'> | null;
  const router = useRouter();
  const { setIsPreviewing } = usePreview();

  // Initial viewport — read from URL once on mount, never reset by re-renders
  const initialViewRef = useRef<typeof DEFAULT_VIEW | null>(null);
  if (!initialViewRef.current) initialViewRef.current = readInitialView();

  const mapRef = useRef<MapRef>(null);

  // Planner state — pointer-based undo/redo queue
  const initialLegs: Leg[] = [
    { id: 's1', name: 'Leg 1', color: SEGMENT_COLOURS[0], points: [] },
  ];
  const {
    present: legs,
    commit,
    undo: undoCmd,
    redo: redoCmd,
    reset: resetLegs,
    canUndo,
    canRedo,
  } = useUndoRedo<Leg[]>(initialLegs);
  const [activeSegmentId, setActiveSegmentId] = useState('s1');
  const [editingRoute, setEditingRoute] = useState<EnrichedRoute | null>(null);
  const [snapToPath, setSnapToPath] = useState(true);

  // -- Activity mode state --------------------------------------------------
  /** Points of the currently previewed / selected GPS track (from trackPoints). */
  const [activityTrack, setActivityTrack] = useState<Point[]>([]);
  const [activityElevHoverIdx, setActivityElevHoverIdx] = useState<number | null>(null);
  const [activityPhotos, setActivityPhotos] = useState<ActivityWalkPhoto[]>([]);
  const [activityPhotoHoverId, setActivityPhotoHoverId] = useState<Id<'walkPhotos'> | null>(null);
  const [turnaroundIdx, setTurnaroundIdx] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);

  // -- POI placement mode ----------------------------------------------------
  // When true the next map click drops a POI marker instead of a route point.
  const [poiMode, setPoiMode] = useState(false);
  const [pendingPoiLngLat, setPendingPoiLngLat] = useState<{ lng: number; lat: number } | null>(null);
  /** Mirror of PlannerOverlay's pendingPois � used only for map marker rendering. */
  const [poiMarkers, setPoiMarkers] = useState<Array<{ lngLat: { lng: number; lat: number }; type: string; name?: string }>>([]);
  const [hoveredPoiIdx, setHoveredPoiIdx] = useState<number | null>(null);
  // Hovered ball ID � drives hover highlight on the route balls circle layer
  const [hoveredBallId, setHoveredBallId] = useState<number | null>(null);
  const [hoveredBallTooltip, setHoveredBallTooltip] = useState<{ x: number; y: number; isControlPoint: boolean } | null>(null);

  // -- Ball-tuning state (adjustable via debug panel) ------------------------
  const [ballTuning] = useState({
    spacingM:       200,   // metres between balls
    radiusNear:     3.5,   // circle-radius zoomed out
    radiusFar:      13.5,  // circle-radius zoomed in
    strokeWidth:    1.5,
    color:          '#1565C0',
    opacity:        0.9,
    arrowEveryN:    1,     // show arrow on every Nth ball (0 = off)
    arrowSizeNear:  0.25,
    arrowSizeFar:   0.60,
  });
  const routeBallsLayer = useMemo((): LayerProps => ({
    id: 'route-balls',
    type: 'circle',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ballTuning.radiusNear, 16, ballTuning.radiusFar],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'hovered'], false],
        '#ffffff',
        ballTuning.color,
      ],
      'circle-stroke-width': ballTuning.strokeWidth,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': [
        'case',
        ['boolean', ['feature-state', 'hovered'], false],
        1,
        ballTuning.opacity,
      ],
    },
  }), [ballTuning.radiusNear, ballTuning.radiusFar, ballTuning.color, ballTuning.strokeWidth, ballTuning.opacity]);

  const routeBallArrowsLayer = useMemo((): LayerProps => ({
    id: 'route-ball-arrows',
    type: 'symbol',
    filter: ['==', ['get', 'hasArrow'], true],
    layout: {
      'icon-image': 'route-arrow',
      'icon-rotate': ['-', ['get', 'bearing'], 90],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, ballTuning.arrowSizeNear, 16, ballTuning.arrowSizeFar],
    },
    paint: {
      'icon-color': '#ffffff',
      'icon-opacity': 0.95,
    },
  }), [ballTuning.arrowSizeNear, ballTuning.arrowSizeFar]);

  // Viewport bounds � updated on every moveend, used by ExploreOverlay
  const [viewBounds, setViewBounds] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);

  // Explore mode: selected route (shared between ExploreMapLayers inside <Map> and ExploreOverlay panel)
  const [exploreSelectedRoute, setExploreSelectedRoute] = useState<EnrichedRoute | null>(null);
  // Elevation data for the selected explore route, sampled by ExploreMapLayers
  const [exploreRouteElevData, setExploreRouteElevData] = useState<{
    points: Array<{ lat: number; lng: number }>;
    elevations: number[];
  } | null>(null);
  const [exploreElevHoverIdx, setExploreElevHoverIdx] = useState<number | null>(null);
  // Active filter � null means no filter (show all pins)
  const [exploreFilteredIds, setExploreFilteredIds] = useState<Set<string> | null>(null);

  // Elevation chart state
  const [elevations, setElevations] = useState<number[]>([]);
  const [elevationPoints, setElevationPoints] = useState<Point[]>([]);
  const [chartHoverIdx, setChartHoverIdx] = useState<number | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange | null>(null);
  // Cache elevation by "lng,lat" key so off-screen tile eviction doesn't wipe data
  const elevationCacheRef = useRef<globalThis.Map<string, number>>(new globalThis.Map());

  // ── Flyby preview state ────────────────────────────────────────────
  const [isFlyby, setIsFlyby] = useState(false);
  const [flybyStepIdx, setFlybyStepIdx] = useState(0);
  const [flybyTotalSteps, setFlybyTotalSteps] = useState(0);
  const flybyAbortRef = useRef(false);
  const savedCameraRef = useRef<{ center: [number, number]; zoom: number; pitch: number; bearing: number } | null>(null);
  const previewRafRef = useRef<number | null>(null);

  // ── Walk-preview (chase-cam) state ───────────────────────────────
  const [isWalkPreview, setIsWalkPreview] = useState(false);
  const [walkPreviewPaused, setWalkPreviewPaused] = useState(false);
  const [walkPreviewPct, setWalkPreviewPct] = useState(0);
  const walkPreviewAbortRef = useRef(false);
  const walkPreviewRafRef = useRef<number | null>(null);
  const walkSavedCameraRef = useRef<{ center: [number, number]; zoom: number; pitch: number; bearing: number } | null>(null);
  // Stable refs for pause/seek without restarting the animation
  const walkProgressRef = useRef(0);      // 0–1
  const walkDurationRef = useRef(60_000); // ms
  const walkStartTimeRef = useRef(0);     // performance.now() at t=0
  const walkDensePointsRef = useRef<Point[]>([]);
  const walkBearingRef = useRef(0);       // smoothed camera bearing (legacy, unused)
  const walkTickRef = useRef<((now: number) => void) | null>(null);
  const walkCleanupRef = useRef<(() => void) | null>(null);
  // Preview camera state owned entirely by the rAF tick
  const previewBearingTargetRef = useRef(0);  // orbit buttons add ±45 here
  const previewBearingCurrentRef = useRef(0); // lerped toward target each frame
  const previewZoomTargetRef = useRef(16.5);  // zoom buttons set this
  const previewZoomCurrentRef = useRef(16.5);  // lerped toward target each frame
  // Playback speed multiplier (1 = normal, 2 = 2× faster)
  const walkSpeedRef = useRef(1);
  const [walkSpeed, setWalkSpeed] = useState(1);
  // Ref mirror of walkPreviewPaused so the rAF tick can read it without a closure
  const walkPausedRef = useRef(false);
  // Cumulative distance through the dense animation path (same units as haversineKm → km)
  const walkCumDistRef = useRef<number[]>([]);
  const walkDenseTotalRef = useRef(1); // total path length of dense animation array (km)

  // Derived planner state — memoized so reference only changes when legs changes,
  // preventing the animation useEffect from firing on every render.
  const allPoints = useMemo(() => legs.flatMap((s) => s.points), [legs]);
  // Active leg — the leg that receives new map clicks. Memoised so isLoop and
  // markers react to leg switches without depending on allPoints.
  const activeLeg = useMemo(
    () => legs.find(s => s.id === activeSegmentId) ?? legs[legs.length - 1],
    [legs, activeSegmentId]
  );
  // isLoop: scoped to the ACTIVE leg only so a closed previous leg does not
  // block clicks on a new empty leg.
  const isLoop =
    activeLeg.points.length >= 3 &&
    activeLeg.points[0].lng === activeLeg.points[activeLeg.points.length - 1].lng &&
    activeLeg.points[0].lat === activeLeg.points[activeLeg.points.length - 1].lat;

  // ── Animated display state ────────────────────────────────────────────────
  // `displayPoints` trails `allPoints` during animations. The GeoJSON line and
  // the end marker use `displayPoints`; all behavioural logic uses `allPoints`.
  const [displayPoints, setDisplayPoints] = useState<Point[]>([]);
  const displayPointsRef = useRef<Point[]>([]); // sync ref so effect can read current display
  const animFrameRef = useRef<number | null>(null);

  const setDisplay = useCallback((pts: Point[]) => {
    displayPointsRef.current = pts;
    setDisplayPoints(pts);
  }, []);

  useEffect(() => {
    // Cancel any in-flight animation and capture the current displayed state
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    const from = displayPointsRef.current;
    const to = allPoints;

    // Instant: clear, first point, or same-length change (e.g. reverse)
    if (to.length <= 1 || to.length === from.length) {
      setDisplay(to);
      return;
    }

    const growing = to.length > from.length;
    const changedCount = Math.abs(to.length - from.length);
    // Duration scales with number of new/removed points, capped at 1500 ms
    const duration = Math.max(500, Math.min(changedCount * 30, 1500));
    // Growing: animate from current length toward to.length through `to`
    // Shrinking: animate from current length toward to.length through `from`
    const refArray = growing ? to : from;
    const startProgress = from.length;
    const endProgress = to.length;
    const startTime = performance.now();

    const tick = (now: number) => {
      const raw = Math.min((now - startTime) / duration, 1);
      const progress = startProgress + easeOutCubic(raw) * (endProgress - startProgress);
      if (raw < 1) {
        setDisplay(interpolateRoute(refArray, progress));
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [allPoints, setDisplay]); // allPoints identity changes on every commit

  // Clear activity track when leaving activity mode
  useEffect(() => {
    if (mode !== 'activity') {
      setActivityTrack([]);
      setActivityElevHoverIdx(null);
    }
  }, [mode]);

  // Sample terrain elevation for every route change.
  // Uses a coordinate cache so points that scroll off-screen keep their elevation.
  // Only newly-seen coordinates are queried — they are always in the current viewport
  // because the user just clicked there.
  useEffect(() => {
    if (isWalkPreview) return;
    setChartRange(null);
    if (allPoints.length === 0) { setElevations([]); setElevationPoints([]); return; }
    const t = setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const cache = elevationCacheRef.current;
      // Densify straight-line segments so the chart shows real terrain
      // instead of a straight line between clicked endpoints.
      const densePoints = densifyPoints(allPoints);
      for (const p of densePoints) {
        const key = `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
        if (!cache.has(key)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = (map as any).queryTerrainElevation([p.lng, p.lat], { exaggerated: false });
          if (typeof e === 'number') cache.set(key, e);
        }
      }
      setElevationPoints(densePoints);
      setElevations(densePoints.map((p) => cache.get(`${p.lng.toFixed(6)},${p.lat.toFixed(6)}`) ?? 0));
    }, 300);
    return () => clearTimeout(t);
  }, [allPoints, isWalkPreview]);

  const handleUndo = useCallback(() => {
    setTurnaroundIdx(null);
    undoCmd();
  }, [undoCmd]);

  const handleRedo = useCallback(() => {
    setTurnaroundIdx(null);
    redoCmd();
  }, [redoCmd]);

  const handleChartHover = useCallback((idx: number | null) => setChartHoverIdx(idx), []);
  const handleChartRangeChange = useCallback((range: ChartRange | null) => setChartRange(range), []);

  const handleFlyTo = useCallback((p: Point) => {
    const map = mapRef.current;
    if (!map) return;
    const currentZoom = map.getZoom();
    // flyTo's Van Wijk & Nuij algorithm naturally arcs zoom out at the midpoint
    // then back to the original zoom. curve > 1.42 makes the arc more pronounced.
    map.flyTo({ center: [p.lng, p.lat], zoom: currentZoom, curve: 1.8, duration: 1400 });
  }, []);

  const endFlyby = useCallback(() => {
    flybyAbortRef.current = true;
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    setIsFlyby(false);
    setIsPreviewing(false);
    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) return;
    // Remove walk-preview layers/sources (no-ops if they don't exist)
    for (const id of ['preview-dot', 'preview-dot-halo', 'preview-route-white', 'preview-satellite']) {
      if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    }
    for (const id of ['preview-dot-src', 'preview-satellite-src']) {
      if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    }
    mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
    if (mapInstance.getLayer('sky')) mapInstance.removeLayer('sky');
    mapInstance.dragPan.enable();
    mapInstance.scrollZoom.enable();
    mapInstance.keyboard.enable();
    mapInstance.touchZoomRotate.enable();
    mapInstance.setPadding({ left: 0, top: 0, right: 0, bottom: 0 });
    const saved = savedCameraRef.current;
    if (saved) {
      mapInstance.flyTo({ center: saved.center, zoom: saved.zoom, pitch: saved.pitch, bearing: saved.bearing, duration: 2500 });
    }
  }, []);

  const handlePreviewFlyby = useCallback(() => {    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) return;
    const controlPoints = allPoints.filter((p) => p.isControlPoint);
    if (controlPoints.length < 2) return;
    savedCameraRef.current = {
      center: [mapInstance.getCenter().lng, mapInstance.getCenter().lat] as [number, number],
      zoom: mapInstance.getZoom(),
      pitch: mapInstance.getPitch(),
      bearing: mapInstance.getBearing(),
    };
    flybyAbortRef.current = false;
    setFlybyStepIdx(0);
    setFlybyTotalSteps(controlPoints.length);
    setIsFlyby(true);
    setIsPreviewing(true);
    mapInstance.dragPan.disable();
    mapInstance.scrollZoom.disable();
    mapInstance.keyboard.disable();
    mapInstance.touchZoomRotate.disable();
    mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.8 });
    if (!mapInstance.getLayer('sky')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mapInstance.addLayer({ id: 'sky', type: 'sky', paint: { 'sky-type': 'atmosphere', 'sky-atmosphere-sun': [0.0, 90.0], 'sky-atmosphere-sun-intensity': 15 } } as any);
    }
    const flyStep = (step: number) => {
      if (flybyAbortRef.current) return;
      if (step >= controlPoints.length) { endFlyby(); return; }
      const pt = controlPoints[step];
      const nextPt = controlPoints[step + 1] ?? null;
      const prevPt = step > 0 ? controlPoints[step - 1] : null;
      const bearing = nextPt ? bearingDeg(pt, nextPt) : prevPt ? bearingDeg(prevPt, pt) : 0;
      const distKm = nextPt ? haversineKm(pt, nextPt) : 0;
      const zoom = distKm > 2 ? 13.5 : distKm > 0.5 ? 14.5 : 15.5;
      const duration = step === 0 ? 2500 : Math.max(4000, Math.min(distKm * 7000, 12000));
      const pitch = step === 0 ? 50 : 65;
      setFlybyStepIdx(step);
      mapInstance.flyTo({ center: [pt.lng, pt.lat], zoom, pitch, bearing, duration, essential: true });
      mapInstance.once('moveend', () => { if (!flybyAbortRef.current) flyStep(step + 1); });
    };
    flyStep(0);
  }, [allPoints, endFlyby]);

  const endWalkPreview = useCallback(() => {
    walkPreviewAbortRef.current = true;
    if (walkPreviewRafRef.current !== null) {
      cancelAnimationFrame(walkPreviewRafRef.current);
      walkPreviewRafRef.current = null;
    }
    walkCleanupRef.current?.();
    walkCleanupRef.current = null;
    setIsWalkPreview(false);
    setIsPreviewing(false);
    setWalkPreviewPaused(false);
    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance) return;
    for (const id of ['walk-dot', 'walk-dot-pulse', 'walk-dot-halo', 'walk-route-white', 'walk-route-orange', 'walk-satellite']) {
      if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    }
    for (const id of ['walk-dot-src', 'walk-satellite-src', 'walk-preview-route', 'walk-traversed-src']) {
      if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    }
    mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
    (mapInstance as any).setFog(null);
    // Restore hidden label layers
    const RESTORE_LABELS = [
      'contour-label',
      'road-label',
      'road-number-shield',
      'poi-label',
      'transit-label',
      'airport-label',
      'settlement-subdivision-label',
      'settlement-minor-label',
      'settlement-major-label',
      'state-label',
      'country-label',
    ];
    for (const id of RESTORE_LABELS) {
      if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'visible');
    }
    mapInstance.dragPan.enable();
    mapInstance.scrollZoom.enable();
    mapInstance.dragRotate.enable();
    mapInstance.keyboard.enable();
    mapInstance.touchZoomRotate.enable();
    mapInstance.setPadding({ left: 0, top: 0, right: 0, bottom: 0 });
    const saved = walkSavedCameraRef.current;
    if (saved) mapInstance.flyTo({ center: saved.center, zoom: saved.zoom, pitch: saved.pitch, bearing: saved.bearing, duration: 2500 });
  }, []);

  const pauseWalkPreview = useCallback(() => {
    walkPausedRef.current = true;
    setWalkPreviewPaused(true);
  }, []);

  const resumeWalkPreview = useCallback(() => {
    if (!isWalkPreview || walkPreviewAbortRef.current) return;
    // Shift start time forward by however long we were paused so position is preserved
    walkStartTimeRef.current = performance.now() - (walkProgressRef.current * walkDurationRef.current) / walkSpeedRef.current;
    walkPausedRef.current = false;
    setWalkPreviewPaused(false);
  }, [isWalkPreview]);

  const seekWalkPreview = useCallback((t: number) => {
    const ct = Math.max(0, Math.min(1, t));
    walkProgressRef.current = ct;
    walkStartTimeRef.current = performance.now() - ct * walkDurationRef.current;
    setWalkPreviewPct(Math.round(ct * 100));
    const mapInstance = mapRef.current?.getMap();
    const densePoints = walkDensePointsRef.current;
    const cumDist = walkCumDistRef.current;
    const denseTotal = walkDenseTotalRef.current;
    if (!mapInstance || densePoints.length < 2) return;
    // Distance-based lookup so seek aligns with the elevation chart cursor
    const targetDist = ct * denseTotal;
    let lo = 0, hi = densePoints.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cumDist[mid] <= targetDist) lo = mid; else hi = mid; }
    const segLen = cumDist[hi] - cumDist[lo];
    const frac = segLen === 0 ? 0 : (targetDist - cumDist[lo]) / segLen;
    const a = densePoints[lo];
    const b = densePoints[hi];
    const lng = a.lng + (b.lng - a.lng) * frac;
    const lat = a.lat + (b.lat - a.lat) * frac;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mapInstance.getSource('walk-dot-src') as any)?.setData({
      type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {},
    });
    // Keep camera in sync for seek while paused
    mapInstance.jumpTo({
      center: [lng, lat],
      bearing: previewBearingCurrentRef.current,
      zoom: previewZoomCurrentRef.current,
      pitch: 68,
    });
  }, []);

  // Camera control callbacks — mutate refs directly; rAF tick picks them up next frame
  const zoomInPreview = useCallback(() => {
    previewZoomTargetRef.current = Math.min(previewZoomTargetRef.current + 1, 20);
  }, []);

  const zoomOutPreview = useCallback(() => {
    previewZoomTargetRef.current = Math.max(previewZoomTargetRef.current - 1, 10);
  }, []);

  const orbitLeftPreview = useCallback(() => {
    previewBearingTargetRef.current = previewBearingTargetRef.current - 45;
  }, []);

  const orbitRightPreview = useCallback(() => {
    previewBearingTargetRef.current = previewBearingTargetRef.current + 45;
  }, []);

  const speedUpPreview = useCallback(() => {
    const next = Math.min(parseFloat((walkSpeedRef.current + 0.5).toFixed(2)), 4);
    walkSpeedRef.current = next;
    setWalkSpeed(next);
    // Recalculate start time so current progress position is preserved
    walkStartTimeRef.current = performance.now() - (walkProgressRef.current * walkDurationRef.current) / next;
  }, []);

  const speedDownPreview = useCallback(() => {
    const next = Math.max(parseFloat((walkSpeedRef.current - 0.5).toFixed(2)), 0.25);
    walkSpeedRef.current = next;
    setWalkSpeed(next);
    walkStartTimeRef.current = performance.now() - (walkProgressRef.current * walkDurationRef.current) / next;
  }, []);

  const handleWalkPreview = useCallback((pointsOverride?: Point[]) => {
    const mapInstance = mapRef.current?.getMap();
    const pts = pointsOverride ?? allPoints;
    if (!mapInstance || pts.length < 2) return;
    const densePoints = densifyPoints(pts, 0.01);
    if (densePoints.length < 2) return;
    let totalDistKm = 0;
    for (let i = 1; i < pts.length; i++) totalDistKm += haversineKm(pts[i - 1], pts[i]);
    // ~10 km/h preview speed, clamped 20 s – 120 s
    const DURATION = Math.max(20_000, Math.min((totalDistKm / 10) * 3_600_000, 120_000));

    walkDensePointsRef.current = densePoints;
    walkDurationRef.current = DURATION;

    // Precompute cumulative distance through the dense array so the tick can map
    // t (0-1 time fraction) to a distance-proportional position, matching the
    // elevation chart which also plots by cumulative distance.
    const cumDist = new Array<number>(densePoints.length).fill(0);
    for (let i = 1; i < densePoints.length; i++) cumDist[i] = cumDist[i - 1] + haversineKm(densePoints[i - 1], densePoints[i]);
    const denseDistTotal = cumDist[densePoints.length - 1] || 1;
    walkCumDistRef.current = cumDist;
    walkDenseTotalRef.current = denseDistTotal;

    // Binary-search helper: given t (0-1 fraction of total distance), return
    // the interpolated geographic position on the dense path.
    const interpAtT = (t: number) => {
      const targetDist = Math.max(0, Math.min(t, 1)) * denseDistTotal;
      let lo = 0, hi = densePoints.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cumDist[mid] <= targetDist) lo = mid; else hi = mid; }
      const segLen = cumDist[hi] - cumDist[lo];
      const frac = segLen === 0 ? 0 : (targetDist - cumDist[lo]) / segLen;
      const a = densePoints[lo], b = densePoints[hi];
      return { lng: a.lng + (b.lng - a.lng) * frac, lat: a.lat + (b.lat - a.lat) * frac };
    };
    walkProgressRef.current = 0;
    walkBearingRef.current = 0;
    walkSavedCameraRef.current = {
      center: [mapInstance.getCenter().lng, mapInstance.getCenter().lat] as [number, number],
      zoom: mapInstance.getZoom(), pitch: mapInstance.getPitch(), bearing: mapInstance.getBearing(),
    };
    walkPreviewAbortRef.current = false;
    walkPausedRef.current = false;
    walkSpeedRef.current = 1;
    setWalkSpeed(1);
    setWalkPreviewPct(0);
    setWalkPreviewPaused(false);
    setIsWalkPreview(true);
    setIsPreviewing(true);

    // Disable all interactions — the rAF tick owns the full camera state each frame
    mapInstance.dragPan.disable();
    mapInstance.dragRotate.disable();
    mapInstance.scrollZoom.disable();
    mapInstance.keyboard.disable();

    // Hide noisy label layers � contour elevations, roads, POIs etc.
    // Keep 'natural-label' visible so summit/peak names still show.
    const HIDE_LABELS = [
      'contour-label',
      'road-label',
      'road-number-shield',
      'poi-label',
      'transit-label',
      'airport-label',
      'settlement-subdivision-label',
      'settlement-minor-label',
      'settlement-major-label',
      'state-label',
      'country-label',
    ];
    for (const id of HIDE_LABELS) {
      if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'none');
    }

    // Terrain + atmosphere
    mapInstance.setTerrain({ source: 'mapbox-dem', exaggeration: 1.8 });
    // Fog: range < 1.0 = inside the visible frustum (1.0 = horizon).
    // [0.4, 8] means fog starts at 40% of view distance and is fully opaque at 8� that.
    // This causes Mapbox to deprioritise/skip requesting tiles beyond the fog cutoff,
    // significantly reducing satellite tile fetches for far-off areas.
    (mapInstance as any).setFog({
      'range': [0.2, 2.5],
      'color': 'rgba(15, 25, 45, 1)',
      'high-color': 'rgba(5, 10, 25, 0.97)',
      'horizon-blend': 0.35,
      'star-intensity': 0.1,
    });
    // No sky layer � it competes with fog at the horizon and adds tiles

    // Satellite underlay below existing route layers
    if (!mapInstance.getSource('walk-satellite-src')) {
      mapInstance.addSource('walk-satellite-src', { type: 'raster', url: 'mapbox://mapbox.satellite', tileSize: 512 });
    }
    const satBefore = mapInstance.getLayer('route-outline') ? 'route-outline' : undefined;
    if (!mapInstance.getLayer('walk-satellite')) {
      mapInstance.addLayer({ id: 'walk-satellite', type: 'raster', source: 'walk-satellite-src' }, satBefore);
    }
    // White route overlay for legibility on satellite.
    // In explore mode pts come via pointsOverride � add a dedicated source so
    // the correct route is shown rather than the (empty) planner 'route' source.
    const routeLineGeoJSON = {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: pts.map((p) => [p.lng, p.lat]) },
        properties: {},
      }],
    };
    if (!mapInstance.getSource('walk-preview-route')) {
      mapInstance.addSource('walk-preview-route', { type: 'geojson', data: routeLineGeoJSON });
    } else {
      (mapInstance.getSource('walk-preview-route') as mapboxgl.GeoJSONSource).setData(routeLineGeoJSON);
    }
    if (!mapInstance.getLayer('walk-route-white')) {
      mapInstance.addLayer({ id: 'walk-route-white', type: 'line', source: 'walk-preview-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': 'rgba(255,255,255,0.75)', 'line-width': 3.5 } });
    }
    // Orange traversed-portion line � updated every rAF frame
    const emptyLine = { type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: [[densePoints[0].lng, densePoints[0].lat]] }, properties: {} };
    if (!mapInstance.getSource('walk-traversed-src')) {
      mapInstance.addSource('walk-traversed-src', { type: 'geojson', data: emptyLine });
    }
    if (!mapInstance.getLayer('walk-route-orange')) {
      mapInstance.addLayer({ id: 'walk-route-orange', type: 'line', source: 'walk-traversed-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#E65100', 'line-width': 4, 'line-opacity': 0.95 } });
    }
    // Dot GeoJSON source + halo + dot
    const dotGeoJSON = { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [densePoints[0].lng, densePoints[0].lat] }, properties: {} };
    if (!mapInstance.getSource('walk-dot-src')) mapInstance.addSource('walk-dot-src', { type: 'geojson', data: dotGeoJSON });
    if (!mapInstance.getLayer('walk-dot-halo')) {
      mapInstance.addLayer({ id: 'walk-dot-halo', type: 'circle', source: 'walk-dot-src',
        paint: { 'circle-radius': 14, 'circle-color': '#ffffff', 'circle-opacity': 0.22, 'circle-pitch-alignment': 'map' } });
    }
    // Sonar pulse ring — radius and opacity driven each frame by setPaintProperty
    if (!mapInstance.getLayer('walk-dot-pulse')) {
      mapInstance.addLayer({ id: 'walk-dot-pulse', type: 'circle', source: 'walk-dot-src',
        paint: { 'circle-radius': 6, 'circle-color': 'transparent', 'circle-stroke-color': '#E65100',
                 'circle-stroke-width': 5, 'circle-stroke-opacity': 0.9, 'circle-pitch-alignment': 'map' } });
    }
    if (!mapInstance.getLayer('walk-dot')) {
      mapInstance.addLayer({ id: 'walk-dot', type: 'circle', source: 'walk-dot-src',
        paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': 'rgba(230,81,0,0.9)', 'circle-stroke-width': 2.5, 'circle-pitch-alignment': 'map' } });
    }

    walkCleanupRef.current = () => {
      mapInstance.dragPan.enable();
      mapInstance.dragRotate.enable();
      mapInstance.scrollZoom.enable();
      mapInstance.keyboard.enable();
    };

    // rAF tick — runs continuously (even when paused) for smooth camera + pulse.
    // Position advance and dot update only happen when not paused.
    // interpAtT maps t (time fraction 0-1) → distance-proportional position so
    // the puck stays in sync with the distance-based elevation chart cursor.
    const tick = (now: number) => {
      if (walkPreviewAbortRef.current) return;

      const paused = walkPausedRef.current;

      // ─ Position ─ only advance when playing
      let targetLng: number;
      let targetLat: number;
      if (!paused) {
        const t = Math.min((now - walkStartTimeRef.current) * walkSpeedRef.current / walkDurationRef.current, 1);
        walkProgressRef.current = t;
        const pos = interpAtT(t);
        targetLng = pos.lng;
        targetLat = pos.lat;
        // Update dot position
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstance.getSource('walk-dot-src') as any)?.setData({
          type: 'Feature', geometry: { type: 'Point', coordinates: [targetLng, targetLat] }, properties: {},
        });
        setWalkPreviewPct(Math.round(t * 100));
        if (t >= 1) { endWalkPreview(); return; }
      } else {
        // While paused, keep start time rolling so resume picks up correctly
        walkStartTimeRef.current = performance.now() - (walkProgressRef.current * walkDurationRef.current) / walkSpeedRef.current;
        // Recompute current coordinates from frozen progress for camera centre
        const pos = interpAtT(walkProgressRef.current);
        targetLng = pos.lng;
        targetLat = pos.lat;
      }

      // - Traversed orange line - always (works during play and pause)
      {
        const tTrav = walkProgressRef.current;
        const targetDistTrav = Math.max(0, Math.min(tTrav, 1)) * denseDistTotal;
        let loTrav = 0, hiTrav = densePoints.length - 1;
        while (hiTrav - loTrav > 1) { const midTrav = (loTrav + hiTrav) >> 1; if (cumDist[midTrav] <= targetDistTrav) loTrav = midTrav; else hiTrav = midTrav; }
        const travCoords = [
          ...densePoints.slice(0, loTrav + 1).map((p: { lng: number; lat: number }) => [p.lng, p.lat]),
          [targetLng!, targetLat!],
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstance.getSource('walk-traversed-src') as any)?.setData({
          type: 'Feature', geometry: { type: 'LineString', coordinates: travCoords }, properties: {},
        });
      }

      // ─ Bearing lerp ─ always
      previewBearingCurrentRef.current = lerpBearing(
        previewBearingCurrentRef.current,
        previewBearingTargetRef.current,
        0.12,
      );

      // ─ Zoom lerp ─ always
      previewZoomCurrentRef.current += (previewZoomTargetRef.current - previewZoomCurrentRef.current) * 0.12;

      // ─ Sonar pulse ─ always
      const pulseT = (now % 1500) / 1500;
      if (mapInstance.getLayer('walk-dot-pulse')) {
        mapInstance.setPaintProperty('walk-dot-pulse', 'circle-radius', 6 + pulseT * 84);
        mapInstance.setPaintProperty('walk-dot-pulse', 'circle-stroke-width', 5 * (1 - pulseT) + 1);
        mapInstance.setPaintProperty('walk-dot-pulse', 'circle-stroke-opacity', 0.9 * (1 - pulseT));
      }

      // ─ Camera ─ always (so orbit/zoom work while paused)
      mapInstance.jumpTo({
        center: [targetLng!, targetLat!],
        bearing: previewBearingCurrentRef.current,
        zoom: previewZoomCurrentRef.current,
        pitch: 68,
      });

      walkPreviewRafRef.current = requestAnimationFrame(tick);
    };
    walkTickRef.current = tick;

    const startBearing = densePoints.length > 10
      ? bearingDeg(densePoints[0], densePoints[Math.min(10, densePoints.length - 1)]) : 0;

    // Sample terrain elevations for the elevation chart.
    // For explore-route overrides (pointsOverride) we must populate elevation state here
    // since allPoints hasn't changed. For planner routes, the elevation useEffect will
    // re-run from cache when isWalkPreview returns to false � no override needed here.
    if (pointsOverride) {
      setTimeout(() => {
        if (walkPreviewAbortRef.current) return;
        const cache = elevationCacheRef.current;
        for (const p of densePoints) {
          const key = `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
          if (!cache.has(key)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e = (mapInstance as any).queryTerrainElevation([p.lng, p.lat], { exaggerated: false });
            if (typeof e === 'number') cache.set(key, e);
          }
        }
        setElevationPoints(densePoints);
        setElevations(densePoints.map((p) => cache.get(`${p.lng.toFixed(6)},${p.lat.toFixed(6)}`) ?? 0));
      }, 800);
    }

    // Phase 1: Overhead view — pull back for context
    mapInstance.flyTo({ center: [densePoints[0].lng, densePoints[0].lat], zoom: 13.5, pitch: 50, bearing: startBearing, duration: 2500, essential: true });
    // Phase 2: Zoom in to chase-cam altitude, then start rAF
    mapInstance.once('moveend', () => {
      if (walkPreviewAbortRef.current) return;
      mapInstance.flyTo({ center: [densePoints[0].lng, densePoints[0].lat], zoom: 16.5, pitch: 70, bearing: startBearing, duration: 2000, essential: true });
      mapInstance.once('moveend', () => {
        if (walkPreviewAbortRef.current) return;
        // Initialise camera refs from the fly-in end state
        previewBearingTargetRef.current = startBearing;
        previewBearingCurrentRef.current = startBearing;
        previewZoomTargetRef.current = mapInstance.getZoom();
        previewZoomCurrentRef.current = mapInstance.getZoom();
        walkPausedRef.current = false;
        walkStartTimeRef.current = performance.now();
        walkPreviewRafRef.current = requestAnimationFrame(tick);
      });
    });
  }, [allPoints, endWalkPreview]);

  /** Called by ActivityOverlay to fit the map to a GPS track's bounding box. */
  const handleFitBounds = useCallback((bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
      { padding: 60, duration: 900 },
    );
  }, []);

  /** Load a route into the planner for editing, then navigate to planner mode. */
  const handleEditRoute = useCallback((route: EnrichedRoute) => {
    const legs = route.legs as Leg[];
    resetLegs(legs);
    setEditingRoute(route);
    // Sync activeSegmentId to the first leg of the loaded route so
    // activeLegStartFi = 0 and per-waypoint flatIdx values stay in range.
    setActiveSegmentId(legs[0]?.id ?? 's1');
    const params = new URLSearchParams(window.location.search);
    params.set('mode', 'planner');
    router.push(`/map?${params.toString()}`);
  }, [resetLegs, router]);

  /** Called after a successful save/update. Clears edit state and returns to Explore. */
  const handleRouteSaved = useCallback((_id: Id<'plannedRoutes'>) => {
    setEditingRoute(null);
    setPoiMarkers([]);
    resetLegs(INITIAL_LEGS);
    const params = new URLSearchParams(window.location.search);
    params.set('mode', 'explore');
    router.push(`/map?${params.toString()}`);
  }, [resetLegs, router]);

  /** Preview an explore-mode route without loading it into planner legs. */
  const handlePreviewExploreRoute = useCallback((route: EnrichedRoute) => {
    const pts: Point[] = route.legs.flatMap((leg: { points: Array<{ lng: number; lat: number }> }) =>
      leg.points.map((p) => ({ lng: p.lng, lat: p.lat }))
    );
    setExploreSelectedRoute(null);
    handleWalkPreview(pts);
  }, [handleWalkPreview]);

  // Map interaction handlers
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Seed initial viewport bounds for ExploreOverlay
    const b = map.getBounds();
    if (b) setViewBounds({ minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() });
    // Enable terrain DEM so queryTerrainElevation works for the elevation chart
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
    }
    if (!map.hasImage('route-arrow')) {
      // -- Arrow image -----------------------------------------------------
      // Draw a right-pointing filled arrowhead on an offscreen canvas, then
      // add it as an SDF image so `icon-color` can tint it at render time.
      const size = 22;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(3, 2);    // top-back corner
        ctx.lineTo(19, 11);  // arrow tip
        ctx.lineTo(3, 20);   // bottom-back corner
        ctx.lineTo(8, 11);   // inner notch
        ctx.closePath();
        ctx.fill();
        const { data } = ctx.getImageData(0, 0, size, size);
        map.addImage('route-arrow', { width: size, height: size, data }, { sdf: true });
      }
    }

  }, []);

  // -- Route balls -----------------------------------------------------------
  // Sample displayPoints at even intervals for the interactive ball layer.
  // Stores bearing + hasArrow so the arrow symbol layer can filter/rotate inline.
  const routeBallPoints = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point> | null>(() => {
    if (displayPoints.length < 2) return null;
    const SPACING_KM = ballTuning.spacingM / 1000;
    const arrowN = ballTuning.arrowEveryN;
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    let accumulated = 0;
    let nextThreshold = 0;
    let ballCount = 0;
    for (let i = 0; i < displayPoints.length; i++) {
      if (i > 0) accumulated += haversineKm(displayPoints[i - 1], displayPoints[i]);
      if (accumulated >= nextThreshold) {
        // Bearing from this point to next sampled point (or previous if at end)
        const a = displayPoints[Math.max(0, i - 1)];
        const b = displayPoints[Math.min(displayPoints.length - 1, i + 1)];
        const bearing = bearingDeg(a, b);
        const hasArrow = arrowN > 0 && ballCount % arrowN === 0;
        features.push({
          type: 'Feature',
          id: i,
          geometry: { type: 'Point', coordinates: [displayPoints[i].lng, displayPoints[i].lat] },
          properties: { idx: i, bearing, hasArrow },
        });
        nextThreshold += SPACING_KM;
        ballCount++;
      }
    }
    return { type: 'FeatureCollection', features };
  }, [displayPoints, ballTuning.spacingM, ballTuning.arrowEveryN]);

  // Insert a mid-route control point at the clicked ball's position.
  // Marks the underlying point as a control point without moving it � the route
  // doesn't change visually, but a draggable handle appears.
  const insertMidRouteControlPoint = useCallback((displayIdx: number) => {
    const pt = displayPoints[displayIdx];
    if (!pt || pt.isControlPoint) return;
    // Find which leg and local index this display point belongs to
    let legIdx = -1, localIdx = -1, cumulative = 0;
    for (let li = 0; li < legs.length; li++) {
      const legLen = legs[li].points.length;
      if (cumulative + legLen > displayIdx) {
        legIdx = li;
        localIdx = displayIdx - cumulative;
        break;
      }
      cumulative += legLen;
    }
    if (legIdx === -1) return;
    commit(prev => {
      const next = [...prev];
      const pts = [...next[legIdx].points];
      pts[localIdx] = { ...pts[localIdx], isControlPoint: true };
      next[legIdx] = { ...next[legIdx], points: pts };
      return next;
    });
  }, [displayPoints, legs, commit]);

  // Drag an existing control point to reroute. Re-snaps the two flanking
  // segments (prevCP?newPos and newPos?nextCP) in the same leg.
  const handleControlPointDragEnd = useCallback(async (
    allPtIdx: number,
    newLng: number,
    newLat: number,
  ) => {
    // Locate which leg and local index
    let legIdx = -1, localIdx = -1, cumulative = 0;
    for (let li = 0; li < legs.length; li++) {
      const legLen = legs[li].points.length;
      if (cumulative + legLen > allPtIdx) {
        legIdx = li;
        localIdx = allPtIdx - cumulative;
        break;
      }
      cumulative += legLen;
    }
    if (legIdx === -1) return;
    const legPts = legs[legIdx].points;
    // Find flanking control points within this leg
    let prevCpIdx = -1;
    for (let i = localIdx - 1; i >= 0; i--) {
      if (legPts[i].isControlPoint) { prevCpIdx = i; break; }
    }
    let nextCpIdx = legPts.length;
    for (let i = localIdx + 1; i < legPts.length; i++) {
      if (legPts[i].isControlPoint) { nextCpIdx = i; break; }
    }
    const newPos = { lng: newLng, lat: newLat };
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
    setIsPending(true);
    try {
      const prevCP = prevCpIdx >= 0 ? legPts[prevCpIdx] : null;
      const nextCP = nextCpIdx < legPts.length ? legPts[nextCpIdx] : null;
      // Build new points: keep everything before prevCP, then re-snap around newPos
      let newPts: Point[] = [...legPts.slice(0, prevCpIdx >= 0 ? prevCpIdx + 1 : 0)];
      if (prevCP && snapToPath) {
        const seg1 = await fetchSnappedRoute(prevCP, newPos, token);
        newPts = [...newPts, ...seg1];
      }
      const newCp: Point = { ...newPos, isControlPoint: true, isSnapped: !!prevCP && snapToPath };
      newPts = [...newPts, newCp];
      if (nextCP && snapToPath) {
        const seg2 = await fetchSnappedRoute(newPos, nextCP, token);
        newPts = [...newPts, ...seg2];
        newPts = [...newPts, { ...nextCP, isControlPoint: true, isSnapped: true }];
      } else if (nextCP) {
        newPts = [...newPts, ...legPts.slice(localIdx + 1, nextCpIdx + 1)];
      }
      // Append anything after nextCP unchanged
      newPts = [...newPts, ...legPts.slice(nextCpIdx + 1)];
      commit(prev => {
        const next = [...prev];
        next[legIdx] = { ...next[legIdx], points: newPts };
        return next;
      });
    } catch {
      // Fallback: just move the point, no re-snap
      commit(prev => {
        const next = [...prev];
        const pts = [...next[legIdx].points];
        pts[localIdx] = { ...newPos, isControlPoint: true, isSnapped: false };
        next[legIdx] = { ...next[legIdx], points: pts };
        return next;
      });
    } finally {
      setIsPending(false);
    }
  }, [legs, snapToPath, commit]);

  // Drag the start (or loop) marker to reposition the first point of a leg.
  // Re-snaps only the adjacent outbound segment (and, for loops, the closing segment).
  const handleStartDragEnd = useCallback(async (legId: string, newLng: number, newLat: number) => {
    const legIdx = legs.findIndex(l => l.id === legId);
    if (legIdx === -1) return;
    const legPts = legs[legIdx].points;
    if (legPts.length === 0) return;

    const newStart: Point = { lng: newLng, lat: newLat, isControlPoint: true, isSnapped: false };

    const legIsLoop =
      legPts.length >= 3 &&
      legPts[0].lng === legPts[legPts.length - 1].lng &&
      legPts[0].lat === legPts[legPts.length - 1].lat;

    // First CP after index 0 (for loops, exclude the closing duplicate at [len-1])
    const fwdLimit = legIsLoop ? legPts.length - 1 : legPts.length;
    let nextCpIdx = -1;
    for (let i = 1; i < fwdLimit; i++) {
      if (legPts[i].isControlPoint) { nextCpIdx = i; break; }
    }
    // For loops: last CP before the closing duplicate
    let prevCpIdx = -1;
    if (legIsLoop) {
      for (let i = legPts.length - 2; i >= 1; i--) {
        if (legPts[i].isControlPoint) { prevCpIdx = i; break; }
      }
    }

    setIsPending(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
      if (!legIsLoop) {
        if (snapToPath && nextCpIdx >= 0) {
          const nextCP = legPts[nextCpIdx];
          const seg = await fetchSnappedRoute(newStart, nextCP, token);
          commit(prev => {
            const next = [...prev];
            next[legIdx] = { ...next[legIdx], points: [newStart, ...seg, { ...nextCP, isControlPoint: true, isSnapped: true }, ...legPts.slice(nextCpIdx + 1)] };
            return next;
          });
        } else {
          const rest = nextCpIdx >= 0 ? legPts.slice(nextCpIdx) : legPts.slice(1);
          commit(prev => {
            const next = [...prev];
            next[legIdx] = { ...next[legIdx], points: [newStart, ...rest] };
            return next;
          });
        }
      } else {
        if (snapToPath && nextCpIdx >= 0) {
          const nextCP = legPts[nextCpIdx];
          const prevCP = prevCpIdx >= 0 ? legPts[prevCpIdx] : null;
          const seg1 = await fetchSnappedRoute(newStart, nextCP, token);
          const seg2 = prevCP ? await fetchSnappedRoute(prevCP, newStart, token) : [];
          // Preserve the unchanged middle section between nextCP and prevCP
          const middle = prevCpIdx > nextCpIdx ? legPts.slice(nextCpIdx + 1, prevCpIdx + 1) : [];
          commit(prev => {
            const next = [...prev];
            next[legIdx] = {
              ...next[legIdx],
              points: [newStart, ...seg1, { ...nextCP, isControlPoint: true, isSnapped: true }, ...middle, ...seg2, { ...newStart }],
            };
            return next;
          });
        } else {
          commit(prev => {
            const next = [...prev];
            next[legIdx] = { ...next[legIdx], points: [newStart, ...legPts.slice(1, -1), { ...newStart }] };
            return next;
          });
        }
      }
    } catch {
      const fallback = legIsLoop
        ? [newStart, ...legPts.slice(1, -1), { ...newStart }]
        : [newStart, ...legPts.slice(1)];
      commit(prev => { const next = [...prev]; next[legIdx] = { ...next[legIdx], points: fallback }; return next; });
    } finally {
      setIsPending(false);
    }
  }, [legs, snapToPath, commit]);

  // Drag the end marker to reposition the last point of the active leg.
  // Re-snaps only the segment from the previous control point to the new end.
  const handleEndDragEnd = useCallback(async (newLng: number, newLat: number) => {
    const legIdx = legs.findIndex(l => l.id === activeSegmentId);
    if (legIdx === -1) return;
    const legPts = legs[legIdx].points;
    if (legPts.length < 2) return;

    const newEnd: Point = { lng: newLng, lat: newLat, isControlPoint: true, isSnapped: false };

    // Find the previous CP (second-to-last control point)
    let prevCpIdx = -1;
    for (let i = legPts.length - 2; i >= 0; i--) {
      if (legPts[i].isControlPoint) { prevCpIdx = i; break; }
    }

    setIsPending(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
      if (snapToPath && prevCpIdx >= 0) {
        const prevCP = legPts[prevCpIdx];
        const seg = await fetchSnappedRoute(prevCP, newEnd, token);
        commit(prev => {
          const next = [...prev];
          next[legIdx] = { ...next[legIdx], points: [...legPts.slice(0, prevCpIdx + 1), ...seg, newEnd] };
          return next;
        });
      } else {
        commit(prev => {
          const next = [...prev];
          const pts = [...next[legIdx].points];
          pts[pts.length - 1] = newEnd;
          next[legIdx] = { ...next[legIdx], points: pts };
          return next;
        });
      }
    } catch {
      commit(prev => {
        const next = [...prev];
        const pts = [...next[legIdx].points];
        pts[pts.length - 1] = newEnd;
        next[legIdx] = { ...next[legIdx], points: pts };
        return next;
      });
    } finally {
      setIsPending(false);
    }
  }, [legs, activeSegmentId, snapToPath, commit]);

  // Ball hover � track hovered feature ID and update Mapbox feature state.
  const handleBallMouseMove = useCallback((e: MapMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map || !map.getLayer('route-balls')) return;
    const features = map.queryRenderedFeatures(e.point, { layers: ['route-balls'] });
    if (features.length > 0) {
      const id = features[0].id as number;
      const idx = features[0].properties?.idx as number | undefined;
      const isControlPoint = idx !== undefined && !!displayPointsRef.current[idx]?.isControlPoint;
      setHoveredBallId(prev => {
        if (prev !== null && prev !== id) {
          if (map.getSource('route-balls')) map.setFeatureState({ source: 'route-balls', id: prev }, { hovered: false });
        }
        if (map.getSource('route-balls')) map.setFeatureState({ source: 'route-balls', id }, { hovered: true });
        return id;
      });
      setHoveredBallTooltip({ x: e.point.x, y: e.point.y, isControlPoint });
      map.getCanvas().style.cursor = isControlPoint ? 'grab' : 'pointer';
    } else {
      setHoveredBallId(prev => {
        if (prev !== null) {
          if (map.getSource('route-balls')) map.setFeatureState({ source: 'route-balls', id: prev }, { hovered: false });
        }
        return null;
      });
      setHoveredBallTooltip(null);
      map.getCanvas().style.cursor = '';
    }
  }, []);

  const handleMoveEnd = useCallback(
    (evt: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
      const { longitude, latitude, zoom } = evt.viewState;
      const params = new URLSearchParams(window.location.search);
      params.set('lat', latitude.toFixed(5));
      params.set('lng', longitude.toFixed(5));
      params.set('zoom', zoom.toFixed(2));
      window.history.replaceState(null, '', `/map?${params.toString()}`);
      // Update bounds for ExploreOverlay
      const map = mapRef.current?.getMap();
      if (map) {
        const b = map.getBounds();
        if (b) setViewBounds({ minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() });
      }
    },
    []
  );

  const handleMapClick = useCallback(
    async (e: MapMouseEvent) => {
      if (mode !== 'planner') return;
      if (isFlyby) return;
      if (isWalkPreview) { if (!walkPausedRef.current) pauseWalkPreview(); return; }
      if (isPending) return;
      // POI placement mode: capture the click location and open the add-poi form
      if (poiMode) {
        setPendingPoiLngLat({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        return;
      }
      if (isLoop) return;
      // If a ball was clicked, insert a mid-route control point instead of appending
      const ballFeature = e.features?.find((f: { layer?: { id?: string } }) => f.layer?.id === 'route-balls');
      if (ballFeature) {
        const idx = ballFeature.properties?.idx as number | undefined;
        if (idx !== undefined) insertMidRouteControlPoint(idx);
        return;
      }
      const clicked: Point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      setTurnaroundIdx(null);
      // Route new points into the active leg
      const activeLeg = legs.find(s => s.id === activeSegmentId) ?? legs[legs.length - 1];
      const activePoints = activeLeg.points;
      if (snapToPath && activePoints.length > 0) {
        const origin = activePoints[activePoints.length - 1];
        setIsPending(true);
        try {
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
          const newPoints = await fetchSnappedRoute(origin, clicked, token);
          // Mark the snapped destination (last API point) as the user control point anchor
          const markedPoints = newPoints.length > 0
            ? [...newPoints.slice(0, -1), { ...newPoints[newPoints.length - 1], isControlPoint: true as const, isSnapped: true as const }]
            : newPoints;
          commit((prev) => {
            const next = [...prev];
            const ti = next.findIndex(s => s.id === activeSegmentId);
            const idx = ti >= 0 ? ti : next.length - 1;
            next[idx] = { ...next[idx], points: [...next[idx].points, ...markedPoints] };
            return next;
          });
        } catch {
          // Fall back to straight-line segment on error
          commit((prev) => {
            const next = [...prev];
            const ti = next.findIndex(s => s.id === activeSegmentId);
            const idx = ti >= 0 ? ti : next.length - 1;
            next[idx] = { ...next[idx], points: [...next[idx].points, { ...clicked, isControlPoint: true as const, isSnapped: false as const }] };
            return next;
          });
        } finally {
          setIsPending(false);
        }
      } else {
        commit((prev) => {
          const next = [...prev];
          const ti = next.findIndex(s => s.id === activeSegmentId);
          const idx = ti >= 0 ? ti : next.length - 1;
          next[idx] = { ...next[idx], points: [...next[idx].points, { ...clicked, isControlPoint: true as const, isSnapped: false as const }] };
          return next;
        });
      }
    },
    [mode, commit, isFlyby, isWalkPreview, isLoop, snapToPath, legs, activeSegmentId, isPending, insertMidRouteControlPoint, poiMode]
  );

  // Planner leg management
  const handleAddLeg = useCallback(() => {
    setTurnaroundIdx(null);
    const newId = `s${Date.now()}`;
    commit((prev) => [
      ...prev,
      {
        id: newId,
        name: `Leg ${prev.length + 1}`,
        color: SEGMENT_COLOURS[prev.length % SEGMENT_COLOURS.length],
        points: [],
      },
    ]);
    setActiveSegmentId(newId);
  }, [commit]);

  const handleDeleteLeg = useCallback(
    (id: string) => {
      setTurnaroundIdx(null);
      commit((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const newId = `s${Date.now()}`;
          setActiveSegmentId(newId);
          return [{ id: newId, name: 'Leg 1', color: SEGMENT_COLOURS[0], points: [] }];
        }
        if (activeSegmentId === id) {
          setActiveSegmentId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [commit, activeSegmentId]
  );

  const handleClearAll = useCallback(() => {
    setTurnaroundIdx(null);
    const newId = `s${Date.now()}`;
    resetLegs([{ id: newId, name: 'Leg 1', color: SEGMENT_COLOURS[0], points: [] }]);
    setActiveSegmentId(newId);
  }, [resetLegs]);

  // Reverse: flip all points so start ↔ end; mirror turnaround index if set
  const handleReverse = useCallback(() => {
    if (turnaroundIdx !== null) {
      setTurnaroundIdx(allPoints.length - 1 - turnaroundIdx);
    }
    commit((prev) => prev.map((s) => ({ ...s, points: [...s.points].reverse() })).reverse());
  }, [commit, turnaroundIdx, allPoints.length]);

  // Close loop: route from the active leg's last point back to its first point.
  const handleCloseLoop = useCallback(async () => {
    setTurnaroundIdx(null);
    const activeL = legs.find(s => s.id === activeSegmentId) ?? legs[legs.length - 1];
    const firstPt = activeL.points[0];
    if (!firstPt) return;
    const lastPt = activeL.points[activeL.points.length - 1];
    if (!lastPt) return;
    if (lastPt.lng === firstPt.lng && lastPt.lat === firstPt.lat) return; // already closed
    if (snapToPath && activeL.points.length >= 2 && !isPending) {
      setIsPending(true);
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
        const rawPoints = await fetchSnappedRoute(lastPt, firstPt, token);
        // Force the final point to be the exact origin so isLoop detection works
        const newPoints: Point[] =
          rawPoints.length > 0 ? [...rawPoints.slice(0, -1), firstPt] : [firstPt];
        commit((prev) => {
          const next = [...prev];
          const ti = next.findIndex(s => s.id === activeSegmentId);
          const idx = ti >= 0 ? ti : next.length - 1;
          next[idx] = { ...next[idx], points: [...next[idx].points, ...newPoints] };
          return next;
        });
      } catch {
        // Fall back to straight-line close
        commit((prev) => {
          const next = [...prev];
          const ti = next.findIndex(s => s.id === activeSegmentId);
          const idx = ti >= 0 ? ti : next.length - 1;
          next[idx] = { ...next[idx], points: [...next[idx].points, firstPt] };
          return next;
        });
      } finally {
        setIsPending(false);
      }
    } else {
      commit((prev) => {
        const next = [...prev];
        const ti = next.findIndex(s => s.id === activeSegmentId);
        const idx = ti >= 0 ? ti : next.length - 1;
        const leg = next[idx];
        if (leg.points.length === 0) return prev;
        const fp = leg.points[0];
        const lp = leg.points[leg.points.length - 1];
        if (lp && lp.lng === fp.lng && lp.lat === fp.lat) return prev;
        next[idx] = { ...leg, points: [...leg.points, fp] };
        return next;
      });
    }
  }, [commit, snapToPath, legs, activeSegmentId, isPending]);

  // Track back: mirror all points in reverse to create an out-and-back route
  const handleTrackBack = useCallback(() => {
    const turnAt = allPoints.length - 1; // index of the furthest point
    commit((prev) => {
      const allPts = prev.flatMap((s) => s.points);
      if (allPts.length < 2) return prev;
      const returnPts = [...allPts].reverse().slice(1);
      const lastSeg = prev[prev.length - 1];
      const updatedLast = { ...lastSeg, points: [...lastSeg.points, ...returnPts] };
      return [...prev.slice(0, -1), updatedLast];
    });
    setTurnaroundIdx(turnAt);
  }, [commit, allPoints.length]);
  // Use displayPoints (animated) for line rendering; allPoints for all logic
  const geoJSON = mode === 'planner' && displayPoints.length > 1 ? toMultiGeoJSON(legs, displayPoints) : null;

  return (
    <div className="absolute inset-0 pointer-events-auto">
      {/* ── Single map instance — never unmounts ── */}
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initialViewRef.current}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        attributionControl={false}
        interactiveLayerIds={mode === 'planner' ? ['route-balls'] : []}
        onMoveEnd={handleMoveEnd}
        onClick={handleMapClick}
        onMouseMove={mode === 'planner' ? handleBallMouseMove : undefined}
        onLoad={handleMapLoad}
        cursor={mode === 'planner' && (!isLoop || poiMode) ? (isPending ? 'wait' : 'crosshair') : undefined}
      >
        {geoJSON && (
          <Source id="route" type="geojson" data={geoJSON}>
            <Layer {...routeOutlineLayer} />
            {/* Green line + arrows hidden during flyby/walk preview */}
            {!isFlyby && !isWalkPreview && <Layer {...routeLayer} />}
            {!isFlyby && !isWalkPreview && mode !== 'planner' && <Layer {...routeArrowLayer} />}
          </Source>
        )}
        {mode === 'planner' && !isFlyby && !isWalkPreview && routeBallPoints && (
          <Source id="route-balls" type="geojson" generateId={false} data={routeBallPoints}>
            <Layer {...routeBallsLayer} />
            {ballTuning.arrowEveryN > 0 && <Layer {...routeBallArrowsLayer} />}
          </Source>
        )}

        {/* ── Elevation chart range highlight ── */}
        {mode === 'planner' && chartRange !== null && chartRange.end < elevationPoints.length && (
          <Source
            id="elevation-range"
            type="geojson"
            data={toGeoJSON(elevationPoints.slice(chartRange.start, chartRange.end + 1))}
          >
            <Layer {...rangeHighlightLayer} />
          </Source>
        )}

        {/* -- Activity GPS track -- */}
        {mode === 'activity' && activityTrack.length > 1 && (
          <Source id="activity-track" type="geojson" data={toGeoJSON(activityTrack)}>
            <Layer {...routeOutlineLayer} />
            <Layer {...routeLayer} />
          </Source>
        )}

        {/* Explore mode: route pins + clusters */}
        {mode === 'explore' && !isWalkPreview && (
          <ExploreMapLayers
            viewBounds={viewBounds}
            selectedRoute={exploreSelectedRoute}
            onRouteSelect={setExploreSelectedRoute}
            elevHoverIdx={exploreElevHoverIdx}
            onElevationsReady={(pts, elevs) => setExploreRouteElevData({ points: pts, elevations: elevs })}
            filteredIds={exploreFilteredIds}
          />
        )}

        {/* ── Route endpoint markers ── */}
        {mode === 'planner' && (() => {
          // Collect middle control points (exclude first and last)
          const ctrlPts: { point: Point; index: number; allPtIdx: number }[] = [];
          let cpIdx = 0;
          let totalCp = allPoints.filter(p => p.isControlPoint).length;
          for (let api = 0; api < allPoints.length; api++) {
            const p = allPoints[api];
            if (p.isControlPoint) {
              const isMid = cpIdx > 0 && cpIdx < totalCp - 1;
              if (isMid) ctrlPts.push({ point: p, index: cpIdx, allPtIdx: api });
              cpIdx++;
            }
          }
          return ctrlPts.map(({ point, index, allPtIdx }) => (
            <Marker
              key={`cp-${index}`}
              longitude={point.lng}
              latitude={point.lat}
              anchor="center"
              draggable
              onDragEnd={e => handleControlPointDragEnd(allPtIdx, e.lngLat.lng, e.lngLat.lat)}
            >
              <ControlPointMarker index={index + 1} />
            </Marker>
          ));
        })()}
        {/* Start / loop marker for every leg that has at least one point */}
        {mode === 'planner' && legs.map(leg => {
          if (leg.points.length === 0) return null;
          const fp = leg.points[0];
          const legIsLoop =
            leg.points.length >= 3 &&
            leg.points[0].lng === leg.points[leg.points.length - 1].lng &&
            leg.points[0].lat === leg.points[leg.points.length - 1].lat;
          return (
            <Marker
              key={`start-${leg.id}`}
              longitude={fp.lng}
              latitude={fp.lat}
              anchor="center"
              draggable
              onDragEnd={e => handleStartDragEnd(leg.id, e.lngLat.lng, e.lngLat.lat)}
            >
              {legIsLoop ? <LoopMarker /> : <StartMarker />}
            </Marker>
          );
        })}
        {mode === 'planner' && turnaroundIdx !== null && allPoints[turnaroundIdx] && (
          <Marker
            longitude={allPoints[turnaroundIdx].lng}
            latitude={allPoints[turnaroundIdx].lat}
            anchor="center"
          >
            <TurnaroundMarker />
          </Marker>
        )}
        {/* End marker at the last displayed point of the active leg */}
        {mode === 'planner' && !isLoop && (() => {
          let offset = 0;
          for (const leg of legs) {
            if (leg.id === activeSegmentId) {
              const end = Math.min(offset + leg.points.length, displayPoints.length);
              if (end - offset >= 2) {
                const pt = displayPoints[end - 1];
                return (
                  <Marker
                    longitude={pt.lng}
                    latitude={pt.lat}
                    anchor="center"
                    draggable
                    onDragEnd={e => handleEndDragEnd(e.lngLat.lng, e.lngLat.lat)}
                  >
                    <EndMarker />
                  </Marker>
                );
              }
              return null;
            }
            offset += leg.points.length;
          }
          return null;
        })()}


        {/* -- Planner POI markers -- */}
        {mode === "planner" && poiMarkers.map((poi, i) => (
          <Marker key={i} longitude={poi.lngLat.lng} latitude={poi.lngLat.lat} anchor="center">
            <div
              onMouseEnter={() => setHoveredPoiIdx(i)}
              onMouseLeave={() => setHoveredPoiIdx(null)}
              className="w-6 h-6 rounded-full bg-white border-2 border-active shadow flex items-center justify-center text-[11px] leading-none cursor-pointer hover:scale-110 transition-transform"
            >
              {PLACE_TYPE_META[poi.type as keyof typeof PLACE_TYPE_META]?.emoji ?? '??'}
            </div>
          </Marker>
        ))}
        {mode === "planner" && hoveredPoiIdx !== null && poiMarkers[hoveredPoiIdx] && (() => {
          const poi = poiMarkers[hoveredPoiIdx];
          const meta = PLACE_TYPE_META[poi.type as keyof typeof PLACE_TYPE_META];
          return (
            <Popup
              longitude={poi.lngLat.lng}
              latitude={poi.lngLat.lat}
              anchor="bottom"
              offset={16}
              closeButton={false}
              closeOnClick={false}
              onClose={() => setHoveredPoiIdx(null)}
            >
              <div className="flex items-start gap-2 py-1 px-0.5 min-w-35 max-w-50">
                <span className="text-lg leading-none shrink-0 mt-0.5">{meta?.emoji ?? '??'}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-tight">
                    {poi.name || meta?.label || poi.type}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {poi.lngLat.lat.toFixed(5)}, {poi.lngLat.lng.toFixed(5)}
                  </p>
                </div>
              </div>
            </Popup>
          );
        })()}
        {mode === "planner" && pendingPoiLngLat && (
          <Marker longitude={pendingPoiLngLat.lng} latitude={pendingPoiLngLat.lat} anchor="bottom">
            <div className="w-5 h-5 rounded-full bg-active border-2 border-white shadow-md animate-bounce" />
          </Marker>
        )}
        {mode === 'planner' && chartHoverIdx !== null && elevationPoints[chartHoverIdx] && (
          <Marker
            longitude={elevationPoints[chartHoverIdx].lng}
            latitude={elevationPoints[chartHoverIdx].lat}
            anchor="bottom"
          >
            <WalkerMarker />
          </Marker>
        )}
        {mode === 'planner' && chartRange !== null && elevationPoints[chartRange.end] && (
          <Marker
            longitude={elevationPoints[chartRange.end].lng}
            latitude={elevationPoints[chartRange.end].lat}
            anchor="left"
          >
            <RangeDistLabel distKm={chartRange.distKm} />
          </Marker>
        )}
        {/* Activity mode: elevation chart hover marker */}
        {mode === 'activity' && activityElevHoverIdx !== null && activityTrack[activityElevHoverIdx] && (
          <Marker
            longitude={activityTrack[activityElevHoverIdx].lng}
            latitude={activityTrack[activityElevHoverIdx].lat}
            anchor="bottom"
          >
            <WalkerMarker />
          </Marker>
        )}
        {/* Activity mode: walk photo markers */}
        {mode === 'activity' && activityPhotos.map((photo) => (
          <Marker
            key={photo._id}
            longitude={photo.longitude}
            latitude={photo.latitude}
            anchor="center"
          >
            <button
              type="button"
              className="pointer-events-auto"
              aria-label="Walk photo"
              onMouseEnter={() => setActivityPhotoHoverId(photo._id)}
              onMouseLeave={() => setActivityPhotoHoverId(null)}
              onFocus={() => setActivityPhotoHoverId(photo._id)}
              onBlur={() => setActivityPhotoHoverId(null)}
            >
              <PhotoMapPin active={activityPhotoHoverId === photo._id} />
            </button>
          </Marker>
        ))}
      </Map>

      {/* ── Mode overlays (UI panels on top of map) ── */}
      <div className="absolute inset-0 pointer-events-none">
        {mode === 'explore' && !isWalkPreview && (
          <ExploreOverlay
            viewBounds={viewBounds}
            selectedRoute={exploreSelectedRoute}
            onDeselectRoute={() => { setExploreSelectedRoute(null); setExploreRouteElevData(null); setExploreElevHoverIdx(null); }}
            onPreviewRoute={handlePreviewExploreRoute}
            routeElevPoints={exploreRouteElevData?.points ?? []}
            routeElevations={exploreRouteElevData?.elevations ?? []}
            onElevHoverIdx={setExploreElevHoverIdx}
            onFilteredIdsChange={setExploreFilteredIds}
            onEditRoute={handleEditRoute}
          />
        )}
        {mode === 'activity' && !isFlyby && !isWalkPreview && (
          <ActivityOverlay
            initialWalkId={activityWalkId}
            onTrackChange={setActivityTrack}
            onFitBounds={handleFitBounds}
            onElevHoverIdx={setActivityElevHoverIdx}
            onPhotosChange={setActivityPhotos}
            photoHoverId={activityPhotoHoverId}
            onPhotoHover={setActivityPhotoHoverId}
          />
        )}
        {mode === 'planner' && !isFlyby && !isWalkPreview && (
          <PlannerOverlay
            legs={legs}
            allPoints={allPoints}
            elevationPoints={elevationPoints}
            elevations={elevations}
            snapToPath={snapToPath}
            canUndo={canUndo}
            canRedo={canRedo}
            onAddLeg={handleAddLeg}
            onDeleteLeg={handleDeleteLeg}
            onClearLast={handleUndo}
            onClearAll={handleClearAll}
            onToggleSnap={() => setSnapToPath((v) => !v)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            isPending={isPending}
            onReverse={handleReverse}
            onCloseLoop={handleCloseLoop}
            onTrackBack={handleTrackBack}
            onChartHover={handleChartHover}
            onChartRangeChange={handleChartRangeChange}
            onFlyTo={handleFlyTo}
            chartHoverIdx={chartHoverIdx}
            activeSegmentId={activeSegmentId}
            onSetActiveLeg={setActiveSegmentId}
            poiMode={poiMode}
            onTogglePoiMode={() => { setPoiMode((v) => !v); setPendingPoiLngLat(null); }}
            pendingPoiLngLat={pendingPoiLngLat}
            onPendingPoiCancel={() => { setPendingPoiLngLat(null); setPoiMode(false); }}
            editingRouteId={editingRoute?._id ?? null}
            initialRouteName={editingRoute?.title}
            initialRouteDescription={editingRoute?.description}
            onRouteSaved={handleRouteSaved}
            onPendingPoisChange={setPoiMarkers}
            onWalkPreview={displayPoints.length > 2 ? () => handleWalkPreview() : undefined}
            onFlyby={displayPoints.length > 2 ? handlePreviewFlyby : undefined}
          />
        )}
        {isFlyby && (
          <FlybyHUD stepIdx={flybyStepIdx} totalSteps={flybyTotalSteps} onStop={endFlyby} />
        )}
        {isWalkPreview && (
          <WalkPreviewHUD
            elevationPoints={elevationPoints}
            elevations={elevations}
            progress={walkPreviewPct / 100}
            isPaused={walkPreviewPaused}
            speed={walkSpeed}
            onSeek={seekWalkPreview}
            onPause={pauseWalkPreview}
            onResume={resumeWalkPreview}
            onStop={endWalkPreview}
            onZoomIn={zoomInPreview}
            onZoomOut={zoomOutPreview}
            onOrbitLeft={orbitLeftPreview}
            onOrbitRight={orbitRightPreview}
            onSpeedUp={speedUpPreview}
            onSpeedDown={speedDownPreview}
          />
        )}

        {/* -- Ball hover tooltip -- */}
        {mode === 'planner' && hoveredBallTooltip && (
          <div
            className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full"
            style={{ left: hoveredBallTooltip.x, top: hoveredBallTooltip.y - 12 }}
          >
            <div className="rounded bg-gray-900/90 px-2 py-1 text-xs text-white whitespace-nowrap shadow-lg">
              {hoveredBallTooltip.isControlPoint
                ? 'Drag to change route'
                : 'Click to create a control point'}
            </div>
            <div className="mx-auto h-1.5 w-1.5 -translate-y-px rotate-45 bg-gray-900/90" />
          </div>
        )}

        {/* -- Preview buttons overlay -- removed: now inside toolbar */}

      </div>
    </div>
  );
}

// ── Route markers ─────────────────────────────────────────────────────────────

/** Start marker: white circle, green border, play triangle. */
function StartMarker() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#fff',
        border: '2.5px solid #2E7D32',
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Play triangle — offset 1px right for optical centering */}
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="#2E7D32"
        style={{ marginLeft: 2 }}
        aria-hidden="true"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    </div>
  );
}

/** End marker: white circle, red border, red stop square. */
function EndMarker() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#fff',
        border: '2.5px solid #e53935',
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          background: '#e53935',
          borderRadius: 2,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Loop marker: shown at the start/end node when the route is a closed loop.
 * White circle with both green ▶ and red ■ icons side by side.
 */
function LoopMarker() {
  return (
    <div
      style={{
        width: 40,
        height: 32,
        borderRadius: 16,
        background: '#fff',
        border: '2.5px solid #2E7D32',
        boxShadow: '0 2px 10px rgba(0,0,0,0.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 24 24" width={13} height={13} fill="#2E7D32" style={{ marginLeft: 1 }} aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      <div style={{ width: 11, height: 11, background: '#e53935', borderRadius: 2, marginRight: 1 }} aria-hidden="true" />
    </div>
  );
}

/** Turnaround marker: shown at the furthest point of a track-back route. */
function TurnaroundMarker() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: '#fff',
        border: '2.5px solid #F57C00',
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* U-turn arrow */}
      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="#F57C00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
    </div>
  );
}

/** Walker marker: shown on the map at the elevation chart hover position.
 *  Three sonar rings radiate outward from the marker while fading. */
/** Camera pin for walk photos on the activity map. */
function PhotoMapPin({ active }: { active: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border-2 border-white shadow-md transition-transform ${
        active ? 'scale-125 ring-2 ring-brand' : ''
      }`}
      style={{
        width: 28,
        height: 28,
        backgroundColor: active ? '#E65100' : '#1976d2',
      }}
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a41.09 41.09 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
    </div>
  );
}

function WalkerMarker() {
  return (
    <>
      <style>{`
        @keyframes sonar-ring {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(12.2); opacity: 0;   }
        }
        .sonar-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid #fff;
          animation: sonar-ring 2.4s ease-out infinite;
          pointer-events: none;
        }
        .sonar-ring-2 { animation-delay: 1.8s; }
        .sonar-ring-3 { animation-delay: 3.6s; }
      `}</style>
      {/* Rings sit behind the marker; outer container is the same size as the marker */}
      <div style={{ position: 'relative', width: 28, height: 28, pointerEvents: 'none' }}>
        <div className="sonar-ring" />
        <div className="sonar-ring sonar-ring-2" />
        <div className="sonar-ring sonar-ring-3" />
        {/* Marker disc */}
        <div
          style={{
            position: 'relative',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid #2E7D32',
            boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 8 16" width={11} height={16} fill="none" aria-hidden="true">
            <circle cx="4" cy="2" r="1.8" fill="#2E7D32" />
            <line x1="4" y1="3.8" x2="4" y2="9" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4" y1="5.5" x2="1.5" y2="8.5" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4" y1="5.5" x2="6.5" y2="8" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4" y1="9" x2="2" y2="13.5" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4" y1="9" x2="6" y2="13" stroke="#2E7D32" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </>
  );
}

/** Middle control point marker: white circle, grey border, index number. */
function ControlPointMarker({ index }: { index: number }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: '#fff',
        border: '2.5px solid #607D8B',
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        fontSize: 11,
        fontWeight: 700,
        color: '#607D8B',
        fontFamily: 'sans-serif',
      }}
    >
      {index}
    </div>
  );
}

/** Orange pill shown at the end of the elevation chart range selection on the map. */
function RangeDistLabel({ distKm }: { distKm: number }) {
  const { distanceUnit } = useUserPreferences();
  const label = formatDistanceKm(distKm, distanceUnit);
  return (
    <div
      style={{
        background: '#FF9800',
        color: 'white',
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        marginLeft: 8,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}

/** Cinematic 3D fly-through HUD: progress dots + exit button. */
function FlybyHUD({
  stepIdx,
  totalSteps,
  onStop,
}: {
  stepIdx: number;
  totalSteps: number;
  onStop: () => void;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end pb-10">
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        {/* Progress dots — one per control point */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === stepIdx ? 12 : 8,
                height: i === stepIdx ? 12 : 8,
                borderRadius: '50%',
                background:
                  i < stepIdx
                    ? 'rgba(255,255,255,0.5)'
                    : i === stepIdx
                    ? '#E65100'
                    : 'rgba(255,255,255,0.2)',
                transition: 'all 0.4s',
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        {/* Controls pill */}
        <div className="bg-black/80 backdrop-blur-sm text-white rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl border border-white/10">
          {/* Film camera icon */}
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-brand shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.899L15 14" />
            <rect x="1" y="6" width="14" height="12" rx="2" />
          </svg>
          <span className="text-sm font-medium">
            Waypoint <span className="tabular-nums">{stepIdx + 1}</span>
            <span className="text-white/50"> / {totalSteps}</span>
          </span>
          <div className="w-px h-4 bg-white/20 shrink-0" />
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Exit preview
          </button>
        </div>
      </div>
    </div>
  );
}

/** Chase-cam walk preview HUD: interactive elevation graph + controls. */
function WalkPreviewHUD({
  elevationPoints,
  elevations,
  progress,
  isPaused,
  speed,
  onSeek,
  onPause,
  onResume,
  onStop,
  onZoomIn,
  onZoomOut,
  onOrbitLeft,
  onOrbitRight,
  onSpeedUp,
  onSpeedDown,
}: {
  elevationPoints: Point[];
  elevations: number[];
  progress: number; // 0–1
  isPaused: boolean;
  speed: number;
  onSeek: (t: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOrbitLeft: () => void;
  onOrbitRight: () => void;
  onSpeedUp: () => void;
  onSpeedDown: () => void;
}) {
  const { distanceUnit, elevationUnit } = useUserPreferences();
  const svgRef = useRef<SVGSVGElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isBarDragging = useRef(false);

  const VB_W = 600, VB_H = 64;
  const PAD_TOP = 6, PAD_BOTTOM = 6;
  const chartH = VB_H - PAD_TOP - PAD_BOTTOM;

  const chartData = useMemo(() => {
    const n = elevationPoints.length;
    if (n < 2 || elevations.length < n) return null;
    const cumDist = new Array(n).fill(0) as number[];
    for (let i = 1; i < n; i++) cumDist[i] = cumDist[i - 1] + haversineKm(elevationPoints[i - 1], elevationPoints[i]);
    const totalDist = cumDist[n - 1] || 1;
    const elevSlice = elevations.slice(0, n);
    const minElev = Math.min(...elevSlice);
    const maxElev = Math.max(...elevSlice);
    const elevRange = (maxElev - minElev) || 1;
    const toX = (i: number) => (cumDist[i] / totalDist) * VB_W;
    const toY = (e: number) => VB_H - PAD_BOTTOM - ((e - minElev) / elevRange) * chartH;
    const pts = Array.from({ length: n }, (_, i) => ({ x: toX(i), y: toY(elevSlice[i]) }));
    const polylinePts = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath =
      `M 0,${VB_H - PAD_BOTTOM} ` +
      pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L ${VB_W},${VB_H - PAD_BOTTOM} Z`;
    // Elevation gain: sum of all positive rises
    let elevGain = 0;
    for (let i = 1; i < elevSlice.length; i++) {
      const d = elevSlice[i] - elevSlice[i - 1];
      if (d > 0) elevGain += d;
    }
    return { pts, polylinePts, areaPath, totalDist, elevGain: Math.round(elevGain), minElev, maxElev };
  }, [elevationPoints, elevations]);

  const progressX = progress * VB_W;

  // Interpolate cursor Y so the dot always sits on the profile line
  const cursorY = useMemo(() => {
    if (!chartData || chartData.pts.length < 2) return VB_H / 2;
    const px = progress * VB_W;
    const pts = chartData.pts;
    if (px <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].x >= px) {
        const span = pts[i].x - pts[i - 1].x;
        if (span === 0) return pts[i].y;
        const frac = (px - pts[i - 1].x) / span;
        return pts[i - 1].y + (pts[i].y - pts[i - 1].y) * frac;
      }
    }
    return pts[pts.length - 1].y;
  }, [chartData, progress]);

  // Invert Y→elevation for the altitude readout
  const currentElev = useMemo(() => {
    if (!chartData) return null;
    return Math.round(((VB_H - PAD_BOTTOM - cursorY) / chartH) * (chartData.maxElev - chartData.minElev) + chartData.minElev);
  }, [chartData, cursorY]);

  const getTFromSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
  };

  const getTFromBar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
  };

  const distLabel = !chartData ? '' : formatDistanceKmShort(chartData.totalDist, distanceUnit);

  const fmtElev = (m: number) => formatElevationCompact(m, elevationUnit);

  const currentDistLabel = !chartData ? '' : formatDistanceKm(progress * chartData.totalDist, distanceUnit);

  const camBtn = 'w-9 h-9 rounded-xl bg-white/12 hover:bg-white/22 active:scale-95 flex items-center justify-center transition-all text-white/80 hover:text-white shrink-0';


  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-3xl mx-auto px-4 pb-5">
        <div className="bg-black/85 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 shadow-2xl">

          {/* -- Header: title + route stats + exit -- */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-white/8">
            <div className="flex items-center gap-2 min-w-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white/55 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1.5"/>
                <path d="M12 7v5"/><path d="M9.5 10.5l2.5 1.5 2.5-1.5"/>
                <path d="M10.5 17.5l-1 2.5"/><path d="M13.5 17.5l1 2.5"/>
              </svg>
              <span className="text-white font-semibold text-sm">Route preview</span>
              {distLabel && (
                <span className="text-white/35 text-xs tabular-nums truncate">
                  {distLabel}{chartData && chartData.elevGain > 0 ? ` · +${formatElevationCompact(chartData.elevGain, elevationUnit)}` : ''}
                </span>
              )}
            </div>
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white bg-white/8 hover:bg-white/18 rounded-lg px-3 py-1.5 transition-colors shrink-0 ml-3"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Exit preview
            </button>
          </div>

          {/* -- Elevation chart with dedicated Y-axis and altitude readout -- */}
          <div className="flex items-stretch pt-2">

            {/* Y-axis column */}
            <div
              className="w-14 flex flex-col justify-between pl-3 pr-1 shrink-0"
              style={{ paddingTop: 6, paddingBottom: 6 }}
            >
              {chartData ? (
                <>
                  <span className="text-white/50 text-[10px] leading-none text-right block">{fmtElev(chartData.maxElev)}</span>
                  <span className="text-white/50 text-[10px] leading-none text-right block">{fmtElev(chartData.minElev)}</span>
                </>
              ) : <div />}
            </div>

            {/* SVG elevation profile */}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="flex-1 min-w-0 cursor-crosshair select-none"
              style={{ height: 80, display: 'block' }}
              onMouseDown={e => { isDragging.current = true; onSeek(getTFromSvg(e)); }}
              onMouseMove={e => { if (isDragging.current) onSeek(getTFromSvg(e)); }}
              onMouseUp={() => { isDragging.current = false; }}
              onMouseLeave={() => { isDragging.current = false; }}
            >
              {chartData ? (
                <>
                  <defs>
                    <clipPath id="wph-done"><rect x="0" y="0" width={progressX} height={VB_H} /></clipPath>
                    <clipPath id="wph-todo"><rect x={progressX} y="0" width={VB_W - progressX} height={VB_H} /></clipPath>
                  </defs>
                  <path d={chartData.areaPath} fill="rgba(255,255,255,0.07)" clipPath="url(#wph-todo)" />
                  <path d={chartData.areaPath} fill="rgba(46,125,50,0.45)" clipPath="url(#wph-done)" />
                  <polyline points={chartData.polylinePts} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" clipPath="url(#wph-todo)" />
                  <polyline points={chartData.polylinePts} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" clipPath="url(#wph-done)" />
                  <line x1={progressX} y1={PAD_TOP} x2={progressX} y2={VB_H - PAD_BOTTOM} stroke="white" strokeWidth="1.5" strokeOpacity="0.65" />
                  <circle cx={progressX} cy={cursorY} r="4.5" fill="#E65100" stroke="white" strokeWidth="1.5" />
                </>
              ) : (
                <>
                  <rect x="0" y={VB_H / 2 - 2} width={VB_W} height="4" fill="rgba(255,255,255,0.12)" rx="2" />
                  <rect x="0" y={VB_H / 2 - 2} width={progressX} height="4" fill="rgba(255,255,255,0.7)" rx="2" />
                </>
              )}
            </svg>

            {/* Current altitude column */}
            <div className="w-16 flex flex-col items-center justify-center px-2 shrink-0 gap-0.5">
              {currentElev !== null && (
                <>
                  <svg viewBox="0 0 16 16" className="w-3 h-3 text-white/45" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="14" x2="8" y2="2"/><polyline points="4 6 8 2 12 6"/>
                  </svg>
                  <span className="text-white font-bold text-sm leading-none tabular-nums">
                    {formatElevationCompact(currentElev, elevationUnit)}
                  </span>
                  <span className="text-white/40 text-[10px] leading-none">{elevationAxisLabel(elevationUnit)} alt</span>
                </>
              )}
            </div>

          </div>

          {/* -- YouTube-style thin progress bar -- */}
          <div className="pl-14 pr-16 pt-2 pb-1">
            <div
              ref={barRef}
              className="relative h-1.5 bg-white/15 rounded-full cursor-pointer group"
              onMouseDown={e => { isBarDragging.current = true; onSeek(getTFromBar(e)); }}
              onMouseMove={e => { if (isBarDragging.current) onSeek(getTFromBar(e)); }}
              onMouseUp={() => { isBarDragging.current = false; }}
              onMouseLeave={() => { isBarDragging.current = false; }}
            >
              <div
                className="h-full bg-orange-500 rounded-full pointer-events-none"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-orange-500 shadow pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress * 100}% - 7px)` }}
              />
            </div>
            <div className="flex items-baseline justify-center gap-1.5 mt-1.5">
              <span className="text-white font-bold text-sm tabular-nums leading-none">{currentDistLabel || '\u00a0'}</span>
              {progress > 0 && (
                <span className="text-white/35 text-[10px] tabular-nums leading-none">{Math.round(progress * 100)}%</span>
              )}
            </div>
          </div>

          {/* -- Playback controls -- */}
          <div className="flex items-center justify-center border-t border-white/8 px-4 py-3 gap-2">

            <div className="flex items-center gap-1.5">
              <button onClick={onZoomOut} title="Zoom out" className={camBtn}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
              <button onClick={onOrbitRight} title="Orbit left" className={camBtn}>
               <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 5 A8 8 0 1 1 4 12"/>
                  <polyline points="6 14 4 12 2 14"/>
                </svg>
              </button>
            </div>

            <div className="flex flex-col items-center gap-1 mx-2">
              <button
                onClick={isPaused ? onResume : onPause}
                title={isPaused ? 'Resume' : 'Pause'}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 flex items-center justify-center transition-all text-white shadow-lg"
              >
                {isPaused ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                )}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={onSpeedDown} title="Slower" disabled={speed <= 0.25}
                  className="w-6 h-6 rounded-md bg-white/12 hover:bg-white/22 active:scale-95 flex items-center justify-center transition-all text-white/80 hover:text-white text-sm font-semibold leading-none disabled:opacity-30"
                >{'\u2212'}</button>
                <span className="text-white/55 tabular-nums text-xs w-7 text-center">{speed}{'\u00d7'}</span>
                <button onClick={onSpeedUp} title="Faster" disabled={speed >= 4}
                  className="w-6 h-6 rounded-md bg-white/12 hover:bg-white/22 active:scale-95 flex items-center justify-center transition-all text-white/80 hover:text-white text-sm font-semibold leading-none disabled:opacity-30"
                >+</button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={onOrbitLeft} title="Orbit right" className={camBtn}>
                 <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 5 A8 8 0 1 0 20 12"/>
                  <polyline points="18 14 20 12 22 14"/>
                </svg>
              </button>
              <button onClick={onZoomIn} title="Zoom in" className={camBtn}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
