import { MapShellClient } from '@/components/map/map-shell-client';
import { Suspense } from 'react';

export default function MapPage() {
  return (
    // Suspense required for useSearchParams inside MapShell
    <Suspense>
      <MapShellClient />
    </Suspense>
  );
}
