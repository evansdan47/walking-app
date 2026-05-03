'use client';

import dynamic from 'next/dynamic';

// MapCanvas is browser-only (Mapbox + Math.sin/cos SVG fallback).
// `ssr: false` is only valid inside a Client Component.
export const MapCanvasClient = dynamic(
  () => import('./map-canvas').then((m) => m.MapCanvas),
  { ssr: false }
);
