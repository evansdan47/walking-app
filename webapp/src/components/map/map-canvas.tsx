'use client';

import { useMapUrlSync } from '@/hooks/use-map-url-sync';
import 'mapbox-gl/dist/mapbox-gl.css';
import Map from 'react-map-gl/mapbox';

/**
 * Full-screen Mapbox map (outdoors-v12) that stays mounted at all times.
 * Syncs viewport to URL query params so position is preserved across pages.
 */
export function MapCanvas() {
  const { initialView, onMoveEnd } = useMapUrlSync();

  return (
    <div className="absolute inset-0" aria-label="Interactive map">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={initialView}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        attributionControl={false}
        onMoveEnd={onMoveEnd}
      />
    </div>
  );
}
