'use client';

import dynamic from 'next/dynamic';

const MapShellDynamic = dynamic(
  () => import('./map-shell').then((m) => m.MapShell),
  { ssr: false }
);

export function MapShellClient() {
  return <MapShellDynamic />;
}
