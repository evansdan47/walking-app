import { useCallback, useRef } from 'react';

// Default view: SW England (Cornwall)
const DEFAULT_VIEW = { longitude: -5.22, latitude: 50.32, zoom: 12 };

type MapView = { longitude: number; latitude: number; zoom: number };
type MoveEvent = { viewState: MapView };

function readViewFromUrl(): MapView {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
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

/**
 * Syncs map view state to/from URL query params (?lat=&lng=&zoom=).
 * Uses onMoveEnd (fires once per gesture) rather than onMove (every frame)
 * so that window.history.replaceState is never called mid-gesture — this
 * prevents Next.js App Router from re-rendering the page segment and
 * interrupting Mapbox's pointer-event capture during active panning.
 */
export function useMapUrlSync() {
  // Compute once on first render (client-only components, safe to read window)
  const initialViewRef = useRef<MapView | null>(null);
  if (!initialViewRef.current) initialViewRef.current = readViewFromUrl();

  const onMoveEnd = useCallback((evt: MoveEvent) => {
    const { longitude, latitude, zoom } = evt.viewState;
    const params = new URLSearchParams(window.location.search);
    params.set('lat', latitude.toFixed(5));
    params.set('lng', longitude.toFixed(5));
    params.set('zoom', zoom.toFixed(2));
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params.toString()}`
    );
  }, []);

  return { initialView: initialViewRef.current, onMoveEnd };
}
